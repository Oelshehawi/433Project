#include "WebSocketReceiver.h"
#include <iostream>
#include <nlohmann/json.hpp>

WebSocketReceiver::WebSocketReceiver(WebSocketClient* client)
    : client(client) {
}

WebSocketReceiver::~WebSocketReceiver() {
    stop();
}

void WebSocketReceiver::setMessageCallback(std::function<void(const std::string&)> callback) {
    messageCallback = callback;
}

void WebSocketReceiver::onMessageReceived(const std::string& message) {
    // Log every raw message received for debugging
    std::cout << "\n[WebSocketReceiver.cpp] RAW MESSAGE RECEIVED: " << message.substr(0, 100);
    if (message.length() > 100) {
        std::cout << "... (truncated, " << message.length() << " total bytes)";
    }
    std::cout << std::endl;
    
    // Process the message and forward it to the user-provided callback
    // Don't print raw messages here, let the handlers do any necessary printing
    
    try {
        // Try to parse the message as JSON for better logging
        auto j = nlohmann::json::parse(message);
        
        // Log event type for every message
        if (j.contains("event")) {
            std::cout << "[WebSocketReceiver.cpp] Message event type: " << j["event"] << std::endl;
        }
        
        // Add special handling for round_start events
        if (j.contains("event") && j["event"] == "round_start") {
            std::cout << "\n\n===========================================\n";
            std::cout << "[WebSocketReceiver.cpp] ROUND START EVENT RECEIVED BY WEBSOCKET\n";
            std::cout << "[WebSocketReceiver.cpp] MESSAGE LENGTH: " << message.length() << " bytes\n";
            
            if (j.contains("payload")) {
                // Check for round number
                if (j["payload"].contains("roundNumber")) {
                    std::cout << "Round Number: " << j["payload"]["roundNumber"] << "\n";
                }
                
                // Check if this includes cards (new format)
                if (j["payload"].contains("playerCards")) {
                    std::cout << "INCLUDES CARDS DATA for players: ";
                    size_t totalCards = 0;
                    for (auto& [playerId, cards] : j["payload"]["playerCards"].items()) {
                        std::cout << playerId << "(" << cards.size() << " cards) ";
                        totalCards += cards.size();
                    }
                    std::cout << "\nTotal cards across all players: " << totalCards << "\n";
                    
                    // Try to dump the first 200 chars of the playerCards section
                    std::string cardsJson = j["payload"]["playerCards"].dump().substr(0, 200);
                    std::cout << "Cards preview: " << cardsJson << "...\n";
                } else {
                    std::cout << "NO CARDS DATA in round_start payload!\n";
                }
            } else {
                std::cout << "NO PAYLOAD in round_start event!\n";
            }
            
            std::cout << "===========================================\n\n";
        }
        
        // Check for beagle_board_command events and provide detailed logging
        if (j.contains("event") && j["event"] == "beagle_board_command") {
            if (j.contains("payload") && j["payload"].contains("command")) {
                std::string command = j["payload"]["command"];
                
                // Special handling for CARDS command
                if (command == "CARDS") {
                    std::cout << "\n\n===========================================\n";
                    std::cout << "BEAGLEBOARD COMMAND RECEIVED: CARDS UPDATE\n";
                    
                    // Check if this is targeted
                    if (j["payload"].contains("targetPlayerId")) {
                        std::cout << "Target Player ID: " << j["payload"]["targetPlayerId"] << "\n";
                    } else {
                        std::cout << "BROADCAST MESSAGE (no target player ID)\n";
                    }
                    
                    // Log the number of cards if available
                    if (j["payload"].contains("cards")) {
                        std::cout << "Number of cards: " << j["payload"]["cards"].size() << "\n";
                    }
                    
                    std::cout << "===========================================\n\n";
                }
            }
        }
    } catch (const nlohmann::json::exception& e) {
        // Not valid JSON or parsing failed, continue with normal processing
        std::cerr << "[WebSocketReceiver.cpp] Failed to parse message as JSON: " << e.what() << std::endl;
    }
    
    if (messageCallback) {
        messageCallback(message);
    } else {
        std::cerr << "[WebSocketReceiver.cpp] WARNING: No message callback set, message dropped!" << std::endl;
    }
}

bool WebSocketReceiver::start() {
    if (!client) {
        std::cerr << "WebSocketReceiver: No client provided" << std::endl;
        return false;
    }
    
    // Set up message callback on the client
    client->setMessageCallback([this](const std::string& msg) {
        this->onMessageReceived(msg);
    });
    
    std::cout << "WebSocketReceiver: Started listening for messages" << std::endl;
    return true;
}

void WebSocketReceiver::stop() {
    if (client) {
        // Clear the message callback
        client->setMessageCallback(nullptr);
    }
}

bool WebSocketReceiver::isRunning() const {
    return client && client->isConnected();
} 