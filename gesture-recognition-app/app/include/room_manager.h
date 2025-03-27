#ifndef ROOM_MANAGER_H
#define ROOM_MANAGER_H

#include <string>
#include <vector>
#include <fstream>
#include <filesystem>
#include <unordered_map>
#include <random>
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
    
    // Send a command to the UDP server
    std::string sendCommand(const std::string& command, const std::string& params);

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
    
    // Format gesture message with device ID and room ID
    std::string formatGestureMessage(const std::string& gestureData);
};

#endif // ROOM_MANAGER_H 