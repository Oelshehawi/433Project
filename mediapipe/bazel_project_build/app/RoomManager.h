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

// Card definition for game
struct Card {
    std::string id;
    std::string type;    // "attack", "defend", "build"
    std::string name;
    std::string description;
};

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
    
    // Card management
    std::vector<Card> playerCards;
    std::mutex cardsMutex;
    
    // Game state tracking
    bool isMyTurn;
    int myTowerHeight;
    int opponentTowerHeight;
    int myGoalHeight;
    int opponentGoalHeight;
    bool myShieldActive;
    bool opponentShieldActive;
    std::string currentTurnPlayerId;
    std::chrono::steady_clock::time_point turnEndTime;
    int turnTimeoutSeconds;
    std::string opponentName;
    bool gameInProgress;
    std::mutex gameStateMutex;
    
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
    
    // Card management
    const std::vector<Card> getPlayerCards() const;
    bool hasCards() const { return !playerCards.empty(); }
    Card* findCardByType(const std::string& type);

    // Game state management
    std::string getOpponentName() const;
    int getRemainingTurnTime() const;
    bool isPlayerTurn() const;
    void getTowerStatus(int& myHeight, int& myGoal, int& oppHeight, int& oppGoal) const;
    bool isShieldActive() const;
    bool isGameActive() const;

    // Set player name
    void setPlayerName(const std::string& name) { playerName = name; }

    // Send gesture data
    bool sendGestureData(const std::string& gestureData);
    
    // Send card action
    bool sendCardAction(const std::string& cardId, const std::string& action);
};

#endif // ROOM_MANAGER_H 