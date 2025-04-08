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
    // Check if timer thread is marked as running but not joinable
    {
        std::lock_guard<std::mutex> checkLock(timerMutex);
        if (timerThreadRunning && !timerThread.joinable()) {
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
        stopTimerThread();
    }
    
    // Now set up the new timer thread
    std::lock_guard<std::mutex> lock(timerMutex);
    
    // Ensure both flags are set properly
    timerThreadRunning = true;
    timerActive = true;
    
    // Detach any previous thread if it's still joinable
    if (timerThread.joinable()) {
        timerThread.join();
    }
    
    timerThread = std::thread(&GameState::updateTimer, this);
}

void GameState::updateTimer() {
    int debugCounter = 0;
    while (timerThreadRunning && timerActive) {
        // Debug counter to track iterations
        debugCounter++;
        
        // Sleep for 1 second
        std::this_thread::sleep_for(std::chrono::seconds(1));
        
        // Update the timer
        {
            std::lock_guard<std::mutex> lock(timerMutex);
            
            if (currentTurnTimeRemaining > 0) {
                currentTurnTimeRemaining--;
                
                // Update the display with the new time
                if (displayManager) {
                    // Force a display update every second to show timer changing
                    displayManager->updateCardAndGameDisplay(false);
                }
            }
            
            // If time has run out, auto-play a card
            if (currentTurnTimeRemaining <= 0 && timerActive) {
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
    }
}

void GameState::stopTimerThread() {
    std::lock_guard<std::mutex> lock(timerMutex);
    
    if (timerThreadRunning) {
        timerThreadRunning = false;
        timerActive = false;
        
        // Wait for thread to finish if it's joinable
        if (timerThread.joinable()) {
            timerThread.join();
        }
    }
}

void GameState::updateTimerFromEvent(const json& roundStartPayload) {
    // Update round number
    if (roundStartPayload.contains("roundNumber")) {
        int newRoundNumber = roundStartPayload["roundNumber"];
        currentRoundNumber = newRoundNumber;
    }
    
    // Always set the timer first to ensure we have a proper countdown
    currentTurnTimeRemaining = 30; // Fixed 30 seconds per round
    lastTimerUpdate = std::chrono::steady_clock::now();
    timerActive = true;
    
    // Handle cards if they're included in round_start payload (new format)
    bool foundCards = false;
    std::cout << "roundStartPayload: " << roundStartPayload.dump() << std::endl;
    if (roundStartPayload.contains("playerCards") && roundStartPayload["playerCards"].is_object()) {
        // Look for our device ID in the payload
        std::string ourDeviceId = deviceId;
        
        if (roundStartPayload["playerCards"].contains(ourDeviceId)) {
            // We found our cards
            const json& ourCards = roundStartPayload["playerCards"][ourDeviceId];
            
            // Clear the existing card map
            playerCards.clear();
            
            // Process each card
            for (const auto& card : ourCards) {
                if (card.contains("id") && card.contains("type") && card.contains("name")) {
                    std::string cardId = card["id"];
                    std::string cardType = card["type"];
                    std::string cardName = card["name"];
                    
                    // Add to our map of card types to card IDs
                    playerCards[cardType] = cardId;
                }
            }
            
            foundCards = true;
        }
    }
    
    // If we didn't find cards in the round_start payload, see if we have cached cards
    if (!foundCards && playerCards.empty()) {
        // We don't have cards - this is unusual but we'll handle it
        // Not logging an error to keep the logs clean
    }
    
    // Force a display update to show the new round and cards
    if (displayManager) {
        displayManager->updateCardAndGameDisplay(true);
    }
    
    // Start the timer thread
    startTimerThread();
}

void GameState::processCardsDirectly(const json& cardsPayload) {
    if (!cardsPayload.contains("cards")) {
        return;
    }
    
    // Clear the current cards
    lastReceivedCards.clear();
    
    // Also clear the playerCards map
    playerCards.clear();
    
    // Parse the cards
    for (const auto& cardJson : cardsPayload["cards"]) {
        Card card;
        card.id = cardJson.contains("id") ? cardJson["id"].get<std::string>() : "";
        card.type = cardJson.contains("type") ? cardJson["type"].get<std::string>() : "";
        card.name = cardJson.contains("name") ? cardJson["name"].get<std::string>() : "";
        card.description = cardJson.contains("description") ? cardJson["description"].get<std::string>() : "";
        
        lastReceivedCards.push_back(card);
        
        // Add to playerCards map if we have valid type and ID
        if (!card.type.empty() && !card.id.empty()) {
            playerCards[card.type] = card.id;
        }
    }
}

void GameState::processCards(const json& cardsPayload) {
    if (!cardsPayload.contains("cards")) {
        return;
    }
    
    // Check if timer needs initialization (cards received before round_start)
    if (currentTurnTimeRemaining <= 0) {
        currentTurnTimeRemaining = 30; // Default 30 seconds
        timerActive = true;
        
        // Start the timer thread if needed
        if (!timerThreadRunning) {
            startTimerThread();
        }
    }
    
    // Clear the current cards
    lastReceivedCards.clear();
    
    // Also clear the playerCards map
    playerCards.clear();
    
    // Parse the cards
    for (const auto& cardJson : cardsPayload["cards"]) {
        Card card;
        card.id = cardJson.contains("id") ? cardJson["id"].get<std::string>() : "";
        card.type = cardJson.contains("type") ? cardJson["type"].get<std::string>() : "";
        card.name = cardJson.contains("name") ? cardJson["name"].get<std::string>() : "";
        card.description = cardJson.contains("description") ? cardJson["description"].get<std::string>() : "";
        
        lastReceivedCards.push_back(card);
        
        // Add to playerCards map if we have valid type and ID
        if (!card.type.empty() && !card.id.empty()) {
            playerCards[card.type] = card.id;
        }
    }
    
    // Display the cards and current game state
    if (displayManager) {
        displayManager->updateCardAndGameDisplay(false);
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
        if (!roomManager) {
        }
        if (roomManager && !roomManager->client) {
        }
        return;
    }
    
    // Check the playerCards map state
    if (!playerCards.empty()) {
    }
    
    // Stop gesture detection if it's running
    if (roomManager->gestureDetector && roomManager->gestureDetector->isRunning()) {
        roomManager->gestureDetector->stop();
    }
    
    // Stop the timer thread to ensure it doesn't continue running
    stopTimerThread();
    
    // Create and send round_end_ack event
    json payload = json::object();
    payload["roomId"] = roomManager->getRoomId();
    payload["playerId"] = deviceId;
    payload["roundNumber"] = currentRoundNumber;
    
    json message = json::object();
    message["event"] = "round_end_ack";  // IMPORTANT: This must match what the server expects
    message["payload"] = payload;
    
    std::string messageStr = message.dump();
    
    bool sendResult = roomManager->client->sendMessage(messageStr);
    roomManager->client->ensureMessageProcessing();
    
    // Update display to show "Waiting for next round" message
    if (displayManager) {
        displayManager->displayWaitingForNextRound(currentRoundNumber);
    }
}

void GameState::autoPlayCard() {
    // Ensure we have cards to play
    if (playerCards.empty()) {
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
    
    // Send the gesture event
    if (roomManager && roomManager->gestureEventSender) {
        roomManager->sendGestureEvent(
            roomManager->getRoomId(), 
            deviceId, 
            cardType, 
            0.95, // Default confidence value
            cardId
        );
    }
    
    // Update display back to cards and game info (without console output)
    if (displayManager) {
        displayManager->updateCardAndGameDisplay(false);
    }
    
    // Send round end event after auto-playing
    sendRoundEndEvent();
}

void GameState::handleConfirmedGesture(const std::string& gesture, float confidence, const std::string& cardId) {
    // Send the gesture to the server
    if (roomManager && roomManager->gestureEventSender) {
        roomManager->sendGestureEvent(
            roomManager->getRoomId(),
            deviceId,
            gesture,
            confidence,
            cardId
        );
    }
    
    // Update display if needed
    if (displayManager) {
        displayManager->displayGestureConfirmed(gesture);
    }
    
    // Send round end event after handling the gesture
    sendRoundEndEvent();
} 