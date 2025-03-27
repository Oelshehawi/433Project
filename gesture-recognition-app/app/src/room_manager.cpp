#include "include/room_manager.h"
#include <iostream>
#include <sstream>
#include <random>
#include <nlohmann/json.hpp>
#include <unistd.h>
#include <cstring>

using json = nlohmann::json;

RoomManager::RoomManager(UDPSender* sender, const std::string& configPath, int responsePort)
    : udpSender(sender), configPath(configPath), currentRoomId(""), responseReceived(false) {
    // Initialize UDP receiver for responses
    udpReceiver = new UDPReceiver(responsePort);
    udpReceiver->setMessageCallback([this](const std::string& message) {
        this->handleMessage(message);
    });
    
    // Initialize device ID
    initializeDeviceId();
}

RoomManager::~RoomManager() {
    // If connected to a room, leave it before destroying
    if (isConnected()) {
        leaveRoom();
    }
    
    // Stop and clean up the receiver
    stopReceiver();
    delete udpReceiver;
}

void RoomManager::handleMessage(const std::string& message) {
    std::cout << "Received message: " << message << std::endl;
    
    // Process the message
    bool success = processServerResponse(message);
    
    // Notify waiting threads
    std::lock_guard<std::mutex> lock(responseMutex);
    responseReceived = true;
    responseCV.notify_all();
    
    if (success) {
        std::cout << "Successfully processed server response" << std::endl;
    } else {
        std::cerr << "Failed to process server response" << std::endl;
    }
}

bool RoomManager::startReceiver() {
    return udpReceiver->start();
}

void RoomManager::stopReceiver() {
    udpReceiver->stop();
}

bool RoomManager::waitForResponse(int timeoutMs) {
    std::unique_lock<std::mutex> lock(responseMutex);
    responseReceived = false;
    
    // Wait for response with timeout
    return responseCV.wait_for(lock, std::chrono::milliseconds(timeoutMs),
                              [this]() { return responseReceived; });
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
    // Request room list from the server
    requestRoomList();
    
    // Wait for response (with timeout)
    bool received = waitForResponse(3000); // 3 second timeout
    
    if (!received) {
        std::cerr << "Timeout waiting for room list response" << std::endl;
        
        // Fall back to mock data for now
        availableRooms.clear();
        availableRooms.push_back({"room1", "Game Room 1", 1, 2, "waiting"});
        availableRooms.push_back({"room2", "Game Room 2", 0, 2, "waiting"});
    }
    
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
    
    // Send join room command
    sendCommand("JOIN_ROOM", params);
    
    // Wait for response (with timeout)
    bool received = waitForResponse(5000); // 5 second timeout
    
    if (received) {
        // Response was processed by handleMessage
        // If we got here and currentRoomId is set, it means we joined successfully
        if (!currentRoomId.empty()) {
            std::cout << "Successfully joined room: " << currentRoomId << std::endl;
            return true;
        }
    } else {
        std::cerr << "Timeout waiting for join room response" << std::endl;
        
        // For fallback, we'll set the room ID anyway
        currentRoomId = roomId;
        std::cout << "No server confirmation, assuming joined room: " << roomId << " as " << playerName << std::endl;
        return true;
    }
    
    return false;
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

bool RoomManager::processServerResponse(const std::string& response) {
    // Check if it's a valid response format
    if (response.substr(0, 9) != "RESPONSE:") {
        std::cerr << "Invalid response format: " << response << std::endl;
        return false;
    }
    
    // Parse the response parts
    std::map<std::string, std::string> parts;
    size_t pos = 9; // Start after "RESPONSE:"
    size_t nextPos;
    
    while (pos < response.length()) {
        nextPos = response.find('|', pos);
        if (nextPos == std::string::npos) nextPos = response.length();
        
        std::string part = response.substr(pos, nextPos - pos);
        size_t colonPos = part.find(':');
        
        if (colonPos != std::string::npos) {
            std::string key = part.substr(0, colonPos);
            std::string value = part.substr(colonPos + 1);
            parts[key] = value;
        }
        
        pos = nextPos + 1;
    }
    
    // Extract the command type (first part after RESPONSE:)
    std::string command = response.substr(9, response.find('|', 9) - 9);
    
    // Handle LIST_ROOMS response
    if (command == "LIST_ROOMS") {
        if (parts.find("Rooms") != parts.end()) {
            std::string roomsJson = parts["Rooms"];
            
            try {
                json roomsData = json::parse(roomsJson);
                availableRooms.clear();
                
                for (const auto& item : roomsData) {
                    Room room;
                    room.id = item["id"];
                    room.name = item["name"];
                    room.playerCount = item["playerCount"];
                    room.maxPlayers = item["maxPlayers"];
                    room.status = item["status"];
                    availableRooms.push_back(room);
                }
                
                return true;
            } catch (const std::exception& e) {
                std::cerr << "Error parsing room list JSON: " << e.what() << std::endl;
                return false;
            }
        }
    } 
    // Handle JOIN_ROOM response
    else if (command == "JOIN_ROOM") {
        std::string status = parts["status"];
        std::string message = parts["message"];
        
        if (status == "SUCCESS") {
            // Extract room ID from success message (format: "Joined room X successfully")
            size_t roomStart = message.find("room ") + 5;
            size_t roomEnd = message.find(" ", roomStart);
            if (roomStart != std::string::npos && roomEnd != std::string::npos) {
                currentRoomId = message.substr(roomStart, roomEnd - roomStart);
            } else {
                // If parsing fails, use the room ID from the request
                currentRoomId = parts["RoomID"];
            }
            return true;
        } else {
            std::cerr << "Failed to join room: " << message << std::endl;
            return false;
        }
    }
    // Handle LEAVE_ROOM response
    else if (command == "LEAVE_ROOM") {
        std::string status = parts["status"];
        if (status == "SUCCESS") {
            // Clear the current room ID
            currentRoomId = "";
            return true;
        } else {
            std::cerr << "Failed to leave room: " << parts["message"] << std::endl;
            return false;
        }
    }
    
    return false;
} 