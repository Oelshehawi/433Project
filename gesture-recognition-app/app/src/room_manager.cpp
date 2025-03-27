#include "room_manager.h"
#include <iostream>
#include <sstream>
#include <nlohmann/json.hpp>
#include <unistd.h>
#include <cstring>

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
    deviceId = generateUniqueDeviceId();
    
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

std::string RoomManager::generateUniqueDeviceId() {
    // Try to get hostname as base for ID
    char hostname[128];
    if (gethostname(hostname, sizeof(hostname)) != 0) {
        strcpy(hostname, "beagleboard");
    }
    
    // Add some randomness to ensure uniqueness
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> distrib(1000, 9999);
    
    return std::string(hostname) + "-" + std::to_string(distrib(gen));
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

std::string RoomManager::formatCommand(const std::string& command, 
                                     const std::map<std::string, std::string>& params) {
    std::string msg = "CMD:" + command + "|DeviceID:" + deviceId;
    
    for (const auto& param : params) {
        msg += "|" + param.first + ":" + param.second;
    }
    
    return msg;
}

std::string RoomManager::sendCommand(const std::string& command, 
                                   const std::map<std::string, std::string>& params) {
    // Format the command message
    std::string message = formatCommand(command, params);
    
    // Send message
    udpSender->sendMessage(message);
    
    // In a real implementation, we would wait for a response from the server
    // For now, just return a placeholder
    return "SUCCESS";
}

bool RoomManager::fetchAvailableRooms() {
    requestRoomList();
    
    // In a real implementation, we would parse the actual response
    // For this demonstration, we'll create mock data
    availableRooms.clear();
    
    // Mock data - in real implementation, this would come from the server
    availableRooms.push_back({"room1", "Game Room 1", 1, 2, "waiting"});
    availableRooms.push_back({"room2", "Game Room 2", 0, 2, "waiting"});
    
    return true;
}

void RoomManager::requestRoomList() {
    sendCommand("LIST_ROOMS");
    std::cout << "Requested room list from server" << std::endl;
}

const std::vector<Room>& RoomManager::getAvailableRooms() const {
    return availableRooms;
}

bool RoomManager::joinRoom(const std::string& roomId) {
    if (playerName.empty()) {
        std::cerr << "Player name not set. Please set a player name before joining a room." << std::endl;
        return false;
    }
    
    std::map<std::string, std::string> params = {
        {"RoomID", roomId},
        {"PlayerName", playerName}
    };
    
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
    
    std::map<std::string, std::string> params = {
        {"RoomID", currentRoomId}
    };
    
    std::string response = sendCommand("LEAVE_ROOM", params);
    
    // In a real implementation, we would check the actual response
    // For this demonstration, we'll assume it succeeded
    std::string oldRoomId = currentRoomId;
    currentRoomId = "";
    
    std::cout << "Left room: " << oldRoomId << std::endl;
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

std::string RoomManager::formatGestureDetection(const std::string& gesture, float confidence) {
    // Format the gesture data as JSON
    std::stringstream gestureJson;
    gestureJson << "{\"gesture\":\"" << gesture << "\","
                << "\"confidence\":" << confidence << "}";
    
    return formatGestureMessage(gestureJson.str());
}

bool RoomManager::sendGestureDetection(const std::string& gesture, float confidence) {
    if (!isConnected()) {
        std::cout << "Not in a room, gesture ignored" << std::endl;
        return false;
    }
    
    std::string message = formatGestureDetection(gesture, confidence);
    udpSender->sendMessage(message);
    std::cout << "Sent gesture detection: " << gesture << " (confidence: " << confidence << ")" << std::endl;
    return true;
}

void RoomManager::sendHello() {
    sendCommand("HELLO");
    std::cout << "Sent hello message with Device ID: " << deviceId << std::endl;
} 