#pragma once

#include <string>
#include <vector>
#include <mutex>
#include <chrono>
#include <thread>
#include <map>
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
    int currentTurnTimeRemaining = 0;
    std::vector<Card> lastReceivedCards;

    // Timer management
    bool timerActive = false;
    std::chrono::steady_clock::time_point lastTimerUpdate;
    std::thread timerThread;
    std::mutex timerMutex;
    bool timerThreadRunning = false;

    // Auto-play when timer expires
    void autoPlayCard();

public:
    GameState(RoomManager* roomManager, DisplayManager* displayManager, const std::string& deviceId);
    ~GameState();

    // Setter methods for circular dependency resolution
    void setRoomManager(RoomManager* rm) { roomManager = rm; }
    void setDisplayManager(DisplayManager* dm) { displayManager = dm; }

    // Timer management
    void startTimerThread();
    void updateTimer();
    void stopTimerThread();

    // Getters and setters
    int getCurrentRoundNumber() const { return currentRoundNumber; }
    void setCurrentRoundNumber(int roundNumber) { currentRoundNumber = roundNumber; }

    int getCurrentTurnTimeRemaining() const { return currentTurnTimeRemaining; }
    void setCurrentTurnTimeRemaining(int timeRemaining) { currentTurnTimeRemaining = timeRemaining; }

    const std::vector<Card>& getCards() const { return lastReceivedCards; }
    void setCards(const std::vector<Card>& cards) { lastReceivedCards = cards; }

    bool isGameActive() const { return gameInProgress; }
    void setGameActive(bool active) { gameInProgress = active; }

    // Update timer from round start event
    void updateTimerFromEvent(const json& roundStartPayload);
    
    // Process card data from server
    void processCards(const json& cardsPayload);

    // Count cards by type
    void getCardCounts(int& attackCount, int& defendCount, int& buildCount) const;
}; 