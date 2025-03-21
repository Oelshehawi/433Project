#include "udp_sender.h"
#include <iostream>
#include <string>
#include <chrono>
#include <thread>
#include <ctime>

// Helper function to get current timestamp as string
std::string getCurrentTimestamp() {
    auto now = std::chrono::system_clock::now();
    std::time_t time = std::chrono::system_clock::to_time_t(now);
    char buffer[80];
    std::strftime(buffer, sizeof(buffer), "%H:%M:%S", std::localtime(&time));
    return std::string(buffer);
}

// Function to periodically send UDP messages
void runUdpServer() {
    // Initialize UDP sender with the server's IP address
    // "127.0.0.1" only works if both client and server are on the same machine
    // Use your server's actual IP on the network - e.g. "192.168.1.x"
    UDPSender sender("192.168.7.1", 9090);  // CHANGE THIS TO YOUR SERVER'S IP ADDRESS
    
    // Counter for messages
    int counter = 0;
    
    std::cout << "UDP Server started. Sending periodic messages..." << std::endl;
    
    // Initial message on startup
    std::string startupMsg = "UDP Server started at " + getCurrentTimestamp();
    sender.sendMessage(startupMsg);
    
    // Send a message every second
    while (true) {
        counter++;
        
        // Create message with timestamp and counter
        std::string message = "Gesture data packet #" + std::to_string(counter) + 
                             " | Timestamp: " + getCurrentTimestamp();
        
        // Every 5th message, send a "gesture detected" message
        if (counter % 5 == 0) {
            message += " | GESTURE DETECTED: Swipe Right";
        } else if (counter % 7 == 0) {
            message += " | GESTURE DETECTED: Swipe Left";
        } else if (counter % 11 == 0) {
            message += " | GESTURE DETECTED: Hand Open";
        }
        
        // Send the message
        sender.sendMessage(message);
        std::cout << "Sent: " << message << std::endl;
        
        // Sleep for 1 second
        std::this_thread::sleep_for(std::chrono::seconds(1));
    }
} 