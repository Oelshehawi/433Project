#include "WebSocketReceiver.h"
#include <iostream>

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
    
    // Check for beagle_board_command events and highlight them
    if (message.find("beagle_board_command") != std::string::npos && 
        message.find("CARDS") != std::string::npos) {
        
        std::cout << "\n\n===========================================\n";
        std::cout << "BEAGLEBOARD COMMAND RECEIVED: CARDS UPDATE\n";
        std::cout << "===========================================\n\n";
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