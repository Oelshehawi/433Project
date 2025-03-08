#include "udp_sender.h"
#include <arpa/inet.h>
#include <sys/socket.h>
#include <unistd.h>
#include <fstream>
#include <iostream>
#include <vector>
#include <cstring>  

UDPSender::UDPSender(const std::string& ip, int port)
    : ipAddress(ip), portNumber(port) {}

void UDPSender::sendMessage(const std::string& message) {
    int sock = socket(AF_INET, SOCK_DGRAM, 0);
    struct sockaddr_in serverAddr;

    memset(&serverAddr, 0, sizeof(serverAddr));
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_port = htons(portNumber);
    inet_pton(AF_INET, ipAddress.c_str(), &serverAddr.sin_addr);

    sendto(sock, message.c_str(), message.size(), 0,
           (struct sockaddr*)&serverAddr, sizeof(serverAddr));

    close(sock);
}

void UDPSender::sendFileWithText(const std::string& filename, const std::string& text) {
    int sock = socket(AF_INET, SOCK_DGRAM, 0);
    struct sockaddr_in serverAddr;
    memset(&serverAddr, 0, sizeof(serverAddr));
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_port = htons(portNumber);
    inet_pton(AF_INET, ipAddress.c_str(), &serverAddr.sin_addr);

    sendto(sock, text.c_str(), text.size(), 0, (struct sockaddr*)&serverAddr, sizeof(serverAddr));

    std::ifstream file(filename, std::ios::binary);
    if (!file) {
        close(sock);
        return;
    }

    std::vector<char> buffer((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
    file.close();

    sendto(sock, buffer.data(), buffer.size(), 0, (struct sockaddr*)&serverAddr, sizeof(serverAddr));

    close(sock);
}
