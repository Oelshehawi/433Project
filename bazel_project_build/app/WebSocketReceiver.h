#ifndef WEBSOCKET_RECEIVER_H
#define WEBSOCKET_RECEIVER_H

#include "WebSocketClient.h"
#include <string>
#include <functional>

class WebSocketReceiver {
private:
    WebSocketClient* client;
    std::function<void(const std::string&)> messageCallback;
    
    // Message handler that will process incoming messages
    void onMessageReceived(const std::string& message);

public:
    WebSocketReceiver(WebSocketClient* client);
    ~WebSocketReceiver();
    
    // Set the message callback
    void setMessageCallback(std::function<void(const std::string&)> callback);
    
    // Start listening for messages
    bool start();
    
    // Stop listening for messages
    void stop();
    
    // Check if the receiver is running
    bool isRunning() const;
};

#endif // WEBSOCKET_RECEIVER_H 