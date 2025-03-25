#ifndef UDP_SENDER_H
#define UDP_SENDER_H

#include <string>

class UDPSender {
public:
    UDPSender(const std::string& ip, int port);
    void sendMessage(const std::string& message);
    void sendFileWithText(const std::string& filename, const std::string& text);
    void sendImageFile(std::vector<uchar> image);

private:
    std::string ipAddress;
    int portNumber;
};

#endif
