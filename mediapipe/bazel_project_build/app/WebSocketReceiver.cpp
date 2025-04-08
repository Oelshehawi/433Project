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
    try {
        // Parse the message as JSON
        auto j = nlohmann::json::parse(message);
    } catch (const nlohmann::json::exception& e) {
        // Not valid JSON or parsing failed, continue with normal processing
    }
    
    if (messageCallback) {
        messageCallback(message);
    }
}

bool WebSocketReceiver::start() {
    if (!client) {
        return false;
    }
    
    // Set up message callback on the client
    client->setMessageCallback([this](const std::string& msg) {
        this->onMessageReceived(msg);
    });
    
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