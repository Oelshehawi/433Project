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
    std::string fragmentBuffer;
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
    void setConnectionCallback(std::function<void(bool)> callback);
    
    // Check if connected to the server
    bool isConnected() const;
    
    // Request wake-up of the service thread
    void requestWake();
    
    // Ensure messages are processed quickly
    void ensureMessageProcessing();
    
    // Internal methods - must be public for protocol_callback
    void onConnected();
    void onDisconnected();
    void onMessageReceived(const std::string& message);
    std::string getNextMessage();
    int callback_writable(struct lws *wsi);
    int callback_closed(struct lws *wsi);
    
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
    
    // User-defined callbacks
    std::function<void(const std::string&)> messageCallback;
    std::function<void(bool)> connectionCallback;
    
    // Thread management
    std::thread thread;
    std::mutex stateMutex;
    std::condition_variable connectionCV;
    
    // Private methods
    void run();
};

#endif // WEBSOCKET_CLIENT_H 