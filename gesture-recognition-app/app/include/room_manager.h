#ifndef ROOM_MANAGER_H
#define ROOM_MANAGER_H

#include "udp_sender.h"
#include "udp_receiver.h"
#include <string>
#include <vector>
#include <map>
#include <random>
#include <fstream>
#include <mutex>
#include <condition_variable>

// Room structure to match server's RoomListItem
struct Room {
    std::string id;
    std::string name;
    int playerCount;
    int maxPlayers;
    std::string status;
};

class RoomManager {
public:
    RoomManager(UDPSender* sender, const std::string& configPath, int responsePort = 9091);
    ~RoomManager();
    
    // Device ID management
    void initializeDeviceId();
    std::string generateUniqueDeviceId();
    std::string getDeviceId() const;
    
    // Player management
    void setPlayerName(const std::string& name);
    std::string getPlayerName() const;
    
    // Room commands
    bool fetchAvailableRooms();
    void requestRoomList();
    const std::vector<Room>& getAvailableRooms() const;
    bool joinRoom(const std::string& roomId);
    bool leaveRoom();
    std::string getCurrentRoomId() const;
    bool isConnected() const;
    
    // Command formatting
    std::string formatCommand(const std::string& command, 
                             const std::map<std::string, std::string>& params = {});
    std::string sendCommand(const std::string& command,
                           const std::map<std::string, std::string>& params = {});
    
    // Process server responses
    bool processServerResponse(const std::string& response);
    
    // Gesture communication
    std::string formatGestureMessage(const std::string& gestureData);
    std::string formatGestureDetection(const std::string& gesture, float confidence);
    bool sendGestureDetection(const std::string& gesture, float confidence);
    
    // Start/Stop the receiver
    bool startReceiver();
    void stopReceiver();
    
    // Wait for response with timeout
    bool waitForResponse(int timeoutMs = 5000);
    
    // Misc methods
    void sendHello();
    
private:
    UDPSender* udpSender;
    UDPReceiver* udpReceiver;
    std::string configPath;
    std::string deviceId;
    std::string playerName;
    std::string currentRoomId;
    std::vector<Room> availableRooms;
    
    // Variables for synchronization
    std::mutex responseMutex;
    std::condition_variable responseCV;
    bool responseReceived;
    
    // Message callback handler
    void handleMessage(const std::string& message);
};

#endif // ROOM_MANAGER_H 