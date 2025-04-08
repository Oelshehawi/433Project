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
    // Process the message and forward it to the user-provided callback
    // Don't print raw messages here, let the handlers do any necessary printing
    
    try {
        // Try to parse the message as JSON for better logging
        auto j = nlohmann::json::parse(message);
        
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
    }
    
    if (messageCallback) {
        messageCallback(message);
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