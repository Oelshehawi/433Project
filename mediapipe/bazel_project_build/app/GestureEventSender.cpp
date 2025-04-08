#include "GestureEventSender.h"
#include <iostream>

GestureEventSender::GestureEventSender(RoomManager* roomManager, const std::string& deviceId, const std::string& roomId)
    : roomManager(roomManager), deviceId(deviceId), currentRoomId(roomId) {
}

GestureEventSender::~GestureEventSender() {
    // Nothing to clean up
}

void GestureEventSender::setCurrentRoomId(const std::string& roomId) {
    currentRoomId = roomId;
}

bool GestureEventSender::sendGesture(const std::string& gestureType, float confidence) {
    if (!roomManager) {
        std::cerr << "Cannot send gesture: RoomManager is not set" << std::endl;
        return false;
    }
    
    // Create the gesture payload
    json payload = createGesturePayload(gestureType, confidence);
    
    // Convert to string and send
    std::string jsonStr = payload.dump();
    
    std::cout << "Sending gesture event: " << jsonStr << std::endl;
    return roomManager->sendGestureData(jsonStr);
}

json GestureEventSender::createGesturePayload(const std::string& gestureType, float confidence) {
    // Create JSON message using modern format
    json payload = json::object();
    payload["playerId"] = deviceId;
    payload["roomId"] = currentRoomId;
    payload["gesture"] = gestureType;
    payload["confidence"] = confidence;
    
    return payload;
} 