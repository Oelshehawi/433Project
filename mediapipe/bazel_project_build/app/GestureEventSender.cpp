#include "GestureEventSender.h"
#include <nlohmann/json.hpp>

using json = nlohmann::json;

GestureEventSender::GestureEventSender(WebSocketClient* client)
    : client(client) {
}

GestureEventSender::~GestureEventSender() {
    // Nothing to clean up
}

bool GestureEventSender::sendGestureEvent(
    const std::string& roomId,
    const std::string& playerId,
    const std::string& gesture,
    float confidence,
    const std::string& cardId
) {
    if (!client) {
        return false;
    }
    
    // Create gesture event JSON payload
    json payload;
    payload["roomId"] = roomId;
    payload["playerId"] = playerId;
    payload["gesture"] = gesture;
    payload["confidence"] = confidence;
    
    // Include card ID if provided
    if (!cardId.empty()) {
        payload["cardId"] = cardId;
    }
    
    // Create the event JSON
    json eventJson;
    eventJson["event"] = "gesture_event";
    eventJson["payload"] = payload;
    
    // Convert to string for sending
    std::string eventString = eventJson.dump();
    
    // Send via WebSocket
    return client->sendMessage(eventString);
}

void GestureEventSender::setClient(WebSocketClient* newClient) {
    client = newClient;
} 