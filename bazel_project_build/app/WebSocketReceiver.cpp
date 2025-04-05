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