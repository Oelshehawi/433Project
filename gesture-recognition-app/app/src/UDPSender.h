#ifndef UDP_SENDER_H
#define UDP_SENDER_H

#include <string>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <iostream>

class UDPSender {
private:
    int sockfd;
    struct sockaddr_in serverAddr;
    std::string serverIP;
    int serverPort;

public:
    UDPSender(const std::string& ip, int port) : serverIP(ip), serverPort(port) {
        // Create TCP socket
        sockfd = socket(AF_INET, SOCK_STREAM, 0);
        if (sockfd < 0) {
            std::cerr << "Error creating socket" << std::endl;
            return;
        }

        // Configure server address
        memset(&serverAddr, 0, sizeof(serverAddr));
        serverAddr.sin_family = AF_INET;
        serverAddr.sin_port = htons(port);

        // Convert IP address
        if (inet_pton(AF_INET, ip.c_str(), &serverAddr.sin_addr) <= 0) {
            std::cerr << "Invalid address" << std::endl;
            close(sockfd);
            return;
        }

        // Connect to server
        if (connect(sockfd, (struct sockaddr*)&serverAddr, sizeof(serverAddr)) < 0) {
            std::cerr << "Connection failed" << std::endl;
            close(sockfd);
            return;
        }
    }

    ~UDPSender() {
        if (sockfd >= 0) {
            close(sockfd);
        }
    }

    bool sendMessage(const std::string& message) {
        if (sockfd < 0) {
            std::cerr << "Socket not initialized" << std::endl;
            return false;
        }

        // Add newline to message for TCP message separation
        std::string messageWithNewline = message + "\n";

        // Send message
        ssize_t sent = send(sockfd, messageWithNewline.c_str(), messageWithNewline.length(), 0);
        if (sent < 0) {
            std::cerr << "Error sending message" << std::endl;
            return false;
        }

        return true;
    }
};

#endif // UDP_SENDER_H 