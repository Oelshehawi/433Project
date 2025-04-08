#pragma once

#include <string>
#include "WebSocketClient.h"
#include <nlohmann/json.hpp>

// For convenience
using json = nlohmann::json;

class GestureEventSender {
private:
    WebSocketClient* client;

public:
    GestureEventSender(WebSocketClient* client);
    ~GestureEventSender();
    
    // Send a gesture event to the server
    bool sendGestureEvent(
        const std::string& roomId,
        const std::string& playerId,
        const std::string& gesture,
        float confidence,
        const std::string& cardId = ""
    );
    
    // Set client
    void setClient(WebSocketClient* client);
}; 