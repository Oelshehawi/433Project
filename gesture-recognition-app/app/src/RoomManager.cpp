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
    : client(client), receiver(nullptr), connected(false), ready(false) {
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
        
        // Check if this is a room_list event
        if (j.contains("event") && j["event"] == "room_list") {
            if (j.contains("payload") && j["payload"].contains("rooms")) {
                // Extract rooms from the payload
                parseJsonRoomList(j["payload"]["rooms"]);
            }
        }
        else if (j.contains("event") && j["event"] == "room_updated") {
            std::cout << "Room updated event received" << std::endl;
            
            // Check if we're in this room
            if (j.contains("payload") && j["payload"].contains("room")) {
                auto& room = j["payload"]["room"];
                
                // If this is our current room
                if (room.contains("id") && (currentRoomId == room["id"] || currentRoomId.empty())) {
                    // Check if we're in the player list
                    if (room.contains("players") && room["players"].is_array()) {
                        for (const auto& player : room["players"]) {
                            if (player.contains("id") && player["id"] == deviceId) {
                                // We're in this room
                                connected = true;
                                currentRoomId = room["id"];
                                std::cout << "You're now connected to room: " << room["name"] << std::endl;
                                break;
                            }
                        }
                    }
                }
            }
        }
        else if (j.contains("event") && j["event"] == "gesture_event") {
            // Handle gesture events if needed
        }
    } catch (const json::parse_error& e) {
        std::cerr << "Error parsing JSON message: " << e.what() << std::endl;
        
        // Try legacy format parsing for backwards compatibility
        if (message.find("ROOMLIST|") == 0) {
            parseRoomList(message.substr(9)); // Skip "ROOMLIST|"
        }
        else if (message.find("JOINED|") == 0) {
            std::cout << "Successfully joined room" << std::endl;
            connected = true;
        }
        else if (message.find("LEFT|") == 0) {
            std::cout << "Successfully left room" << std::endl;
            connected = false;
            currentRoomId = "";
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
    if (!client) {
        return false;
    }
    
    std::string cmd = "LISTROOMS|DeviceID:" + deviceId;
    return client->sendMessage(cmd);
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
    
    std::string cmd = "JOINROOM|roomId:" + roomId + 
                     "|playerName:" + playerName + 
                     "|playerId:" + deviceId;
    
    if (client->sendMessage(cmd)) {
        currentRoomId = roomId;
        return true;
    }
    
    return false;
}

bool RoomManager::leaveRoom() {
    if (!client) {
        return false;
    }
    
    if (!connected) {
        return false;
    }
    
    std::string cmd = "LEAVEROOM|roomId:" + currentRoomId;
    
    return client->sendMessage(cmd);
}

void RoomManager::setReady(bool isReady) {
    if (!client || !connected) {
        return;
    }
    
    ready = isReady;
    
    std::string cmd = "READY|roomId:" + currentRoomId + 
                     "|playerId:" + deviceId + 
                     "|isReady:" + (isReady ? "true" : "false");
    
    client->sendMessage(cmd);
}

bool RoomManager::sendGestureData(const std::string& gestureData) {
    if (!client || !connected) {
        return false;
    }

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
void RoomManager::parseJsonRoomList(const json& roomsJson) {
    std::lock_guard<std::mutex> lock(roomsMutex);
    availableRooms.clear();
    
    if (!roomsJson.is_array()) {
        return;
    }
    
    for (const auto& roomJson : roomsJson) {
        Room room;
        
        if (roomJson.contains("id")) {
            room.id = roomJson["id"];
        }
        
        if (roomJson.contains("name")) {
            room.name = roomJson["name"];
        }
        
        if (roomJson.contains("playerCount")) {
            room.playerCount = roomJson["playerCount"];
        }
        
        if (roomJson.contains("maxPlayers")) {
            room.maxPlayers = roomJson["maxPlayers"];
        }
        
        if (roomJson.contains("status")) {
            room.status = roomJson["status"];
        }
        
        availableRooms.push_back(room);
    }
} 