#include "RoomManager.h"
#include <iostream>
#include <random>
#include <sstream>
#include <algorithm>
#include <nlohmann/json.hpp>

// For convenience
using json = nlohmann::json;

// Generate a random device ID
std::string RoomManager::generateDeviceId() {
    static const char alphanum[] =
        "0123456789"
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        "abcdefghijklmnopqrstuvwxyz";
    
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> dis(0, sizeof(alphanum) - 2);
    
    std::string id = "bb_";
    for (int i = 0; i < 8; ++i) {
        id += alphanum[dis(gen)];
    }
    
    return id;
}

RoomManager::RoomManager(WebSocketClient* client)
    : client(client), receiver(nullptr), connected(false), ready(false), 
      isWaitingForResponse(false), currentRequestType("") {
    // Generate a unique device ID
    deviceId = generateDeviceId();
    std::cout << "Room Manager initialized with device ID: " << deviceId << std::endl;
}

RoomManager::~RoomManager() {
    // Ensure we're disconnected
    if (connected) {
        leaveRoom();
    }
    
    // Cleanup receiver
    if (receiver) {
        receiver->stop();
        delete receiver;
        receiver = nullptr;
    }
}

bool RoomManager::startReceiver() {
    if (!client) {
        std::cerr << "No WebSocket client available" << std::endl;
        return false;
    }
    
    receiver = new WebSocketReceiver(client);
    receiver->setMessageCallback([this](const std::string& message) {
        this->handleMessage(message);
    });
    
    return receiver->start();
}

void RoomManager::handleMessage(const std::string& message) {
    // Avoid printing every received message
    // std::cout << "Received message: " << message << std::endl;
    
    try {
        // Parse message as JSON
        json j = json::parse(message);
        
        // Handle error messages first
        if (j.contains("event") && j["event"] == "error") {
            if (j.contains("payload") && j["payload"].contains("error")) {
                std::string error = j["payload"]["error"];
                std::cerr << "Server error: " << error << std::endl;
                
                // If we get an error for create_room and we're waiting for it, reset our room ID
                if (currentRequestType == "create_room") {
                    currentRoomId = "";
                }
                
                // Reset loading state after handling the error
                resetLoadingState();
                return;
            }
        }
        
        // Check if this is a room_list event
        if (j.contains("event") && j["event"] == "room_list") {
            if (j.contains("payload") && j["payload"].contains("rooms")) {
                // Extract rooms from the payload
                parseJsonRoomList(j["payload"]["rooms"]);
                
                // Display the room list
                displayRoomList();
                
                // Reset loading state after handling the response
                resetLoadingState();
            }
        }
        else if (j.contains("event") && j["event"] == "room_updated") {
            // Check if we're in this room
            if (j.contains("payload") && j["payload"].contains("room")) {
                auto& room = j["payload"]["room"];
                
                // If this is our current room
                if (room.contains("id") && room["id"] == currentRoomId) {
                    // Check if we're in the player list
                    if (room.contains("players") && room["players"].is_array()) {
                        bool foundSelf = false;
                        for (const auto& player : room["players"]) {
                            if ((player.contains("id") && player["id"] == deviceId) ||
                                (player.contains("name") && player["name"] == playerName)) {
                                // We're in this room
                                connected = true;
                                foundSelf = true;
                                std::cout << "You're now connected to room: " << room["name"] << std::endl;
                                break;
                            }
                        }
                        
                        // If we didn't find ourselves in the player list
                        if (!foundSelf && connected) {
                            std::cout << "You're no longer in room: " << room["name"] << std::endl;
                            connected = false;
                            currentRoomId = "";
                        }
                    }
                }
                
                // If this was in response to a create_room request, reset the loading state
                if (currentRequestType == "create_room") {
                    resetLoadingState();
                }
            }
        }
        else if (j.contains("event") && j["event"] == "join_room") {
            // Handle join_room response
            if (j.contains("payload") && j["payload"].contains("roomId")) {
                std::string roomId = j["payload"]["roomId"];
                if (roomId == currentRoomId) {
                    connected = true;
                    std::cout << "Successfully joined room: " << roomId << std::endl;
                    resetLoadingState();
                }
            }
        }
        else if (j.contains("event") && j["event"] == "leave_room") {
            // Handle leave_room response - clear currentRoomId when confirmed by server
            if (currentRequestType == "leave_room") {
                currentRoomId = "";
                std::cout << "Server confirmed room exit" << std::endl;
            }
            resetLoadingState();
        }
        else if (j.contains("event") && j["event"] == "gesture_event") {
            // Handle gesture events if needed
        }
        else {
            // If the event doesn't match any of the above, still reset the loading state
            // in case it was a response to a command
            resetLoadingState();
        }
    } catch (const json::parse_error& e) {
        std::cerr << "Error parsing JSON message: " << e.what() << std::endl;
        
        // Try legacy format parsing for backwards compatibility
        if (message.find("ROOMLIST|") == 0) {
            parseRoomList(message.substr(9)); // Skip "ROOMLIST|"
            
            // Display room list for legacy format too
            displayRoomList();
            
            // Reset loading state
            resetLoadingState();
        }
        else if (message.find("JOINED|") == 0) {
            std::cout << "Successfully joined room" << std::endl;
            connected = true;
            resetLoadingState();
        }
        else if (message.find("LEFT|") == 0) {
            std::cout << "Successfully left room" << std::endl;
            connected = false;
            currentRoomId = "";
            resetLoadingState();
        }
        else if (message.find("RESPONSE:JOIN_ROOM") == 0) {
            if (message.find("status:SUCCESS") != std::string::npos) {
                std::cout << "Successfully joined room" << std::endl;
                connected = true;
            } else {
                std::cerr << "Failed to join room: " << message << std::endl;
            }
            resetLoadingState();
        }
        else if (message.find("RESPONSE:LEAVE_ROOM") == 0) {
            if (message.find("status:SUCCESS") != std::string::npos) {
                std::cout << "Successfully left room" << std::endl;
                connected = false;
                currentRoomId = "";
            }
            resetLoadingState();
        }
        else {
            // Unknown message format, still reset loading state
            resetLoadingState();
        }
    }
}

void RoomManager::parseRoomList(const std::string& response) {
    std::lock_guard<std::mutex> lock(roomsMutex);
    availableRooms.clear();
    
    std::istringstream ss(response);
    std::string roomInfo;
    
    while (std::getline(ss, roomInfo, '|')) {
        if (roomInfo.empty()) continue;
        
        // Parse room information (format: "ID:xxx|Name:xxx|Players:x/y|Status:xxx")
        Room room;
        size_t idPos = roomInfo.find("ID:");
        size_t namePos = roomInfo.find("Name:");
        size_t playersPos = roomInfo.find("Players:");
        size_t statusPos = roomInfo.find("Status:");
        
        if (idPos != std::string::npos) {
            size_t endPos = roomInfo.find("|", idPos);
            room.id = roomInfo.substr(idPos + 3, endPos - idPos - 3);
        }
        
        if (namePos != std::string::npos) {
            size_t endPos = roomInfo.find("|", namePos);
            room.name = roomInfo.substr(namePos + 5, endPos - namePos - 5);
        }
        
        if (playersPos != std::string::npos) {
            size_t endPos = roomInfo.find("|", playersPos);
            std::string playersStr = roomInfo.substr(playersPos + 8, endPos - playersPos - 8);
            
            // Parse "x/y" format
            size_t slashPos = playersStr.find("/");
            if (slashPos != std::string::npos) {
                room.playerCount = std::stoi(playersStr.substr(0, slashPos));
                room.maxPlayers = std::stoi(playersStr.substr(slashPos + 1));
            }
        }
        
        if (statusPos != std::string::npos) {
            size_t endPos = roomInfo.find("|", statusPos);
            room.status = roomInfo.substr(statusPos + 7, endPos - statusPos - 7);
        }
        
        availableRooms.push_back(room);
    }
}

bool RoomManager::fetchAvailableRooms() {
    // Create JSON message directly
    json message = json::object();
    message["event"] = "room_list";
    message["payload"] = json::object();
    
    std::string jsonMessage = message.dump();
    
    // We'll avoid displaying here as the command handler already shows a message
    return client->sendMessage(jsonMessage);
}

bool RoomManager::joinRoom(const std::string& roomId) {
    if (!client) {
        return false;
    }
    
    // Can't join a room if already in one
    if (connected) {
        std::cerr << "Already connected to a room. Leave current room first." << std::endl;
        return false;
    }
    
    // Create JSON message directly
    json payload = json::object();
    payload["roomId"] = roomId;
    payload["playerId"] = deviceId;
    payload["playerName"] = playerName;
    
    json message = json::object();
    message["event"] = "join_room";
    message["payload"] = payload;
    
    std::string jsonMessage = message.dump();
    std::cout << "Joining room " << roomId << "..." << std::endl;
    
    // Store room ID for reference - don't set connected=true yet
    // as we need server confirmation for that
    currentRoomId = roomId;
    
    return client->sendMessage(jsonMessage);
}

bool RoomManager::leaveRoom() {
    if (!client) {
        return false;
    }
    
    if (!connected) {
        return false;
    }
    
    // Create JSON message directly
    json payload = json::object();
    payload["roomId"] = currentRoomId;
    payload["playerId"] = deviceId;
    
    json message = json::object();
    message["event"] = "leave_room";
    message["payload"] = payload;
    
    std::string jsonMessage = message.dump();
    std::cout << "Leaving room " << currentRoomId << "..." << std::endl;
    
    // Mark the request as tracked so we can handle the response properly
    isWaitingForResponse = true;
    currentRequestType = "leave_room";
    lastRequestTime = std::chrono::steady_clock::now();
    
    // Set status immediately to improve user experience
    bool result = client->sendMessage(jsonMessage);
    if (result) {
        connected = false;
        std::cout << "Successfully left room" << std::endl;
        // Only clear currentRoomId after server confirmation 
        // (which will happen in handleMessage)
    }
    
    return result;
}

void RoomManager::setReady(bool isReady) {
    if (!client || !connected) {
        return;
    }
    
    ready = isReady;
    
    // Create JSON message directly
    json payload = json::object();
    payload["roomId"] = currentRoomId;
    payload["playerId"] = deviceId;
    payload["isReady"] = isReady;
    
    json message = json::object();
    message["event"] = "player_ready";
    message["payload"] = payload;
    
    std::string jsonMessage = message.dump();
    
    client->sendMessage(jsonMessage);
}

bool RoomManager::sendGestureData(const std::string& gestureData) {
    if (!client || !connected) {
        return false;
    }

    // Keep the GESTURE command format as it's expected by the server
    std::string cmd = "GESTURE|DeviceID:" + deviceId + 
                     "|RoomID:" + currentRoomId + 
                     "|" + gestureData;
    
    return client->sendMessage(cmd);
}

const std::vector<Room> RoomManager::getAvailableRooms() const {
    std::lock_guard<std::mutex> lock(const_cast<std::mutex&>(roomsMutex));
    return availableRooms;
}

// Add new method to parse JSON room list
void RoomManager::parseJsonRoomList(const json& roomsArray) {
    std::lock_guard<std::mutex> lock(roomsMutex);
    availableRooms.clear();
    
    if (roomsArray.is_array()) {
        for (const auto& roomJson : roomsArray) {
            // Initialize all fields to ensure no garbage values
            Room room;
            room.id = "";
            room.name = "";
            room.playerCount = 0;
            room.maxPlayers = 0;
            room.status = "";
            
            // Extract required fields
            if (roomJson.contains("id")) room.id = roomJson["id"];
            if (roomJson.contains("name")) room.name = roomJson["name"];
            if (roomJson.contains("status")) room.status = roomJson["status"];
            
            // Extract player count - use playerCount field if available (server filtered count)
            if (roomJson.contains("playerCount")) {
                try {
                    room.playerCount = roomJson["playerCount"];
                } catch (...) {
                    room.playerCount = 0;
                }
            } else if (roomJson.contains("players") && roomJson["players"].is_array()) {
                // If no playerCount field, count BeagleBoard players manually
                int count = 0;
                for (const auto& player : roomJson["players"]) {
                    if (player.contains("playerType") && player["playerType"] == "beagleboard") {
                        count++;
                    }
                }
                room.playerCount = count;
            }
            
            if (roomJson.contains("maxPlayers")) {
                try {
                    room.maxPlayers = roomJson["maxPlayers"];
                } catch (...) {
                    room.maxPlayers = 2; // Default value
                }
            }
            
            availableRooms.push_back(room);
        }
    }
}

void RoomManager::displayRoomList() {
    std::lock_guard<std::mutex> lock(roomsMutex);
    
    if (availableRooms.empty()) {
        std::cout << "No rooms available." << std::endl;
    } else {
        std::cout << "Available rooms:" << std::endl;
        for (const auto& room : availableRooms) {
            std::cout << "  ID: " << room.id << " | Name: " << room.name 
                      << " | Players: " << room.playerCount << "/" << room.maxPlayers 
                      << " | Status: " << room.status << std::endl;
        }
    }
}

bool RoomManager::createRoom(const std::string& roomName) {
    if (!client) {
        return false;
    }
    
    // Can't create a room if already in one
    if (connected) {
        std::cerr << "Already connected to a room. Leave current room first." << std::endl;
        return false;
    }
    
    // Check if player name is set
    if (playerName.empty()) {
        std::cerr << "Player name is not set. Please use 'setname' command first." << std::endl;
        return false;
    }
    
    // Generate a random room ID
    std::string roomId = "BB_";
    static const char alphanum[] =
        "0123456789"
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> dis(0, sizeof(alphanum) - 2);
    
    for (int i = 0; i < 5; ++i) {
        roomId += alphanum[dis(gen)];
    }
    
    // Store the intended room ID before sending the request
    currentRoomId = roomId;
    
    // Use JSON message format directly
    json room = json::object();
    room["id"] = roomId;
    room["name"] = roomName;
    room["maxPlayers"] = 2;
    room["status"] = "waiting";
    room["hostId"] = deviceId;
    
    // Create player object
    json player = json::object();
    player["id"] = deviceId;
    player["name"] = playerName;
    player["isReady"] = false;
    player["connected"] = true;
    player["playerType"] = "beagleboard";
    
    // Add player to room
    json players = json::array();
    players.push_back(player);
    room["players"] = players;
    
    // Create payload
    json payload = json::object();
    payload["room"] = room;
    
    // Create final message
    json message = json::object();
    message["event"] = "create_room";
    message["payload"] = payload;
    
    std::string jsonMessage = message.dump();
    std::cout << "Creating room with payload: " << payload.dump() << std::endl;
    
    return client->sendMessage(jsonMessage);
}

void RoomManager::resetLoadingState() {
    isWaitingForResponse = false;
    currentRequestType = "";
}

bool RoomManager::sendMessageWithTracking(const std::string& message, const std::string& requestType) {
    if (!client) {
        return false;
    }
    
    // Check if we're already waiting for a response
    if (isWaitingForResponse) {
        // Check if it's been more than 5 seconds since the last request
        auto now = std::chrono::steady_clock::now();
        auto elapsed = std::chrono::duration_cast<std::chrono::seconds>(
            now - lastRequestTime).count();
            
        if (elapsed < 5) {
            std::cout << "Still waiting for response to " << currentRequestType 
                      << " (sent " << elapsed << " seconds ago)..." << std::endl;
            return false;
        }
        
        // If it's been more than 5 seconds, assume the request timed out
        std::cout << "Previous request (" << currentRequestType << ") timed out." << std::endl;
        resetLoadingState();
    }
    
    // Set loading state
    isWaitingForResponse = true;
    currentRequestType = requestType;
    lastRequestTime = std::chrono::steady_clock::now();
    
    // Send the message
    return client->sendMessage(message);
} 