#ifndef ROOM_MANAGER_H
#define ROOM_MANAGER_H

#include <string>
#include <vector>
#include <fstream>
#include <filesystem>
#include <unordered_map>
#include <random>
#include <map>
#include "udp_sender.h"

// Structure to represent a room
struct Room {
    std::string id;
    std::string name;
    int playerCount;
    int maxPlayers;
    std::string status;
};

class RoomManager {
private:
    UDPSender* udpSender;
    std::string deviceId;
    std::string playerName;
    std::string currentRoomId;
    std::vector<Room> availableRooms;
    std::string configPath;

    // Load or generate device ID
    void initializeDeviceId();
    
    // Generate a unique device ID for this BeagleBoard
    std::string generateUniqueDeviceId();

public:
    RoomManager(UDPSender* sender, const std::string& configPath = "/tmp/beagle_board_config.txt");
    ~RoomManager();

    // Get device ID
    std::string getDeviceId() const;
    
    // Set and get player name
    void setPlayerName(const std::string& name);
    std::string getPlayerName() const;
    
    // Room operations
    bool fetchAvailableRooms();
    const std::vector<Room>& getAvailableRooms() const;
    bool joinRoom(const std::string& roomId);
    bool leaveRoom();
    
    // Get current room ID
    std::string getCurrentRoomId() const;
    
    // Check if connected to a room
    bool isConnected() const;
    
    // Communication methods
    
    // Format a command message for the server
    std::string formatCommand(const std::string& command, 
                             const std::map<std::string, std::string>& params = {});
    
    // Send a command to the server
    std::string sendCommand(const std::string& command, 
                           const std::map<std::string, std::string>& params = {});
    
    // Format gesture message with device ID and room ID
    std::string formatGestureMessage(const std::string& gestureData);
    
    // Format gesture detection message with a gesture name and confidence
    std::string formatGestureDetection(const std::string& gesture, float confidence);
    
    // Send a gesture detection to the server
    bool sendGestureDetection(const std::string& gesture, float confidence);
    
    // Utility methods
    
    // Send a hello message to announce this device
    void sendHello();
    
    // List available rooms from the server
    void requestRoomList();
};

#endif // ROOM_MANAGER_H 