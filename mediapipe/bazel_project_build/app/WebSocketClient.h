#ifndef WEBSOCKET_CLIENT_H
#define WEBSOCKET_CLIENT_H

#include <string>
#include <functional>
#include <thread>
#include <atomic>
#include <queue>
#include <mutex>
#include <condition_variable>
#include <libwebsockets.h>

// ClientData definition - moved from cpp file to header to fix incomplete type error
struct ClientData {
    class WebSocketClient* client;
    std::string receivedData;
};

// Forward declarations for libwebsockets
struct lws;
enum lws_callback_reasons;

// Protocol callback function declaration (non-static)
int protocol_callback(struct lws *wsi, enum lws_callback_reasons reason, 
                    void *user, void *in, size_t len);

class WebSocketClient {
public:
    WebSocketClient(const std::string& host, int port, const std::string& path, bool useTLS = false);
    ~WebSocketClient();
    
    bool connect();
    void disconnect();
    
    bool sendMessage(const std::string& message);
    void setMessageCallback(std::function<void(const std::string&)> callback);
    
    // Check if the client failed to initialize or connect
    bool isFailed() const { return !running; }
    
    // Check if connected to the server
    bool isConnected() const { return connected; }
    
    // Ensure messages are processed quickly
    void ensureMessageProcessing();
    
    // Allow the protocol callback to access private members
    friend int protocol_callback(struct lws *wsi, enum lws_callback_reasons reason, 
                              void *user, void *in, size_t len);
    
private:
    // Connection properties
    std::string host;
    int port;
    std::string path;
    bool useTLS;
    
    // Connection state
    std::atomic<bool> connected;
    std::atomic<bool> running;
    
    // WebSocket connection objects
    struct lws_context *context;
    struct lws *wsi;
    
    // Wake-up mechanism
    std::atomic<bool> wakeRequested;
    
    // Message queue for outgoing messages
    std::queue<std::string> messageQueue;
    std::mutex queueMutex;
    
    // User-defined message callback
    std::function<void(const std::string&)> messageCallback;
    
    // Thread management
    std::thread clientThread;
    std::mutex connectionMutex;
    std::condition_variable connectionCV;
    std::mutex wakeMutex;
    std::condition_variable wakeCV;
    
    // Private methods
    void run();
    void wakeServiceThread();
    
    // Helper methods
    std::string parseCommandPayload(const std::string& payload);
    std::string commandToEventName(const std::string& command);

    // Internal message handler
    void onMessageReceived(const std::string& message);

    // Friends
    friend int protocol_callback(struct lws *wsi, enum lws_callback_reasons reason, 
                    void *user, void *in, size_t len);
    friend class WebSocketReceiver; // Allow WebSocketReceiver to access private members
};

#endif // WEBSOCKET_CLIENT_H 