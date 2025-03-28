#ifndef UDP_RECEIVER_H
#define UDP_RECEIVER_H

#include <string>
#include <functional>
#include <thread>
#include <atomic>

// Callback function type for message handling
typedef std::function<void(const std::string&)> MessageCallback;

class UDPReceiver {
public:
    UDPReceiver(int port);
    ~UDPReceiver();
    
    // Start the receiver in a separate thread
    bool start();
    
    // Stop the receiver
    void stop();
    
    // Register a callback function to be called when a message is received
    void setMessageCallback(MessageCallback callback);
    
    // Check if the receiver is running
    bool isRunning() const;
    
private:
    int portNumber;
    int socketFd;
    std::atomic<bool> running;
    std::thread receiverThread;
    MessageCallback messageCallback;
    
    // Main receiver loop - runs in a separate thread
    void receiverLoop();
};

#endif // UDP_RECEIVER_H
