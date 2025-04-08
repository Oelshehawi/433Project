#pragma once

#include <string>
#include "WebSocketClient.h"
#include "RoomManager.h"
#include <nlohmann/json.hpp>

// Forward declarations
class RoomManager;

// For convenience
using json = nlohmann::json;

class GestureEventSender {
private:
    RoomManager* roomManager;
    std::string deviceId;
    std::string currentRoomId;

public:
    GestureEventSender(RoomManager* roomManager, const std::string& deviceId, const std::string& roomId);
    ~GestureEventSender();
    
    // Update room ID
    void setCurrentRoomId(const std::string& roomId);
    
    // Send a gesture event to the server
    bool sendGesture(const std::string& gestureType, float confidence);
    
    // Create a gesture payload
    json createGesturePayload(const std::string& gestureType, float confidence);
}; 