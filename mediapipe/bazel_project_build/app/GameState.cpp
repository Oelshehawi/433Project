#include "GameState.h"
#include "RoomManager.h"
#include "DisplayManager.h"
#include <iostream>
#include <algorithm>
#include <random>

GameState::GameState(RoomManager* roomManager, DisplayManager* displayManager, const std::string& deviceId)
    : roomManager(roomManager), displayManager(displayManager), deviceId(deviceId),
      gameInProgress(false), currentRoundNumber(1), currentTurnTimeRemaining(0),
      timerActive(false), timerThreadRunning(false) {
}

GameState::~GameState() {
    stopTimerThread();
}

void GameState::startTimerThread() {
    std::lock_guard<std::mutex> lock(timerMutex);
    
    // Stop any existing timer thread
    stopTimerThread();
    
    // Start a new timer thread
    timerThreadRunning = true;
    timerThread = std::thread(&GameState::updateTimer, this);
}

void GameState::updateTimer() {
    std::cout << "Timer thread started with " << currentTurnTimeRemaining << " seconds" << std::endl;
    
    while (timerThreadRunning && timerActive) {
        // Sleep for 1 second
        std::this_thread::sleep_for(std::chrono::seconds(1));
        
        // Update the timer
        {
            std::lock_guard<std::mutex> lock(timerMutex);
            
            if (currentTurnTimeRemaining > 0) {
                currentTurnTimeRemaining--;
                
                // Update the display with the new time
                if (displayManager && !lastReceivedCards.empty()) {
                    displayManager->updateCardAndGameDisplay();
                }
            }
            
            // If time has run out, auto-play a card
            if (currentTurnTimeRemaining <= 0 && timerActive) {
                std::cout << "Time expired, auto-playing a card..." << std::endl;
                
                // Disable the timer
                timerActive = false;
                
                // Auto-play a card - this will send the gesture to server
                autoPlayCard();
                
                break;
            }
        }
    }
    
    std::cout << "Timer thread ended" << std::endl;
}

void GameState::stopTimerThread() {
    std::lock_guard<std::mutex> lock(timerMutex);
    
    if (timerThreadRunning) {
        timerThreadRunning = false;
        
        // Wait for thread to finish if it's joinable
        if (timerThread.joinable()) {
            timerThread.join();
        }
        
        timerActive = false;
    }
}

void GameState::updateTimerFromEvent(const json& roundStartPayload) {
    if (roundStartPayload.contains("roundNumber")) {
        currentRoundNumber = roundStartPayload["roundNumber"];
    }
    
    // Always use fixed 30-second timer regardless of what server sends
    currentTurnTimeRemaining = 30; // Fixed 30 seconds per round
    lastTimerUpdate = std::chrono::steady_clock::now();
    timerActive = true;
    
    std::cout << "New round started - setting timer to 30 seconds" << std::endl;
    
    // Start the timer thread
    startTimerThread();
}

void GameState::processCards(const json& cardsPayload) {
    if (!cardsPayload.contains("cards")) {
        std::cerr << "Error: Cards payload does not contain cards array" << std::endl;
        return;
    }
    
    // Clear the current cards
    lastReceivedCards.clear();
    
    // Parse the cards
    for (const auto& cardJson : cardsPayload["cards"]) {
        Card card;
        card.id = cardJson.contains("id") ? cardJson["id"].get<std::string>() : "";
        card.type = cardJson.contains("type") ? cardJson["type"].get<std::string>() : "";
        card.name = cardJson.contains("name") ? cardJson["name"].get<std::string>() : "";
        card.description = cardJson.contains("description") ? cardJson["description"].get<std::string>() : "";
        
        std::cout << "  Card: " << card.name << " (" << card.type << ")" << std::endl;
        lastReceivedCards.push_back(card);
    }
    
    // Display the cards
    if (displayManager && !lastReceivedCards.empty()) {
        displayManager->updateCardAndGameDisplay();
    }
}

void GameState::getCardCounts(int& attackCount, int& defendCount, int& buildCount) const {
    // Reset counts
    attackCount = 0;
    defendCount = 0;
    buildCount = 0;
    
    // Count card types
    for (const auto& card : lastReceivedCards) {
        if (card.type == "attack") attackCount++;
        else if (card.type == "defend") defendCount++;
        else if (card.type == "build") buildCount++;
    }
}

void GameState::autoPlayCard() {
    // Check if we have cards to play
    if (!roomManager || lastReceivedCards.empty()) {
        return;
    }
    
    // Choose a random card to play based on available types
    std::vector<std::string> availableTypes;
    
    // Count available card types
    for (const auto& card : lastReceivedCards) {
        // Only add each type once
        if (std::find(availableTypes.begin(), availableTypes.end(), card.type) == availableTypes.end()) {
            availableTypes.push_back(card.type);
        }
    }
    
    if (!availableTypes.empty()) {
        // Randomly select a card type
        std::random_device rd;
        std::mt19937 gen(rd());
        std::uniform_int_distribution<> dist(0, availableTypes.size() - 1);
        std::string selectedType = availableTypes[dist(gen)];
        
        std::cout << "Auto-playing a " << selectedType << " card" << std::endl;
        
        // Create and send gesture data for the selected type
        json gestureData = {
            {"gesture", selectedType},
            {"confidence", 0.95}
        };
        
        // Send the gesture data
        roomManager->sendGestureData(gestureData.dump());
        
        // Display auto-play message
        if (displayManager) {
            displayManager->displayAutoPlay(selectedType);
            
            // Wait a moment before returning to card display
            std::this_thread::sleep_for(std::chrono::seconds(2));
            displayManager->updateCardAndGameDisplay();
        }
    }
} 