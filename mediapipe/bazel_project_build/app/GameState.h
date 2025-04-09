#pragma once

#include <string>
#include <vector>
#include <mutex>
#include <chrono>
#include <thread>
#include <map>
#include <atomic>
#include <nlohmann/json.hpp>
#include "RoomManager.h"

// Forward declaration
class RoomManager;
class DisplayManager;

// For convenience
using json = nlohmann::json;

class GameState {
private:
    RoomManager* roomManager;
    DisplayManager* displayManager;
    std::string deviceId;
    bool gameInProgress = false;

    // Game state
    int currentRoundNumber = 1;
    std::atomic<int> currentTurnTimeRemaining{0}; // Using atomic for thread safety
    std::vector<Card> lastReceivedCards;
    // Map to store available cards by type -> id
    std::map<std::string, std::string> playerCards;
    
    // Flag to track if round_end was received from server
    std::atomic<bool> roundEndReceived{false};
    
    // Simplified timer management
    std::atomic<bool> timerRunning{false};
    std::chrono::steady_clock::time_point lastTimerUpdate;
    std::thread timerThread;
    std::mutex timerMutex;

    // Auto-play when timer expires
    void autoPlayCard();

public:
    GameState(RoomManager* roomManager, DisplayManager* displayManager, const std::string& deviceId);
    ~GameState();

    // Setter methods for circular dependency resolution
    void setRoomManager(RoomManager* rm) { roomManager = rm; }
    void setDisplayManager(DisplayManager* dm) { displayManager = dm; }
    
    // Getter for displayManager
    DisplayManager* getDisplayManager() const { return displayManager; }

    // Simplified timer management
    void startTimer(int seconds = 30);
    void updateTimer();
    void stopTimer();
    bool isTimerRunning() const { return timerRunning; }

    // Getters and setters
    int getCurrentRoundNumber() const { return currentRoundNumber; }
    void setCurrentRoundNumber(int roundNumber) { currentRoundNumber = roundNumber; }

    int getCurrentTurnTimeRemaining() const { return currentTurnTimeRemaining; }
    void setCurrentTurnTimeRemaining(int timeRemaining) { currentTurnTimeRemaining = timeRemaining; }

    const std::vector<Card>& getCards() const { return lastReceivedCards; }
    void setCards(const std::vector<Card>& cards) { lastReceivedCards = cards; }

    bool isGameActive() const { return gameInProgress; }
    void setGameActive(bool active) { gameInProgress = active; }
    
    // Round end received flag management
    void setRoundEndReceived(bool received) { roundEndReceived = received; }
    bool wasRoundEndReceived() const { return roundEndReceived; }

    // Update timer from round start event
    void updateTimerFromEvent(const json& roundStartPayload);
    
    // Process card data from server
    void processCards(const json& cardsPayload);
    void processCardsDirectly(const json& cardsPayload);
    
    // Handle confirmed gesture
    void handleConfirmedGesture(const std::string& gesture, float confidence, const std::string& cardId = "");

    // Count cards by type
    void getCardCounts(int& attackCount, int& defendCount, int& buildCount) const;

    // Send round end event
    void sendRoundEndEvent();
}; 