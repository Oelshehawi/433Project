#include "GameState.h"
#include "RoomManager.h"
#include "DisplayManager.h"
#include "GestureDetector.h"
#include "GestureEventSender.h"
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
    std::cout << "[GameState.cpp] STARTING TIMER THREAD - Current state: timerThreadRunning=" 
              << (timerThreadRunning ? "true" : "false") << ", timerActive=" 
              << (timerActive ? "true" : "false") << std::endl;
    
    // Check if timer thread is marked as running but not joinable
    {
        std::lock_guard<std::mutex> checkLock(timerMutex);
        if (timerThreadRunning && !timerThread.joinable()) {
            std::cout << "[GameState.cpp] Timer thread marked as running but not joinable - resetting flags" << std::endl;
            timerThreadRunning = false;
            timerActive = false;
        }
    }
    
    // Stop any existing timer thread - do this outside the lock to avoid deadlock
    bool needToStop = false;
    {
        std::lock_guard<std::mutex> checkLock(timerMutex);
        needToStop = timerThreadRunning;
    }
    
    if (needToStop) {
        std::cout << "[GameState.cpp] Stopping existing timer thread before starting new one" << std::endl;
        stopTimerThread();
    }
    
    // Now set up the new timer thread
    std::lock_guard<std::mutex> lock(timerMutex);
    
    // Ensure both flags are set properly
    timerThreadRunning = true;
    timerActive = true;
    
    // Start a new timer thread
    std::cout << "[GameState.cpp] Creating new timer thread, state: timerThreadRunning=" 
              << (timerThreadRunning ? "true" : "false") << ", timerActive=" 
              << (timerActive ? "true" : "false") << std::endl;
    
    // Detach any previous thread if it's still joinable
    if (timerThread.joinable()) {
        timerThread.join();
    }
    
    timerThread = std::thread(&GameState::updateTimer, this);
    std::cout << "[GameState.cpp] Timer thread created successfully" << std::endl;
}

void GameState::updateTimer() {
    std::cout << "[GameState.cpp] Timer thread started with " << currentTurnTimeRemaining << " seconds" << std::endl;
    std::cout << "[GameState.cpp] Thread state: timerThreadRunning=" << (timerThreadRunning ? "true" : "false") 
              << ", timerActive=" << (timerActive ? "true" : "false") << std::endl;
    
    int debugCounter = 0;
    while (timerThreadRunning && timerActive) {
        // Debug counter to track iterations
        debugCounter++;
        
        // Sleep for 1 second
        std::this_thread::sleep_for(std::chrono::seconds(1));
        
        // Update the timer
        {
            // Only log every 5 seconds or last 3 seconds
            bool shouldLog = (currentTurnTimeRemaining % 5 == 0 || currentTurnTimeRemaining <= 3);
            
            if (shouldLog) {
                std::cout << "[GameState.cpp] Timer loop iteration #" << debugCounter << std::endl;
            }
            
            std::lock_guard<std::mutex> lock(timerMutex);
            
            // Check thread state again inside the mutex - only if logging
            if (shouldLog) {
                std::cout << "[GameState.cpp] Thread state inside mutex: timerThreadRunning=" 
                          << (timerThreadRunning ? "true" : "false") 
                          << ", timerActive=" << (timerActive ? "true" : "false") << std::endl;
            }
            
            if (currentTurnTimeRemaining > 0) {
                currentTurnTimeRemaining--;
                
                // Add debug print to verify timer value is decreasing - only if logging
                if (shouldLog) {
                    std::cout << "[GameState.cpp] Timer updated: " << currentTurnTimeRemaining << " seconds remaining" << std::endl;
                }
                
                // Update the display with the new time
                if (displayManager) {
                    // Force a display update every second to show timer changing
                    displayManager->updateCardAndGameDisplay();
                    
                    // Only log display updates at significant intervals
                    if (shouldLog) {
                        std::cout << "[GameState.cpp] Display updated with new timer value: " << currentTurnTimeRemaining << " seconds" << std::endl;
                    }
                } else {
                    std::cerr << "[GameState.cpp] Display manager is NULL, cannot update display" << std::endl;
                }
            }
            
            // If time has run out, auto-play a card
            if (currentTurnTimeRemaining <= 0 && timerActive) {
                std::cout << "[GameState.cpp] Time expired, auto-playing a card..." << std::endl;
                
                // Disable the timer
                timerActive = false;
                
                // Auto-play a card - this will send the gesture to server
                autoPlayCard();
                
                break;
            }
        }
    }
    
    // IMPORTANT: Reset the flags when the thread exits
    {
        std::lock_guard<std::mutex> lock(timerMutex);
        timerThreadRunning = false;
        timerActive = false;
        std::cout << "[GameState.cpp] Timer thread exiting naturally, resetting flags: timerThreadRunning=false, timerActive=false" << std::endl;
    }
    
    std::cout << "[GameState.cpp] Timer thread ended after " << debugCounter << " iterations. Thread state: timerThreadRunning=" 
              << (timerThreadRunning ? "true" : "false") << ", timerActive=" << (timerActive ? "true" : "false") << std::endl;
}

void GameState::stopTimerThread() {
    std::cout << "[GameState.cpp] STOPPING TIMER THREAD - Current state: timerThreadRunning=" 
              << (timerThreadRunning ? "true" : "false") << ", timerActive=" 
              << (timerActive ? "true" : "false") << std::endl;
    
    std::lock_guard<std::mutex> lock(timerMutex);
    
    if (timerThreadRunning) {
        timerThreadRunning = false;
        timerActive = false;
        
        std::cout << "[GameState.cpp] Timer flags set to false, waiting for thread to join" << std::endl;
        
        // Wait for thread to finish if it's joinable
        if (timerThread.joinable()) {
            timerThread.join();
            std::cout << "[GameState.cpp] Timer thread joined successfully" << std::endl;
        } else {
            std::cout << "[GameState.cpp] Timer thread is not joinable" << std::endl;
        }
    } else {
        std::cout << "[GameState.cpp] Timer thread was not running, nothing to stop" << std::endl;
    }
}

void GameState::updateTimerFromEvent(const json& roundStartPayload) {
    std::cout << "\n[GameState.cpp] ====== ROUND START EVENT PROCESSING START ======" << std::endl;
    std::cout << "[GameState.cpp] Round start payload size: " << roundStartPayload.dump().size() << " bytes" << std::endl;
    std::cout << "[GameState.cpp] Round start payload received: " << roundStartPayload.dump(2).substr(0, 500) << std::endl;
    if (roundStartPayload.dump().size() > 500) {
        std::cout << "... (truncated)" << std::endl;
    }

    // Update round number
    if (roundStartPayload.contains("roundNumber")) {
        int newRoundNumber = roundStartPayload["roundNumber"];
        std::cout << "[GameState.cpp] Updating round number from " << currentRoundNumber << " to " << newRoundNumber << std::endl;
        currentRoundNumber = newRoundNumber;
    } else {
        std::cout << "[GameState.cpp] WARNING: Round start payload does not contain roundNumber!" << std::endl;
    }
    
    // Always set the timer first to ensure we have a proper countdown
    // Always use fixed 30-second timer regardless of what server sends
    currentTurnTimeRemaining = 30; // Fixed 30 seconds per round
    lastTimerUpdate = std::chrono::steady_clock::now();
    timerActive = true;
    std::cout << "[GameState.cpp] Setting timer to " << currentTurnTimeRemaining << " seconds" << std::endl;
    
    // Handle cards if they're included in round_start payload (new format)
    bool foundCards = false;
    
    if (roundStartPayload.contains("playerCards") && roundStartPayload["playerCards"].is_object()) {
        std::string ourDeviceId = roomManager ? roomManager->getDeviceId() : "unknown";
        std::cout << "[GameState.cpp] Looking for our cards with device ID: " << ourDeviceId << std::endl;
        
        // List all available player IDs in the payload
        std::cout << "[GameState.cpp] Available player IDs in playerCards: ";
        for (auto& [playerId, cards] : roundStartPayload["playerCards"].items()) {
            std::cout << "'" << playerId << "' ";
        }
        std::cout << std::endl;
        
        // Find cards for our player ID
        const auto& playerCards = roundStartPayload["playerCards"];
        if (playerCards.contains(ourDeviceId)) {
            // Found cards for this player
            const auto& cards = playerCards[ourDeviceId];
            
            // Create a cards payload to process
            json cardsPayload;
            cardsPayload["cards"] = cards;
            
            std::cout << "[GameState.cpp] Found " << cards.size() << " cards in round_start event, processing them now" << std::endl;
            std::cout << "[GameState.cpp] First card preview: " << (cards.size() > 0 ? cards[0].dump() : "No cards") << std::endl;
            
            // Process cards WITHOUT checking timer (we already set it above)
            processCardsDirectly(cardsPayload);
            foundCards = true;
        } else {
            std::cout << "[GameState.cpp] WARNING: Our device ID '" << ourDeviceId << "' not found in playerCards data!" << std::endl;
            std::cout << "[GameState.cpp] Available player IDs: ";
            for (auto& [playerId, cards] : playerCards.items()) {
                std::cout << "'" << playerId << "' ";
            }
            std::cout << std::endl;
        }
    } else {
        std::cout << "[GameState.cpp] Round start payload does not contain playerCards data (old format)" << std::endl;
    }
    
    if (!foundCards) {
        std::cout << "[GameState.cpp] WARNING: No cards found in round_start event!" << std::endl;
    }
    
    // Force an immediate display update with current game state
    if (displayManager) {
        std::cout << "[GameState.cpp] Forcing display update to show cards and round info" << std::endl;
        displayManager->updateCardAndGameDisplay();
    } else {
        std::cerr << "[GameState.cpp] ERROR: Display manager is NULL when trying to update display" << std::endl;
    }
    
    // Start the timer thread
    std::cout << "[GameState.cpp] Starting timer thread for round " << currentRoundNumber << std::endl;
    startTimerThread();
    std::cout << "[GameState.cpp] ====== ROUND START PROCESSING COMPLETE ======\n" << std::endl;
}

// New method to process cards directly without timer checks
void GameState::processCardsDirectly(const json& cardsPayload) {
    if (!cardsPayload.contains("cards")) {
        std::cerr << "[GameState.cpp] Error: Cards payload does not contain cards array" << std::endl;
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
        
        std::cout << "[GameState.cpp]   Card: " << card.name << " (" << card.type << ")" << std::endl;
        lastReceivedCards.push_back(card);
    }
    
    std::cout << "[GameState.cpp] Processed " << lastReceivedCards.size() << " cards" << std::endl;
}

void GameState::processCards(const json& cardsPayload) {
    if (!cardsPayload.contains("cards")) {
        std::cerr << "[GameState.cpp] Error: Cards payload does not contain cards array" << std::endl;
        return;
    }
    
    // Check if timer needs initialization (cards received before round_start)
    if (currentTurnTimeRemaining <= 0) {
        std::cout << "[GameState.cpp] WARNING: Cards received before round_start event! Initializing default timer." << std::endl;
        // Set a default timer value since we haven't received the round_start event yet
        currentTurnTimeRemaining = 30; // Default 30 seconds
        timerActive = true;
        
        // Start the timer thread if needed
        if (!timerThreadRunning) {
            std::cout << "[GameState.cpp] Starting timer thread with default value since round_start hasn't arrived" << std::endl;
            startTimerThread();
        }
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
        
        std::cout << "[GameState.cpp]   Card: " << card.name << " (" << card.type << ")" << std::endl;
        lastReceivedCards.push_back(card);
    }
    
    // Display the cards and current game state
    if (displayManager) {
        std::cout << "[GameState.cpp] Updating display after receiving cards - current timer: " 
                  << currentTurnTimeRemaining << " seconds" << std::endl;
        displayManager->updateCardAndGameDisplay();
    } else {
        std::cerr << "[GameState.cpp] Display manager is NULL, cannot update display after receiving cards" << std::endl;
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

void GameState::sendRoundEndEvent() {
    if (!roomManager || !roomManager->client) {
        std::cerr << "[GameState.cpp] ERROR: Cannot send round_end event - roomManager or client is null" << std::endl;
        return;
    }
    
    std::cout << "[GameState.cpp] Sending round_end event for round " << currentRoundNumber << std::endl;
    
    // Stop gesture detection if it's running
    if (roomManager->gestureDetector && roomManager->gestureDetector->isRunning()) {
        std::cout << "[GameState.cpp] Stopping gesture detection before sending round_end" << std::endl;
        roomManager->gestureDetector->stop();
    }
    
    // Stop the timer thread to ensure it doesn't continue running
    std::cout << "[GameState.cpp] Stopping timer thread as round is ending" << std::endl;
    stopTimerThread();
    
    // Create and send round_end event
    json payload = json::object();
    payload["roomId"] = roomManager->getRoomId();
    payload["playerId"] = deviceId;
    payload["roundNumber"] = currentRoundNumber;
    
    json message = json::object();
    message["event"] = "round_end_ack";
    message["payload"] = payload;
    
    std::string messageStr = message.dump();
    
    roomManager->client->sendMessage(messageStr);
    
    // Update display to show "Waiting for next round" message
    if (displayManager) {
        displayManager->displayWaitingForNextRound(currentRoundNumber);
    }
}

void GameState::autoPlayCard() {
    // Ensure we have cards to play
    if (playerCards.empty()) {
        std::cout << "[GameState.cpp] No cards available to auto-play" << std::endl;
        sendRoundEndEvent(); // Still send round end even if no cards
        return;
    }
    
    // Choose a card randomly from the available cards
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> distrib(0, playerCards.size() - 1);
    size_t cardIndex = distrib(gen);
    
    // Get an iterator to the selected card
    auto it = playerCards.begin();
    std::advance(it, cardIndex);
    
    // Extract card information
    std::string cardType = it->first;
    std::string cardId = it->second;
    
    std::cout << "[GameState.cpp] Auto-playing a " << cardType << " card (ID: " << cardId << ")" << std::endl;
    
    // Send the gesture event
    if (roomManager && roomManager->gestureEventSender) {
        std::cout << "Sending gesture event with card ID: " << cardId << std::endl;
        roomManager->sendGestureEvent(
            roomManager->getRoomId(), 
            deviceId, 
            cardType, 
            0.95, // Default confidence value
            cardId
        );
        std::cout << "Auto-playing a " << cardType << " card" << std::endl;
    } else {
        std::cerr << "[GameState.cpp] Cannot send gesture - gestureEventSender is null" << std::endl;
    }
    
    std::cout << "[GameState.cpp] Auto-play complete. If gesture detection is running, it should be stopped." << std::endl;
    
    // Update display back to cards and game info (without console output)
    if (displayManager) {
        displayManager->updateCardAndGameDisplay(false);
    }
    
    // Send round end event after auto-playing
    sendRoundEndEvent();
}

void GameState::handleConfirmedGesture(const std::string& gesture, float confidence, const std::string& cardId) {
    std::cout << "[GameState.cpp] Handling confirmed gesture: " << gesture << " (confidence: " << confidence << ")" << std::endl;
    
    // Send the gesture to the server
    if (roomManager && roomManager->gestureEventSender) {
        roomManager->sendGestureEvent(
            roomManager->getRoomId(),
            deviceId,
            gesture,
            confidence,
            cardId
        );
    } else {
        std::cerr << "[GameState.cpp] Cannot send gesture - gestureEventSender is null" << std::endl;
    }
    
    // Update display if needed
    if (displayManager) {
        displayManager->displayGestureConfirmed(gesture);
    }
    
    // Send round end event after handling the gesture
    sendRoundEndEvent();
} 