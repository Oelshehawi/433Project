#pragma once

#include "WebSocketClient.h"
#include "WebSocketReceiver.h"
#include <nlohmann/json.hpp>
#include <string>
#include <vector>
#include <map>
#include <mutex>
#include <chrono>
#include <thread>

// Forward declarations
class WebSocketClient;
class WebSocketReceiver;
class MessageHandler;
class GameState;
class DisplayManager;
class GestureDetector;
class GestureEventSender;

// For convenience
using json = nlohmann::json;

// Card definition for game
struct Card {
    std::string id;
    std::string type;    // "attack", "defend", "build"
    std::string name;
    std::string description;
};

// Room structure
struct Room {
    std::string id;
    std::string name;
    int playerCount = 0;
    int maxPlayers = 0;
    std::string status;
};

class RoomManager {
private:
    WebSocketClient* client;
    WebSocketReceiver* receiver;
    MessageHandler* messageHandler;
    DisplayManager* displayManager;
    
    std::string deviceId;
    std::string playerName;
    std::string currentRoomId;
    bool connected;
    bool ready;
    std::vector<Room> availableRooms;
    std::mutex roomsMutex;
    
    // Status tracking to reduce duplicate messages
    std::string lastRoomStatus;
    int lastPlayerCount;
    
    // Loading state tracking
    bool isWaitingForResponse;
    std::chrono::steady_clock::time_point lastRequestTime;
    std::string currentRequestType;
    
    // Game status - minimal state tracking (just if game is active)
    bool gameInProgress;
    
    // Game state tracking
    int currentRoundNumber = 1;                // Current round number
    std::string currentTurnPlayerId = "";      // ID of player whose turn it is
    int currentTurnTimeRemaining = 0;          // Time remaining in current turn (seconds)
    std::vector<Card> lastReceivedCards;       // Last received set of cards
    
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

    // Display methods - update LCD with current game state and cards

public:
    GameState* gameState;                   // Made public for direct access
    GestureDetector* gestureDetector;       // Made public for direct access
    GestureEventSender* gestureEventSender; // Public gesture event sender

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

    // Setters for component connections
    void setGameState(GameState* gs) { gameState = gs; }
    void setDisplayManager(DisplayManager* dm) { displayManager = dm; }
    void setGestureDetector(GestureDetector* detector) { gestureDetector = detector; }

    // Getters
    const std::vector<Room> getAvailableRooms() const;
    const std::string& getDeviceId() const { return deviceId; }
    bool isConnected() const { return connected; }
    bool isReady() const { return ready; }
    bool isGameActive() const { return gameInProgress; }
    const std::string& getPlayerName() const { return playerName; }
    std::string getCurrentRoomId() const { return currentRoomId; }
    std::string getRoomId() const { return currentRoomId; }
    WebSocketClient* getClient() { return client; }

    // Set player name
    void setPlayerName(const std::string& name) { playerName = name; }
    
    // Send gesture event - convenience method to call gestureEventSender
    bool sendGestureEvent(const std::string& roomId, const std::string& playerId, 
                         const std::string& gesture, float confidence, const std::string& cardId = "");

    // Friend classes that need access to private members
    friend class MessageHandler;
    friend class GameState;
    friend class DisplayManager;
    friend class GestureEventSender;
}; 