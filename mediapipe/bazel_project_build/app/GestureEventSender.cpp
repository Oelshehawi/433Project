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

bool GestureEventSender::sendGesture(const std::string& gestureType, float confidence, const std::string& cardId) {
    if (!roomManager) {
        std::cerr << "[GestureEventSender.cpp] Cannot send gesture: RoomManager is not set" << std::endl;
        return false;
    }
    
    // Create the gesture payload
    json payload = createGesturePayload(gestureType, confidence, cardId);
    
    // Convert to string and send
    std::string jsonStr = payload.dump();
    
    std::cout << "[GestureEventSender.cpp] Sending gesture event: " << jsonStr << std::endl;
    return roomManager->sendGestureData(jsonStr);
}

json GestureEventSender::createGesturePayload(const std::string& gestureType, float confidence, const std::string& cardId) {
    // Create JSON message using modern format
    json payload = json::object();
    payload["playerId"] = deviceId;
    payload["roomId"] = currentRoomId;
    payload["gesture"] = gestureType;
    payload["confidence"] = confidence;
    
    // Include cardId if it's not empty
    if (!cardId.empty()) {
        payload["cardId"] = cardId;
    }
    
    return payload;
} 