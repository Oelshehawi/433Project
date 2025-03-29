#ifndef WEBSOCKET_CLIENT_H
#define WEBSOCKET_CLIENT_H

#include <string>
#include <functional>
#include <thread>
#include <atomic>
#include <queue>
#include <mutex>
#include <libwebsockets.h>

// Forward declaration for the protocol callback function
struct ClientData;
static int protocol_callback(struct lws *wsi, enum lws_callback_reasons reason, 
                           void *user, void *in, size_t len);

class WebSocketClient {
private:
    std::string host;
    int port;
    std::string path;
    bool useTLS;
    std::thread clientThread;
    
    struct lws_context *context;
    struct lws *wsi;
    
    // Thread function to run the event loop
    void run();

public:
    // These need to be accessible by the protocol handler
    std::atomic<bool> connected;
    std::atomic<bool> running;
    std::queue<std::string> messageQueue;
    std::mutex queueMutex;
    std::function<void(const std::string&)> messageCallback;
    
    // Friend the protocol handler function
    friend int protocol_callback(struct lws *wsi, enum lws_callback_reasons reason, 
                               void *user, void *in, size_t len);
    
    WebSocketClient(const std::string& host, int port, const std::string& path = "/", 
                   bool useTLS = true);
    ~WebSocketClient();
    
    // Connect to the WebSocket server
    bool connect();
    
    // Disconnect from the server
    void disconnect();
    
    // Send a message to the server
    bool sendMessage(const std::string& message);
    
    // Set callback for received messages
    void setMessageCallback(std::function<void(const std::string&)> callback);
    
    // Check if the client failed to initialize or connect
    bool isFailed() const { return !running; }
    
    // Check if connected to the server
    bool isConnected() const { return connected; }
};

#endif // WEBSOCKET_CLIENT_H 