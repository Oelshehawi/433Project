#include "GestureEventSender.h"
#include <nlohmann/json.hpp>
#include <iostream>

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
    // Extra safety checks to prevent segfaults
    if (!client) {
        std::cerr << "[GestureEventSender.cpp] Client pointer is NULL, cannot send gesture event" << std::endl;
        return false;
    }
    
    // Verify that the client is connected before proceeding
    try {
        if (!client->isConnected()) {
            std::cerr << "[GestureEventSender.cpp] Client is not connected, cannot send gesture event" << std::endl;
            return false;
        }
    } catch (const std::exception& e) {
        std::cerr << "[GestureEventSender.cpp] Exception checking connection status: " << e.what() << std::endl;
        return false;
    } catch (...) {
        std::cerr << "[GestureEventSender.cpp] Unknown exception checking connection status" << std::endl;
        return false;
    }
    
    // Validate input parameters
    if (roomId.empty() || playerId.empty() || gesture.empty()) {
        std::cerr << "[GestureEventSender.cpp] Invalid parameters (empty roomId, playerId, or gesture)" << std::endl;
        return false;
    }
    
    try {
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
        std::string eventString;
        try {
            eventString = eventJson.dump();
        } catch (const std::exception& e) {
            std::cerr << "[GestureEventSender.cpp] Error serializing JSON: " << e.what() << std::endl;
            return false;
        }
        
        // Verify the event string is valid before sending
        if (eventString.empty()) {
            std::cerr << "[GestureEventSender.cpp] Generated empty event string" << std::endl;
            return false;
        }
        
        std::cout << "[GestureEventSender.cpp] Sending gesture: " << gesture 
                  << " for player " << playerId 
                  << " in room " << roomId << std::endl;
        
        // Send via WebSocket with extra safety
        bool result = false;
        try {
            // Double-check client before sending
            if (!client || !client->isConnected()) {
                std::cerr << "[GestureEventSender.cpp] Client became invalid before sending" << std::endl;
                return false;
            }
            
            result = client->sendMessage(eventString);
            
            if (!result) {
                std::cerr << "[GestureEventSender.cpp] sendMessage returned false" << std::endl;
                return false;
            }
            
            // Process any pending messages safely
            try {
                if (client && client->isConnected()) {
                    client->ensureMessageProcessing();
                }
            } catch (const std::exception& e) {
                std::cerr << "[GestureEventSender.cpp] Error in ensureMessageProcessing: " << e.what() << std::endl;
                // Still return true if the message was sent successfully
            }
            
            std::cout << "[GestureEventSender.cpp] Gesture event sent successfully" << std::endl;
            return result;
        } catch (const std::exception& e) {
            std::cerr << "[GestureEventSender.cpp] Exception sending gesture event: " << e.what() << std::endl;
            return false;
        } catch (...) {
            std::cerr << "[GestureEventSender.cpp] Unknown exception sending gesture event" << std::endl;
            return false;
        }
    } catch (const std::exception& e) {
        std::cerr << "[GestureEventSender.cpp] Unexpected exception: " << e.what() << std::endl;
        return false;
    } catch (...) {
        std::cerr << "[GestureEventSender.cpp] Unknown exception in sendGestureEvent" << std::endl;
        return false;
    }
    
    return false; // Should never reach here, but compiler might complain without it
}

void GestureEventSender::setClient(WebSocketClient* newClient) {
    client = newClient;
} 