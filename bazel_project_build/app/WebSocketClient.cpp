#include "WebSocketClient.h"
#include <iostream>
#include <cstring>
#include <sstream>
#include <vector>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

// Per-session data
struct ClientData {
    WebSocketClient* client;
    std::string receivedData;
};

// Define protocol callback function separately
static int protocol_callback(struct lws *wsi, enum lws_callback_reasons reason, 
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
            }
            break;
        }
        
        case LWS_CALLBACK_CLIENT_RECEIVE: {
            if (client && in && len > 0) {
                // Append received data
                const char *data = static_cast<const char*>(in);
                std::string message(data, len);
                
                // Check if message is complete (final fragment)
                bool isFinal = lws_is_final_fragment(wsi);
                clientData->receivedData.append(message);
                
                if (isFinal) {
                    // Process the complete message
                    if (client->messageCallback) {
                        client->messageCallback(clientData->receivedData);
                    }
                    clientData->receivedData.clear();
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
        
        case LWS_CALLBACK_CLIENT_WRITEABLE: {
            if (client) {
                // If we have messages to send, send them
                std::string message;
                {
                    std::lock_guard<std::mutex> lock(client->queueMutex);
                    if (!client->messageQueue.empty()) {
                        message = client->messageQueue.front();
                        client->messageQueue.pop();
                    }
                }
                
                if (!message.empty()) {
                    // Use a vector instead of variable-length array
                    std::vector<unsigned char> buf(LWS_SEND_BUFFER_PRE_PADDING + message.length() + LWS_SEND_BUFFER_POST_PADDING);
                    unsigned char *p = &buf[LWS_SEND_BUFFER_PRE_PADDING];
                    memcpy(p, message.c_str(), message.length());
                    
                    // Send the message
                    int n = lws_write(wsi, p, message.length(), LWS_WRITE_TEXT);
                    if (n < 0) {
                        std::cerr << "WebSocket write failed" << std::endl;
                        return -1;
                    }
                    
                    // Check if we have more messages to send
                    std::lock_guard<std::mutex> lock(client->queueMutex);
                    if (!client->messageQueue.empty()) {
                        lws_callback_on_writable(wsi);
                    }
                }
            }
            break;
        }
        
        default:
            break;
    }
    
    return 0;
}

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

WebSocketClient::WebSocketClient(const std::string& host, int port, const std::string& path, bool useTLS)
    : host(host), port(port), path(path), useTLS(useTLS), connected(false), running(false),
      context(nullptr), wsi(nullptr) {
    
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
    
    while (running) {
        // Check for connection timeout (5 seconds maximum)
        if (!connected) {
            auto now = std::chrono::steady_clock::now();
            auto elapsed = std::chrono::duration_cast<std::chrono::seconds>(now - startTime).count();
            
            if (elapsed > 5) {
                std::cerr << "WebSocket connection timed out after 5 seconds" << std::endl;
                connectionTimedOut = true;
                break;
            }
        }
        
        lws_service(context, 50); // 50ms timeout for more responsive handling
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
}

bool WebSocketClient::connect() {
    if (running) {
        return true; // Already running
    }
    
    running = true;
    clientThread = std::thread(&WebSocketClient::run, this);
    
    // Wait longer for connection to initialize to avoid race conditions
    std::this_thread::sleep_for(std::chrono::seconds(3));
    
    if (!connected) {
        std::cerr << "Failed to establish WebSocket connection within timeout" << std::endl;
        disconnect(); // Clean up the thread and resources
        return false;
    }
    
    return running && connected;
}

void WebSocketClient::disconnect() {
    running = false;
    
    if (clientThread.joinable()) {
        clientThread.join();
    }
    
    connected = false;
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
                // BeagleBoard clients are identified by the device ID format
                j["payload"] = params;
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
                std::string roomId = params.value("RoomID", "");
                std::string roomName = params.value("RoomName", "");
                std::string playerName = params.value("PlayerName", "");
                std::string playerId = params.value("playerId", "");
                
                if (playerId.empty() && params.contains("DeviceID")) {
                    playerId = params["DeviceID"];
                }
                
                // Create player object
                json player = json::object();
                player["id"] = playerId;
                player["name"] = playerName;
                player["isReady"] = false;
                player["connected"] = true;
                player["playerType"] = "beagleboard";
                
                // Create room object
                json room = json::object();
                room["id"] = roomId;
                room["name"] = roomName;
                
                // Add max players and status
                if (params.contains("MaxPlayers")) {
                    room["maxPlayers"] = std::stoi(params["MaxPlayers"].get<std::string>());
                } else {
                    room["maxPlayers"] = 2;  // Default to 2 players
                }
                
                room["status"] = "waiting";
                
                // Add player to room's players array
                json players = json::array();
                players.push_back(player);
                room["players"] = players;
                
                // Add hostId to room
                room["hostId"] = playerId;
                
                // Create proper payload format expected by the server
                json payload = json::object();
                payload["room"] = room;
                
                j["payload"] = payload;
                
                std::cout << "Creating room with payload: " << j["payload"].dump() << std::endl;
            } else {
                // Default mapping
                j["event"] = commandToEventName(cmdName);
                j["payload"] = params;
            }
            jsonMessage = j.dump();
            std::cout << "Converted BeagleBoard command to WebSocket JSON: " << jsonMessage << std::endl;
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
    
    // Queue message for sending
    std::lock_guard<std::mutex> lock(queueMutex);
    messageQueue.push(jsonMessage);
    
    // Request write callback
    if (wsi) {
        lws_callback_on_writable(wsi);
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