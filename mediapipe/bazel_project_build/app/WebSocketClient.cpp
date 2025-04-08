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
    
    std::cout << "Initializing WebSocket client for " << (useTLS ? "wss://" : "ws://") 
              << host << ":" << port << path << std::endl;
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
        std::cerr << "Failed to create libwebsockets context" << std::endl;
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
    std::cout << "Connecting to WebSocket server..." << std::endl;
    wsi = lws_client_connect_via_info(&ccinfo);
    
    // If connection fails immediately, clean up
    if (!wsi) {
        std::cerr << "Failed to connect to WebSocket server" << std::endl;
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
    
    // Adaptive timing - use lower intervals when busy, higher when idle
    int currentServiceInterval = SERVICE_INTERVAL_MS;
    
    std::cout << "WebSocket service thread started" << std::endl;
    
    // Processing counters for statistics
    uint64_t totalServiceCalls = 0;
    uint64_t totalMessagesProcessed = 0;
    
    while (running) {
        // Check for connection timeout (only during initial connection)
        if (!connected) {
            auto elapsed = std::chrono::duration_cast<std::chrono::seconds>(
                std::chrono::steady_clock::now() - startTime).count();
            if (elapsed > 5) {
                std::cerr << "WebSocket connection timed out after 5 seconds" << std::endl;
                connectionTimedOut = true;
                break;
            }
        }
        
        // Process WebSockets - Using 0 timeout for non-blocking check
        int serviceResult = lws_service(context, 0);
        
        totalServiceCalls++;
        
        if (serviceResult < 0) {
            std::cerr << "WebSocket service error, code: " << serviceResult << std::endl;
        }
        
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
            std::cout << "[WebSocketClient.cpp] Queued ping message to keep connection alive" << std::endl;
        }
        
        // Adapt service interval based on queue status
        if (hasMessages) {
            // When we have messages, use the minimum service interval for maximum responsiveness
            currentServiceInterval = SERVICE_INTERVAL_MS;
            
            // If we have a connection, try to send queued messages immediately
            if (wsi && connected) {
                // Request writable callback - this will trigger sending in the protocol callback
                lws_callback_on_writable(wsi);
                totalMessagesProcessed++;
            }
        } else if (needsAggressiveService) {
            // If aggressive servicing is needed, use minimum interval
            currentServiceInterval = SERVICE_INTERVAL_MS;
            
            // Decrement aggressive service counter
            if (aggressiveServiceCount > 0) {
                aggressiveServiceCount--;
                if (aggressiveServiceCount == 0) {
                    needsAggressiveService = false;
                }
            }
        } else {
            // If no messages, we can use a slightly longer interval to reduce CPU usage
            currentServiceInterval = MAX_SERVICE_INTERVAL_MS;
        }
        
        // Log statistics periodically
        auto timeSinceLastStats = std::chrono::duration_cast<std::chrono::milliseconds>(
            now - lastStatsLog).count();
        
        if (timeSinceLastStats > LOG_INTERVAL_MS) {
            // Reset counters and update last log time
            lastStatsLog = now;
            totalServiceCalls = 0;
            totalMessagesProcessed = 0;
        }
        
        // Sleep just enough to prevent CPU overuse while maintaining high responsiveness
        std::this_thread::sleep_for(std::chrono::milliseconds(currentServiceInterval));
    }
    
    // Cleanup
    if (context) {
        lws_context_destroy(context);
        context = nullptr;
    }
    
    // If we didn't successfully connect and the connection attempt timed out,
    // we need to manually delete the clientData since the callback won't handle it
    if (connectionTimedOut && clientData) {
        delete clientData;
    }
    
    wsi = nullptr;
    connected = false;
    
    std::cout << "WebSocket service thread ended" << std::endl;
}

bool WebSocketClient::connect() {
    if (running) {
        return true; // Already running
    }
    
    running = true;
    connected = false; // Ensure it starts as false
    
    // Start the WebSocket client thread
    clientThread = std::thread(&WebSocketClient::run, this);
    
    // Wait for connection with a timeout using condition variable
    {
        std::unique_lock<std::mutex> lock(connectionMutex);
        // Wait for up to 10 seconds for the connection to be established
        bool success = connectionCV.wait_for(lock, std::chrono::seconds(10), 
            [this]() { return this->connected.load(); });
        
        if (!success) {
            std::cerr << "Failed to establish WebSocket connection within timeout" << std::endl;
            disconnect(); // Clean up the thread and resources
            return false;
        }
    }
    
    return true;
}

void WebSocketClient::disconnect() {
    running = false;
    
    if (clientThread.joinable()) {
        clientThread.join();
    }
    
    connected = false;
}

// Helper function to ensure messages are processed quickly
void WebSocketClient::ensureMessageProcessing() {
    // We CANNOT call lws_service from multiple threads - it's not thread-safe
    // Instead, wake up the service thread and request a callback
    if (wsi) {
        // Request write callback with highest priority
        lws_callback_on_writable_all_protocol(lws_get_context(wsi), 
                                           lws_get_protocol(wsi));
        
        // Activate aggressive service mode for faster processing
        needsAggressiveService = true;
        aggressiveServiceCount = 100; // Set to process quickly for a while
        
        // Wake up the service thread to process immediately
        wakeServiceThread();
    }
}

bool WebSocketClient::sendMessage(const std::string& message) {
    if (!running || !connected) {
        std::cerr << "Cannot send message: client not connected" << std::endl;
        return false;
    }
    
    // Format message as JSON
    std::string jsonMessage;
    
    // Check if message is already JSON (starts with '{')
    if (message.length() > 0 && message[0] == '{') {
        jsonMessage = message;
    } else if (message.length() > 0 && message.find("CMD:") == 0) {
        // Convert BeagleBoard command format to proper WebSocket event
        // Extract parts from the command format
        size_t cmdDelim = message.find('|');
        if (cmdDelim != std::string::npos) {
            std::string cmdPart = message.substr(0, cmdDelim);
            std::string cmdName = cmdPart.substr(4); // Skip "CMD:"
            std::string paramsStr = message.substr(cmdDelim + 1);
            
            // Parse parameters
            json params = json::object();
            size_t start = 0;
            size_t end = paramsStr.find('|');
            
            while (start < paramsStr.length()) {
                std::string param = paramsStr.substr(start, (end == std::string::npos) ? end : end - start);
                size_t colonPos = param.find(':');
                
                if (colonPos != std::string::npos) {
                    std::string key = param.substr(0, colonPos);
                    std::string value = param.substr(colonPos + 1);
                    
                    // Map BeagleBoard keys to WebSocket format
                    if (key == "DeviceID") {
                        params["playerId"] = value;
                    } else if (key == "RoomID") {
                        params["roomId"] = value;
                    } else if (key == "PlayerName") {
                        params["playerName"] = value;
                    } else {
                        params[key] = value;
                    }
                }
                
                if (end == std::string::npos) break;
                start = end + 1;
                end = paramsStr.find('|', start);
            }
            
            // Create proper JSON event based on command
            json j = json::object();
            if (cmdName == "JOIN_ROOM") {
                j["event"] = "join_room";
                
                // Extract required parameters
                std::string roomId = params.value("RoomID", "");
                std::string playerName = params.value("PlayerName", "");
                std::string deviceId = params.value("DeviceID", "");
                
                // Create the proper payload format
                json payload = json::object();
                payload["roomId"] = roomId;
                payload["playerId"] = deviceId;
                payload["playerName"] = playerName;
                
                j["payload"] = payload;
                
            } else if (cmdName == "LIST_ROOMS") {
                j["event"] = "room_list";
                j["payload"] = json::object();
            } else if (cmdName == "LEAVE_ROOM") {
                j["event"] = "leave_room";
                j["payload"] = params;
            } else if (cmdName == "SET_READY") {
                j["event"] = "player_ready";
                bool ready = (params.value("Ready", "") == "true" || params.value("Ready", "") == "1");
                params["isReady"] = ready;
                j["payload"] = params;
            } else if (cmdName == "CREATE_ROOM") {
                j["event"] = "create_room";
                
                // Extract parameters
                std::string roomId = params.value("RoomID", "room_" + std::to_string(std::rand() % 10000));
                std::string roomName = params.value("RoomName", "");
                std::string playerName = params.value("PlayerName", "");
                std::string deviceId = params.value("DeviceID", "");
                
                // Create player object
                json player = json::object();
                player["id"] = deviceId;
                player["name"] = playerName;
                player["isReady"] = false;
                player["connected"] = true;
                player["playerType"] = "beagleboard";
                
                // Create room object
                json room = json::object();
                room["id"] = roomId;
                room["name"] = roomName;
                room["maxPlayers"] = 4;
                room["status"] = "waiting";
                room["hostId"] = deviceId;
                
                // Add player to room's players array
                json players = json::array();
                players.push_back(player);
                room["players"] = players;
                
                // Create proper payload format expected by the server
                json payload = json::object();
                payload["room"] = room;
                
                j["payload"] = payload;
                
                std::cout << "Formatted create_room request: " << j.dump() << std::endl;
            } else {
                // Default mapping
                j["event"] = commandToEventName(cmdName);
                j["payload"] = params;
            }
            jsonMessage = j.dump();
        } else {
            // Invalid command format
            std::cerr << "Invalid BeagleBoard command format: " << message << std::endl;
            return false;
        }
    } else {
        // Parse command format and convert to JSON
        size_t pipePos = message.find('|');
        std::string command = message;
        std::string payload = "{}";
        
        if (pipePos != std::string::npos) {
            command = message.substr(0, pipePos);
            payload = parseCommandPayload(message.substr(pipePos + 1));
        }
        
        // Convert to camelCase command for server (e.g., JOINROOM -> join_room)
        std::string eventName = commandToEventName(command);
        
        // Create JSON message
        json j;
        j["event"] = eventName;
        j["payload"] = json::parse(payload);
        jsonMessage = j.dump();
    }
    
    // Determine if this is a high-priority message - Now ALL WebSocket command messages are high priority
    bool isRoomList = false;
    
    // Detect specific event types for specialized handling
    if (jsonMessage.find("\"event\":\"room_list\"") != std::string::npos) {
        isRoomList = true;
    }
    
    // Queue management - optimize for room_list requests
    {
        std::lock_guard<std::mutex> lock(queueMutex);
        
        // Special handling for room_list to prevent queue build-up
        if (isRoomList) {
            // Always clear previous room_list requests to avoid backlog
            std::queue<std::string> filteredQueue;
            while (!messageQueue.empty()) {
                std::string msg = messageQueue.front();
                messageQueue.pop();
                
                // Keep all messages except room_list
                if (msg.find("\"event\":\"room_list\"") == std::string::npos) {
                    filteredQueue.push(msg);
                }
            }
            
            messageQueue = filteredQueue;
        }
        
        // Add current message to queue
        messageQueue.push(jsonMessage);
    }
    
    // Request immediate processing for this message
    if (wsi) {
        // Activate aggressive service mode for faster processing for ALL commands
        needsAggressiveService = true;
        aggressiveServiceCount = 200; // Increase aggressive service count for all messages
        
        // Use highest priority for callback
        lws_callback_on_writable_all_protocol(lws_get_context(wsi), 
                                           lws_get_protocol(wsi));
        
        // Force service thread to wake up immediately
        wakeServiceThread();
        
        // For specific commands, use most aggressive processing
        if (isRoomList || 
            jsonMessage.find("\"event\":\"create_room\"") != std::string::npos || 
            jsonMessage.find("\"event\":\"leave_room\"") != std::string::npos ||
            jsonMessage.find("\"event\":\"join_room\"") != std::string::npos ||
            jsonMessage.find("\"event\":\"player_ready\"") != std::string::npos) {
            
            // Call lws_service directly here for faster processing of priority messages
            lws_service(lws_get_context(wsi), 0);
            
            // Also force another callback to ensure message is processed
            lws_callback_on_writable(wsi);
        }
    }
    
    return true;
}

void WebSocketClient::setMessageCallback(std::function<void(const std::string&)> callback) {
    messageCallback = callback;
}

// Helper method to parse command payload into JSON
std::string WebSocketClient::parseCommandPayload(const std::string& payload) {
    json j = json::object();
    
    size_t start = 0;
    size_t end = payload.find('|');
    
    while (start < payload.length()) {
        std::string param = payload.substr(start, (end == std::string::npos) ? end : end - start);
        size_t colonPos = param.find(':');
        
        if (colonPos != std::string::npos) {
            std::string key = param.substr(0, colonPos);
            std::string value = param.substr(colonPos + 1);
            
            // Map BeagleBoard keys to server expected keys
            if (key == "RoomID" || key == "roomId") {
                key = "roomId";
            } else if (key == "DeviceID" || key == "playerId") {
                key = "playerId";
            } else if (key == "PlayerName" || key == "playerName") {
                key = "playerName";
            } else if (key == "isReady") {
                key = "isReady";
                // Convert string to boolean
                value = (value == "true" || value == "1") ? "true" : "false";
            }
            
            j[key] = value;
        }
        
        if (end == std::string::npos) break;
        start = end + 1;
        end = payload.find('|', start);
    }
    
    return j.dump();
}

// Helper method to convert command to event name
std::string WebSocketClient::commandToEventName(const std::string& command) {
    if (command == "LISTROOMS") {
        return "room_list";
    } else if (command == "JOIN" || command == "JOINROOM") {
        return "join_room";
    } else if (command == "LEAVE" || command == "LEAVEROOM") {
        return "leave_room";
    } else if (command == "READY" || command == "NOTREADY") {
        return "player_ready";
    } else if (command == "GESTURE") {
        return "gesture_event";
    } else if (command == "CREATE" || command == "CREATEROOM") {
        return "create_room";
    }
    
    // Default: convert to lowercase with underscores
    std::string result;
    for (char c : command) {
        if (c == '_') {
            result += '_';
        } else {
            result += std::tolower(c);
        }
    }
    return result;
}

// Add a method to wake up the service thread
void WebSocketClient::wakeServiceThread() {
    {
        std::lock_guard<std::mutex> lock(wakeMutex);
        wakeRequested = true;
    }
    wakeCV.notify_all();
}

void WebSocketClient::onMessageReceived(const std::string& message) {
    // Log all incoming messages to debug server communication
    std::cout << "RAW WEBSOCKET MESSAGE: " << message.substr(0, 100);
    if (message.length() > 100) {
        std::cout << "... (" << message.length() << " bytes total)";
    }
    std::cout << std::endl;
    
    // Special check for round_start messages
    if (message.find("\"event\":\"round_start\"") != std::string::npos) {
        std::cout << "\n[WebSocketClient.cpp] *** DETECTED round_start EVENT in onMessageReceived! ***" << std::endl;
        std::cout << "[WebSocketClient.cpp] Message size: " << message.length() << " bytes" << std::endl;
        
        // Log the first part of the payload to help with debugging
        size_t payloadStart = message.find("\"payload\"");
        if (payloadStart != std::string::npos) {
            std::string payloadPreview = message.substr(payloadStart, 200);
            std::cout << "[WebSocketClient.cpp] Payload preview: " << payloadPreview << "..." << std::endl;
        }
        
        std::cout << "[WebSocketClient.cpp] *** END OF round_start EVENT DEBUG ***\n" << std::endl;
    }
    
    // Pass to message handlers
    if (messageCallback) {
        messageCallback(message);
    }
}

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
                
                // Enable ping/pong to keep connection alive
                lws_set_timer_usecs(wsi, 30 * 1000 * 1000); // 30 second ping interval
            }
            break;
        }
        
        case LWS_CALLBACK_CLIENT_RECEIVE: {
            if (client && in && len > 0) {
                // Process received data
                const char *data = static_cast<const char*>(in);
                std::string message(data, len);
                
                // Add debugging to track message fragments, especially for round_start events
                std::cout << "[WebSocketClient.cpp] Received fragment, size: " << len << " bytes, first 40 chars: " 
                          << message.substr(0, std::min(size_t(40), message.length()));
                if (message.length() > 40) std::cout << "...";
                std::cout << std::endl;
                
                // Special detection for round_start events in fragments
                if (message.find("\"event\":\"round_start\"") != std::string::npos) {
                    std::cout << "\n[WebSocketClient.cpp] !!! ROUND_START EVENT DETECTED IN FRAGMENT !!!\n" << std::endl;
                }
                
                // Check if message is complete (final fragment)
                bool isFinal = lws_is_final_fragment(wsi);
                std::cout << "[WebSocketClient.cpp] Is final fragment: " << (isFinal ? "true" : "false") << std::endl;
                
                clientData->receivedData.append(message);
                
                // Log accumulated data size
                std::cout << "[WebSocketClient.cpp] Accumulated data size: " << clientData->receivedData.length() << " bytes" << std::endl;
                
                if (isFinal) {
                    // Special check for round_start in complete message
                    if (clientData->receivedData.find("\"event\":\"round_start\"") != std::string::npos) {
                        std::cout << "\n[WebSocketClient.cpp] *** COMPLETE ROUND_START EVENT ASSEMBLED, length: " 
                                  << clientData->receivedData.length() << " bytes ***\n" << std::endl;
                        
                        // Print payload size to check if it's being truncated
                        size_t payloadPos = clientData->receivedData.find("\"payload\"");
                        if (payloadPos != std::string::npos) {
                            std::cout << "[WebSocketClient.cpp] Payload position: " << payloadPos 
                                      << ", remaining bytes: " << clientData->receivedData.length() - payloadPos << std::endl;
                        }
                    }
                    
                    // Process the complete message
                    if (client->messageCallback) {
                        std::cout << "[WebSocketClient.cpp] Calling message callback with complete message" << std::endl;
                        // Call user's message handler
                        client->messageCallback(clientData->receivedData);
                    } else {
                        std::cerr << "[WebSocketClient.cpp] WARNING: No message callback set!" << std::endl;
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
        
        case LWS_CALLBACK_TIMER: {
            // Send a ping when the timer fires
            std::cout << "[WebSocketClient.cpp] Sending ping to keep connection alive" << std::endl;
            
            // Schedule another timer event in 30 seconds
            lws_set_timer_usecs(wsi, 30 * 1000 * 1000); // 30 second ping interval
            
            // Send a ping frame
            unsigned char pingData[LWS_PRE + 16];
            memset(pingData, 0, sizeof(pingData));
            lws_write(wsi, &pingData[LWS_PRE], 0, LWS_WRITE_PING);
            
            return 0;
        }
        
        case LWS_CALLBACK_CLIENT_RECEIVE_PONG: {
            // Just log pong receipt for debugging
            std::cout << "[WebSocketClient.cpp] Received pong from server" << std::endl;
            return 0;
        }
        
        default:
            break;
    }
    
    return 0;
} 