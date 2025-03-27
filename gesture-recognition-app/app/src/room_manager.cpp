#include "room_manager.h"
#include <iostream>
#include <sstream>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

RoomManager::RoomManager(UDPSender* sender, const std::string& configPath)
    : udpSender(sender), configPath(configPath), currentRoomId("") {
    initializeDeviceId();
}

RoomManager::~RoomManager() {
    // If connected to a room, leave it before destroying
    if (isConnected()) {
        leaveRoom();
    }
}

void RoomManager::initializeDeviceId() {
    // Try to load device ID from config file
    std::ifstream configFile(configPath);
    if (configFile.is_open()) {
        configFile >> deviceId;
        configFile.close();
        
        if (!deviceId.empty()) {
            std::cout << "Loaded device ID: " << deviceId << std::endl;
            return;
        }
    }
    
    // Generate a new device ID if not found
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> dis(0, 15);
    
    const char* hexChars = "0123456789abcdef";
    std::stringstream ss;
    
    // Format: beagle-xxxx-xxxx-xxxx
    ss << "beagle-";
    for (int i = 0; i < 12; ++i) {
        if (i % 4 == 0 && i > 0) ss << "-";
        ss << hexChars[dis(gen)];
    }
    
    deviceId = ss.str();
    
    // Save the device ID to config file
    std::ofstream outFile(configPath);
    if (outFile.is_open()) {
        outFile << deviceId;
        outFile.close();
        std::cout << "Generated and saved new device ID: " << deviceId << std::endl;
    } else {
        std::cerr << "Failed to save device ID to config file" << std::endl;
    }
}

std::string RoomManager::getDeviceId() const {
    return deviceId;
}

void RoomManager::setPlayerName(const std::string& name) {
    playerName = name;
}

std::string RoomManager::getPlayerName() const {
    return playerName;
}

std::string RoomManager::sendCommand(const std::string& command, const std::string& params) {
    // Format: CMD:<command>|DeviceID:<device_id>|<params>
    std::string message = "CMD:" + command + "|DeviceID:" + deviceId;
    if (!params.empty()) {
        message += "|" + params;
    }
    
    // Send message and wait for response
    udpSender->sendMessage(message);
    
    // In a real implementation, we would wait for a response from the server
    // For now, just return a placeholder
    return "SUCCESS";
}

bool RoomManager::fetchAvailableRooms() {
    std::string response = sendCommand("LIST_ROOMS", "");
    
    // In a real implementation, we would parse the actual response
    // For this demonstration, we'll create mock data
    availableRooms.clear();
    
    // Mock data - in real implementation, this would come from the server
    availableRooms.push_back({"room1", "Game Room 1", 1, 2, "waiting"});
    availableRooms.push_back({"room2", "Game Room 2", 0, 2, "waiting"});
    
    return true;
}

const std::vector<Room>& RoomManager::getAvailableRooms() const {
    return availableRooms;
}

bool RoomManager::joinRoom(const std::string& roomId) {
    if (playerName.empty()) {
        std::cerr << "Player name not set. Please set a player name before joining a room." << std::endl;
        return false;
    }
    
    std::string params = "RoomID:" + roomId + "|PlayerName:" + playerName;
    std::string response = sendCommand("JOIN_ROOM", params);
    
    // In a real implementation, we would check the actual response
    // For this demonstration, we'll assume it succeeded
    currentRoomId = roomId;
    
    std::cout << "Joined room: " << roomId << " as " << playerName << std::endl;
    return true;
}

bool RoomManager::leaveRoom() {
    if (!isConnected()) {
        return false;
    }
    
    std::string params = "RoomID:" + currentRoomId;
    std::string response = sendCommand("LEAVE_ROOM", params);
    
    // In a real implementation, we would check the actual response
    // For this demonstration, we'll assume it succeeded
    currentRoomId = "";
    
    std::cout << "Left room" << std::endl;
    return true;
}

std::string RoomManager::getCurrentRoomId() const {
    return currentRoomId;
}

bool RoomManager::isConnected() const {
    return !currentRoomId.empty();
}

std::string RoomManager::formatGestureMessage(const std::string& gestureData) {
    if (!isConnected()) {
        return gestureData; // If not connected to a room, just return original data
    }
    
    // Format: GESTURE|DeviceID:<device_id>|RoomID:<room_id>|<original_gesture_data>
    return "GESTURE|DeviceID:" + deviceId + "|RoomID:" + currentRoomId + "|" + gestureData;
} 