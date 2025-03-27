#include "../include/udp_receiver.h"
#include <arpa/inet.h>
#include <sys/socket.h>
#include <unistd.h>
#include <cstring>
#include <iostream>
#include <cerrno>

UDPReceiver::UDPReceiver(int port)
    : portNumber(port), socketFd(-1), running(false) {
    std::cout << "Created UDP Receiver on port " << port << std::endl;
}

UDPReceiver::~UDPReceiver() {
    stop();
}

bool UDPReceiver::start() {
    if (running) {
        std::cout << "UDP Receiver already running" << std::endl;
        return true; // Already running
    }
    
    // Create socket
    if ((socketFd = socket(AF_INET, SOCK_DGRAM, 0)) < 0) {
        std::cerr << "Failed to create socket for UDP receiver: " << strerror(errno) << std::endl;
        return false;
    }
    std::cout << "Created UDP socket: " << socketFd << std::endl;

    // Set receive timeout to make stop() more responsive
    struct timeval tv;
    tv.tv_sec = 1;
    tv.tv_usec = 0;
    if (setsockopt(socketFd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv)) < 0) {
        std::cerr << "Failed to set socket timeout: " << strerror(errno) << std::endl;
    } else {
        std::cout << "Set socket timeout to 1 second" << std::endl;
    }
    
    // Set up server address structure
    struct sockaddr_in serverAddr;
    memset(&serverAddr, 0, sizeof(serverAddr));
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_addr.s_addr = htonl(INADDR_ANY); // Receive from any address
    serverAddr.sin_port = htons(portNumber);
    
    // Bind socket to the port
    if (bind(socketFd, (struct sockaddr*)&serverAddr, sizeof(serverAddr)) < 0) {
        std::cerr << "Failed to bind socket for UDP receiver on port " << portNumber << ": " << strerror(errno) << std::endl;
        close(socketFd);
        socketFd = -1;
        return false;
    }
    std::cout << "Successfully bound socket to port " << portNumber << std::endl;
    
    // Set flag and start receiver thread
    running = true;
    receiverThread = std::thread(&UDPReceiver::receiverLoop, this);
    
    std::cout << "UDP Receiver started on port " << portNumber << std::endl;
    return true;
}

void UDPReceiver::stop() {
    if (!running) {
        return; // Not running
    }
    
    // Signal thread to stop
    running = false;
    
    // Wait for thread to finish
    if (receiverThread.joinable()) {
        receiverThread.join();
    }
    
    // Close socket if open
    if (socketFd >= 0) {
        close(socketFd);
        socketFd = -1;
    }
    
    std::cout << "UDP Receiver stopped" << std::endl;
}

void UDPReceiver::setMessageCallback(MessageCallback callback) {
    messageCallback = callback;
}

bool UDPReceiver::isRunning() const {
    return running;
}

void UDPReceiver::receiverLoop() {
    const int BUF_SIZE = 16 * 1024; // 16KB buffer
    char buffer[BUF_SIZE];
    struct sockaddr_in clientAddr;
    socklen_t addrLen = sizeof(clientAddr);
    
    std::cout << "Receiver thread started, listening for messages" << std::endl;
    
    while (running) {
        // Reset buffer
        memset(buffer, 0, BUF_SIZE);
        
        // Receive data (will timeout after 1 second if no data)
        std::cout << "Waiting for data..." << std::endl;
        int bytesReceived = recvfrom(socketFd, buffer, BUF_SIZE - 1, 0, 
                                     (struct sockaddr*)&clientAddr, &addrLen);
        
        if (bytesReceived > 0) {
            // Null-terminate the received data
            buffer[bytesReceived] = '\0';
            
            // Print debug info
            char clientIP[INET_ADDRSTRLEN];
            inet_ntop(AF_INET, &(clientAddr.sin_addr), clientIP, INET_ADDRSTRLEN);
            std::cout << "Received " << bytesReceived << " bytes from " 
                      << clientIP << ":" << ntohs(clientAddr.sin_port) << std::endl;
            std::cout << "Message content: " << buffer << std::endl;
            
            // Create string from buffer and call callback if registered
            std::string message(buffer);
            if (messageCallback) {
                std::cout << "Calling message callback" << std::endl;
                messageCallback(message);
            } else {
                std::cout << "No message callback registered" << std::endl;
            }
        } else if (bytesReceived < 0) {
            if (errno == EAGAIN || errno == EWOULDBLOCK) {
                // Timeout - normal for non-blocking socket
                std::cout << "Socket receive timeout (normal)" << std::endl;
            } else {
                // Error occurred
                std::cerr << "Error receiving data: " << strerror(errno) << std::endl;
            }
        } else {
            // bytesReceived == 0, connection closed?
            std::cout << "Received empty packet" << std::endl;
        }
        
        // Small sleep to avoid hammering the CPU
        usleep(10000); // 10ms
    }
    
    std::cout << "Receiver thread stopped" << std::endl;
}
