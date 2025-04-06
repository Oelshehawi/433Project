#include "WebSocketClient.h"
#include <iostream>
#include <cstring>
#include <chrono>

// Protocol callback function implementation
int protocol_callback(struct lws *wsi, enum lws_callback_reasons reason, 
                    void *user, void *in, size_t len) {
    ClientData *clientData = static_cast<ClientData*>(user);
    WebSocketClient *client = nullptr;
    
    if (clientData != nullptr) {
        client = clientData->client;
    }
    
    switch (reason) {
        case LWS_CALLBACK_CLIENT_ESTABLISHED: {
            std::cout << "WebSocket connection established" << std::endl;
            if (client) {
                client->connected = true;
                
                // Signal the condition variable to wake up the waiting connect() method
                {
                    std::lock_guard<std::mutex> lock(client->connectionMutex);
                    client->connectionCV.notify_all();
                }
                
                // Request a writable callback immediately to process any queued messages
                if (client->wsi) {
                    // Check if we have messages
                    bool hasMessages = false;
                    {
                        std::lock_guard<std::mutex> lock(client->queueMutex);
                        hasMessages = !client->messageQueue.empty();
                    }
                    
                    if (hasMessages) {
                        lws_callback_on_writable(wsi);
                    }
                }
            }
            break;
        }
        
        case LWS_CALLBACK_CLIENT_RECEIVE: {
            if (client && in && len > 0) {
                // Process received data
                const char *data = static_cast<const char*>(in);
                std::string message(data, len);
                
                // Check if message is complete (final fragment)
                bool isFinal = lws_is_final_fragment(wsi);
                clientData->receivedData.append(message);
                
                if (isFinal) {
                    // Process the complete message
                    if (client->messageCallback) {
                        // Call user's message handler
                        client->messageCallback(clientData->receivedData);
                    }
                    
                    clientData->receivedData.clear();
                }
            }
            
            break;
        }
        
        case LWS_CALLBACK_CLIENT_WRITEABLE: {
            // Log when this occurs for performance analysis
            if (client) {
                // Process all available messages up to a maximum per callback
                int messagesSent = 0;
                const int MAX_MESSAGES_PER_CALLBACK = 5;
                
                while (messagesSent < MAX_MESSAGES_PER_CALLBACK) {
                    // Get next message from queue
                    std::string message;
                    {
                        std::lock_guard<std::mutex> lock(client->queueMutex);
                        if (client->messageQueue.empty()) {
                            break; // No more messages
                        }
                        
                        message = client->messageQueue.front();
                        client->messageQueue.pop();
                    }
                    
                    if (!message.empty()) {
                        // Prepare the outgoing message buffer with the proper padding
                        std::vector<unsigned char> buf(LWS_SEND_BUFFER_PRE_PADDING + message.length() + LWS_SEND_BUFFER_POST_PADDING);
                        unsigned char *p = &buf[LWS_SEND_BUFFER_PRE_PADDING];
                        memcpy(p, message.c_str(), message.length());
                        
                        // Send the message
                        int n = lws_write(wsi, p, message.length(), LWS_WRITE_TEXT);
                        
                        if (n < 0) {
                            std::cerr << "WebSocket write failed" << std::endl;
                            return -1;
                        }
                        
                        messagesSent++;
                    }
                }
                
                // Check if we have more messages to send
                {
                    std::lock_guard<std::mutex> lock(client->queueMutex);
                    if (!client->messageQueue.empty()) {
                        // Request another writable callback immediately
                        lws_callback_on_writable(wsi);
                    }
                }
            }
            
            break;
        }
        
        case LWS_CALLBACK_CLIENT_CLOSED: {
            std::cout << "WebSocket connection closed" << std::endl;
            if (client) {
                client->connected = false;
            }
            return -1; // Signal to destroy the connection
        }
        
        case LWS_CALLBACK_CLIENT_CONNECTION_ERROR: {
            std::cout << "WebSocket connection error";
            if (in) {
                std::cout << ": " << static_cast<const char*>(in);
            }
            std::cout << std::endl;
            
            if (client) {
                client->connected = false;
            }
            return -1; // Signal to destroy the connection
        }
        
        default:
            break;
    }
    
    return 0;
} 