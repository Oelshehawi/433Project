#include "WebSocketClient.h"
#include <iostream>
#include <cstring>
#include <sstream>
#include <vector>
#include <atomic>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

// Global flag for aggressive service - used to speed up service loop when needed
std::atomic<bool> needsAggressiveService(false);
std::atomic<int> aggressiveServiceCount(0);

// Per-session data - now defined in WebSocketClient.h
// ClientData struct definition removed from here

// Define protocol callback function separately - now relocated to protocol_callback.cpp
// Forward declaration to maintain compatibility
int protocol_callback(struct lws *wsi, enum lws_callback_reasons reason, 
                   void *user, void *in, size_t len);

// Define protocol array 
static struct lws_protocols protocols[] = {
    { 
        "protocol-gesture", 
        protocol_callback, 
        sizeof(ClientData), 
        0, 
        0, 
        NULL, 
        0 
    },
    { NULL, NULL, 0, 0, 0, NULL, 0 } // End of list
};

// Service thread constants
#define SERVICE_INTERVAL_MS 1
#define MAX_SERVICE_INTERVAL_MS 3
#define LOG_INTERVAL_MS 5000

WebSocketClient::WebSocketClient(const std::string& host, int port, const std::string& path, bool useTLS)
    : host(host), port(port), path(path), useTLS(useTLS), 
      connected(false), running(false), context(nullptr), wsi(nullptr), 
      wakeRequested(false) {
}

WebSocketClient::~WebSocketClient() {
    disconnect();
}

void WebSocketClient::run() {
    // Setup the lws context creation info
    struct lws_context_creation_info info;
    memset(&info, 0, sizeof(info));
    
    info.port = CONTEXT_PORT_NO_LISTEN;
    info.protocols = protocols;
    
    // Set options for SSL/TLS if needed
    if (useTLS) {
        info.options |= LWS_SERVER_OPTION_DO_SSL_GLOBAL_INIT;
    }
    
    // Create the lws context
    context = lws_create_context(&info);
    
    if (!context) {
        running = false;
        return;
    }
    
    // Setup client connection info
    struct lws_client_connect_info ccinfo;
    memset(&ccinfo, 0, sizeof(ccinfo));
    
    ccinfo.context = context;
    ccinfo.address = host.c_str();
    ccinfo.port = port;
    ccinfo.path = path.c_str();
    ccinfo.host = host.c_str();
    ccinfo.origin = host.c_str();
    ccinfo.protocol = "protocol-gesture";
    ccinfo.ssl_connection = useTLS ? LCCSCF_USE_SSL : 0;
    
    // Create per-session data - store a pointer to it for cleanup
    ClientData* clientData = new ClientData;
    clientData->client = this;
    ccinfo.userdata = clientData;
    
    // Connect to the server
    wsi = lws_client_connect_via_info(&ccinfo);
    
    // If connection fails immediately, clean up
    if (!wsi) {
        delete clientData;
        lws_context_destroy(context);
        context = nullptr;
        running = false;
        return;
    }
    
    // Main event loop with maximum connection time
    auto startTime = std::chrono::steady_clock::now();
    bool connectionTimedOut = false;
    auto lastStatsLog = std::chrono::steady_clock::now();
    auto lastPingTime = std::chrono::steady_clock::now();
    
    // Make initial service interval very small for quick startup
    int currentServiceInterval = 1;
    
    // Processing counters for statistics
    uint64_t totalServiceCalls = 0;
    uint64_t totalMessagesProcessed = 0;
    
    while (running) {
        // Check for connection timeout (only during initial connection)
        if (!connected) {
            auto elapsed = std::chrono::duration_cast<std::chrono::seconds>(
                std::chrono::steady_clock::now() - startTime).count();
            if (elapsed > 5) {
                connectionTimedOut = true;
                break;
            }
        }
        
        // Process WebSockets - Using 0 timeout for non-blocking check
        int serviceResult = lws_service(context, 0);
        
        totalServiceCalls++;
        
        // Check for queued messages
        bool hasMessages = false;
        int queueSize = 0;
        {
            std::lock_guard<std::mutex> lock(queueMutex);
            queueSize = messageQueue.size();
            hasMessages = (queueSize > 0);
        }
        
        // Send periodic ping to keep connection alive
        auto now = std::chrono::steady_clock::now();
        auto timeSinceLastPing = std::chrono::duration_cast<std::chrono::seconds>(
            now - lastPingTime).count();
        
        // Send a ping every 20 seconds
        if (connected && timeSinceLastPing > 20) {
            // Queue a simple ping message
            std::string pingMsg = "{\"event\":\"ping\"}";
            {
                std::lock_guard<std::mutex> lock(queueMutex);
                messageQueue.push(pingMsg);
            }
            
            // Request writable callback to send ping
            if (wsi) {
                lws_callback_on_writable(wsi);
            }
            
            // Update ping time
            lastPingTime = now;
        }
        
        // Immediate processing: If we have messages or wake requested, don't sleep and continue servicing
        if (hasMessages || wakeRequested) {
            // Use minimal interval - essentially no sleep between iterations
            currentServiceInterval = 0;
            
            // Reset wake request flag
            wakeRequested = false;
            
            // If we have a connection, try to send queued messages immediately
            if (wsi && connected && hasMessages) {
                // Request writable callback - this will trigger sending in the protocol callback
                lws_callback_on_writable(wsi);
                totalMessagesProcessed++;
            }
            
            // Skip the sleep and process immediately
            continue;
        } 
        else if (needsAggressiveService) {
            // If aggressive servicing is needed, use minimum interval
            currentServiceInterval = SERVICE_INTERVAL_MS;
            
            // Decrement aggressive service counter
            if (aggressiveServiceCount > 0) {
                aggressiveServiceCount--;
                if (aggressiveServiceCount == 0) {
                    needsAggressiveService = false;
                }
            }
        } 
        else {
            // If no messages and no aggressive service needed, use higher interval to reduce CPU
            currentServiceInterval = MAX_SERVICE_INTERVAL_MS;
        }
        
        // Only sleep if we're not in immediate processing mode
        if (currentServiceInterval > 0) {
            std::this_thread::sleep_for(std::chrono::milliseconds(currentServiceInterval));
        }
    }
    
    // Clean up if timeout occurred
    if (connectionTimedOut) {
        // Failed to connect within timeout
        connected = false;
        
        // Clean up wsi and context
        if (wsi) {
            // The connection callback will clean up clientData
            wsi = nullptr;
        }
        
        if (context) {
            lws_context_destroy(context);
            context = nullptr;
        }
    }
}

bool WebSocketClient::connect() {
    // Check if already connected
    if (connected) {
        return true;
    }
    
    // Set the running flag and start the thread
    running = true;
    thread = std::thread(&WebSocketClient::run, this);
    
    return true;
}

void WebSocketClient::disconnect() {
    running = false;
    
    if (thread.joinable()) {
        thread.join();
    }
    
    // Clean up context and wsi if they still exist
    if (context) {
        lws_context_destroy(context);
        context = nullptr;
        wsi = nullptr;
    }
    
    connected = false;
}

bool WebSocketClient::isConnected() const {
    return connected;
}

bool WebSocketClient::sendMessage(const std::string& message) {
    // Check if connected
    if (!connected) {
        return false;
    }
    
    // Queue the message
    {
        std::lock_guard<std::mutex> lock(queueMutex);
        messageQueue.push(message);
    }
    
    // Request writable callback to send the message
    if (wsi) {
        lws_callback_on_writable(wsi);
        
        // Request aggressive service for next many iterations
        needsAggressiveService = true;
        aggressiveServiceCount = 50; // Increase to ensure message gets processed
        
        // Request immediate wake-up to process this message
        wakeRequested = true;
        
        // Force immediate processing if we have context
        if (context) {
            // This will be done in the service thread to avoid blocking
            wakeRequested = true;
        }
        
        return true;
    }
    
    return false;
}

std::string WebSocketClient::getNextMessage() {
    std::lock_guard<std::mutex> lock(queueMutex);
    
    if (messageQueue.empty()) {
        return "";
    }
    
    std::string message = messageQueue.front();
                messageQueue.pop();
                
    return message;
}

void WebSocketClient::onConnected() {
    connected = true;
    
    // Signal any waiting threads that connection is established
    std::lock_guard<std::mutex> lock(stateMutex);
    connectionCV.notify_all();
    
    // Notify subscribers about connection
    if (connectionCallback) {
        connectionCallback(true);
    }
}

void WebSocketClient::onDisconnected() {
    bool wasConnected = connected;
    connected = false;
    
    // Signal any waiting threads about disconnection
    std::lock_guard<std::mutex> lock(stateMutex);
    connectionCV.notify_all();
    
    // Only notify if we were previously connected
    if (wasConnected && connectionCallback) {
        connectionCallback(false);
    }
}

void WebSocketClient::onMessageReceived(const std::string& message) {
    if (messageCallback) {
        messageCallback(message);
    }
}

void WebSocketClient::setMessageCallback(std::function<void(const std::string&)> callback) {
    messageCallback = callback;
}

void WebSocketClient::setConnectionCallback(std::function<void(bool)> callback) {
    connectionCallback = callback;
}

// Add method to request a wake-up of the service thread
void WebSocketClient::requestWake() {
    wakeRequested = true;
}

// Add method to ensure messages are processed quickly
void WebSocketClient::ensureMessageProcessing() {
    // Set the aggressive service flag to ensure faster processing
    needsAggressiveService = true;
    aggressiveServiceCount = 50; // More aggressive processing cycles
    
    // Request a wake-up
    wakeRequested = true;
    
    // No sleep to avoid blocking - we want immediate processing
    
    // Force immediate service call if we have a valid context
    if (context) {
        lws_service(context, 0);
    }
}

// Callback for writable buffer
int WebSocketClient::callback_writable(struct lws *wsi) {
    // Check if we have messages to send
    std::string message = getNextMessage();
    
    if (message.empty()) {
        return 0;
    }
    
    // Prepare the message for WebSocket frame
    // LWS requires extra space for headers (LWS_PRE)
    unsigned char *buf = new unsigned char[LWS_PRE + message.length()];
    memcpy(buf + LWS_PRE, message.c_str(), message.length());
    
    // Send the message
    int ret = lws_write(wsi, buf + LWS_PRE, message.length(), LWS_WRITE_TEXT);
    
    delete[] buf;
    
    if (ret < 0) {
        // Write failed
        return -1;
    }
    
    // Request another writable event if we still have messages to send
    {
        std::lock_guard<std::mutex> lock(queueMutex);
        if (!messageQueue.empty()) {
            lws_callback_on_writable(wsi);
        }
    }
    
    return 0;
}

int WebSocketClient::callback_closed(struct lws *wsi) {
    onDisconnected();
    return 0;
}

int protocol_callback(struct lws *wsi, enum lws_callback_reasons reason, 
                    void *user, void *in, size_t len) {
    ClientData *data = (ClientData *)user;
    WebSocketClient *client = data ? data->client : nullptr;
    
    switch (reason) {
        case LWS_CALLBACK_CLIENT_ESTABLISHED:
            // Connection established
            if (client) {
                client->onConnected();
            }
            break;
            
        case LWS_CALLBACK_CLIENT_WRITEABLE:
            // Ready to write
            if (client) {
                return client->callback_writable(wsi);
            }
            break;
        
        case LWS_CALLBACK_CLIENT_RECEIVE: {
            // Received data
            if (client && in && len > 0) {
                std::string message((char *)in, len);
                
                // Check if we already have fragments
                if (!data->fragmentBuffer.empty()) {
                    // Append to existing fragment
                    data->fragmentBuffer.append(message);
                    message = data->fragmentBuffer;
                }
                
                // Check if the frame is final (complete message)
                bool isFinal = lws_is_final_fragment(wsi);
                
                if (isFinal) {
                    // Pass full message to client
                    if (client) {
                        client->onMessageReceived(message);
                    }
                    // Clear fragment buffer
                    data->fragmentBuffer.clear();
                    } else {
                    // Store fragment for later
                    data->fragmentBuffer = message;
                }
            }
            break;
        }
        
        case LWS_CALLBACK_CLIENT_CLOSED:
            // Connection closed
            if (client) {
                client->callback_closed(wsi);
            }
            break;
            
        case LWS_CALLBACK_CLIENT_CONNECTION_ERROR:
            // Connection failed or had an error
            if (client) {
                client->onDisconnected();
            }
            break;
        
        default:
            break;
    }
    
    return 0;
} 