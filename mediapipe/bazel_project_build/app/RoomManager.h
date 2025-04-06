#ifndef ROOM_MANAGER_H
#define ROOM_MANAGER_H

#include "WebSocketClient.h"
#include "WebSocketReceiver.h"
#include <nlohmann/json.hpp>
#include <string>
#include <vector>
#include <map>
#include <mutex>
#include <chrono>

// For convenience
using json = nlohmann::json;

struct Room {
    std::string id;
    std::string name;
    int playerCount;
    int maxPlayers;
    std::string status;
};

class RoomManager {
private:
    WebSocketClient* client;
    WebSocketReceiver* receiver;
    std::string deviceId;
    std::string playerName;
    std::string currentRoomId;
    bool connected;
    bool ready;
    std::vector<Room> availableRooms;
    std::mutex roomsMutex;
    
    // Loading state tracking
    bool isWaitingForResponse;
    std::chrono::steady_clock::time_point lastRequestTime;
    std::string currentRequestType;
    
    // Generate a unique device ID
    std::string generateDeviceId();
    
    // Handle received messages
    void handleMessage(const std::string& message);
    
    // Parse room list response (legacy format)
    void parseRoomList(const std::string& response);
    
    // Parse JSON room list response
    void parseJsonRoomList(const json& roomsJson);
    
    // Display the available rooms
    void displayRoomList();
    
    // Send message with loading state tracking
    bool sendMessageWithTracking(const std::string& message, const std::string& requestType);

public:
    RoomManager(WebSocketClient* client);
    ~RoomManager();

    // Start WebSocket receiver
    bool startReceiver();
    
    // Room management functions
    bool fetchAvailableRooms();
    bool createRoom(const std::string& roomName);
    bool joinRoom(const std::string& roomId);
    bool leaveRoom();
    void setReady(bool isReady);
    
    // Reset loading state after response or timeout
    void resetLoadingState();
    
    // Loading state checker
    bool isLoading() const { return isWaitingForResponse; }
    std::string getCurrentRequest() const { return currentRequestType; }

    // Getters
    std::string getDeviceId() const { return deviceId; }
    WebSocketClient* getClient() const { return client; }
    std::string getPlayerName() const { return playerName; }
    std::string getCurrentRoomId() const { return currentRoomId; }
    bool isConnected() const { return connected; }
    bool isReady() const { return ready; }
    const std::vector<Room> getAvailableRooms() const;

    // Set player name
    void setPlayerName(const std::string& name) { playerName = name; }

    // Send gesture data
    bool sendGestureData(const std::string& gestureData);
};

#endif // ROOM_MANAGER_H 