#include "GameState.h"
#include "RoomManager.h"
#include "DisplayManager.h"
#include "GestureDetector.h"
#include "GestureEventSender.h"
#include <iostream>
#include <algorithm>
#include <random>
#include <atomic>

GameState::GameState(RoomManager* roomManager, DisplayManager* displayManager, const std::string& deviceId)
    : roomManager(roomManager), displayManager(displayManager), deviceId(deviceId),
      gameInProgress(false), currentRoundNumber(1), currentTurnTimeRemaining(0),
      roundEndReceived(false), timerActive(false), timerThreadRunning(false), needDisplayUpdate(false) {
}

GameState::~GameState() {
    stopTimerThread();
}

void GameState::startTimerThread() {
    // ONLY call this from the updateTimerFromEvent method (round_start event)
    std::cout << "[GameState.cpp] *** STARTING TIMER THREAD (should only happen on round_start) ***" << std::endl;
    
    // Kill any existing timer thread first
    stopTimerThread();
    
    // Set flags
    timerActive = true;
    timerThreadRunning = true;
    
    // Create new thread
    std::lock_guard<std::mutex> lock(timerMutex);
    timerThread = std::thread(&GameState::updateTimer, this);
    
    std::cout << "[GameState.cpp] Timer thread started successfully" << std::endl;
}

void GameState::stopTimerThread() {
    std::cout << "[GameState.cpp] *** STOPPING TIMER THREAD ***" << std::endl;
    
    // Set both flags to false first
    timerActive = false;
    timerThreadRunning = false;
    
    // Join thread if it exists
    {
        std::lock_guard<std::mutex> lock(timerMutex);
        if (timerThread.joinable()) {
            std::cout << "[GameState.cpp] Joining timer thread..." << std::endl;
            timerThread.join();
            std::cout << "[GameState.cpp] Timer thread joined successfully" << std::endl;
        }
    }
    
    // Update display to show timer stopped
    if (displayManager) {
        displayManager->updateCardAndGameDisplay(false);
    }
    
    std::cout << "[GameState.cpp] Timer thread fully stopped" << std::endl;
}

void GameState::updateTimer() {
    std::cout << "[GameState.cpp] Timer thread running" << std::endl;
    
    while (timerThreadRunning && timerActive) {
        // Sleep for 1 second
        std::this_thread::sleep_for(std::chrono::seconds(1));
        
        // Check if we should exit
        if (!timerActive || !timerThreadRunning) {
            break;
        }
        
        // Decrement timer
        if (currentTurnTimeRemaining > 0) {
            currentTurnTimeRemaining--;
            
            // Update display
            if (displayManager) {
                displayManager->updateCardAndGameDisplay(false);
            }
        }
        
        // Check if timer expired
        if (currentTurnTimeRemaining <= 0) {
            std::cout << "[GameState.cpp] Timer expired - auto-playing card" << std::endl;
            
            // Stop timer explicitly
            timerActive = false;
            timerThreadRunning = false;
            
            // Auto-play card
            autoPlayCard();
            break;
        }
    }
    
    std::cout << "[GameState.cpp] Timer thread exiting" << std::endl;
}

void GameState::updateTimerFromEvent(const json& roundStartPayload) {
    std::cout << "[GameState.cpp] Received round_start event - initializing timer" << std::endl;
    
    // Update round number
    if (roundStartPayload.contains("roundNumber")) {
        int newRoundNumber = roundStartPayload["roundNumber"];
        currentRoundNumber = newRoundNumber;
    }
    
    // Set timer to fixed 30 seconds
    currentTurnTimeRemaining = 30; // Fixed 30 seconds per round
    lastTimerUpdate = std::chrono::steady_clock::now();
    
    // Handle cards if they're included in round_start payload (new format)
    bool foundCards = false;
    std::cout << "[GameState.cpp] roundStartPayload: " << roundStartPayload.dump() << std::endl;
    if (roundStartPayload.contains("playerCards") && roundStartPayload["playerCards"].is_object()) {
        // Look for our device ID in the payload
        std::string ourDeviceId = deviceId;
        
        if (roundStartPayload["playerCards"].contains(ourDeviceId)) {
            // We found our cards
            const json& ourCards = roundStartPayload["playerCards"][ourDeviceId];
            
            // Clear the existing card map and vector
            playerCards.clear();
            lastReceivedCards.clear();
            
            // Process each card
            for (const auto& card : ourCards) {
                if (card.contains("id") && card.contains("type") && card.contains("name")) {
                    std::string cardId = card["id"];
                    std::string cardType = card["type"];
                    std::string cardName = card["name"];
                    std::string cardDescription = card.contains("description") ? card["description"].get<std::string>() : "";
                    
                    // Add to our map of card types to card IDs
                    playerCards[cardType] = cardId;
                    
                    // Also add to lastReceivedCards for display purposes
                    Card newCard;
                    newCard.id = cardId;
                    newCard.type = cardType;
                    newCard.name = cardName;
                    newCard.description = cardDescription;
                    lastReceivedCards.push_back(newCard);
                }
            }
            
            foundCards = true;
        }
    }
    
    // Force a display update to show the new round and cards
    if (displayManager) {
        displayManager->updateCardAndGameDisplay(true);
    }
    
    // CRITICAL: This is the ONLY place where we should start the timer thread
    std::cout << "[GameState.cpp] Starting timer thread in response to round_start event" << std::endl;
    startTimerThread();
}

void GameState::processCards(const json& cardsPayload) {
    if (!cardsPayload.contains("cards")) {
        return;
    }
    
    // Check if timer needs initialization (cards received before round_start)
    if (currentTurnTimeRemaining <= 0) {
        currentTurnTimeRemaining = 30; // Default 30 seconds
        timerActive = true;
        needDisplayUpdate = true; // Set flag to trigger display update
        
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
        needDisplayUpdate = false; // Reset flag after update
    }
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
    try {
        // Only send round_end_ack if we actually received a round_end event
        if (!roundEndReceived) {
            std::cout << "[GameState.cpp] Not sending round_end_ack because no round_end was received" << std::endl;
            return;
        }

        if (!roomManager) {
            std::cerr << "[GameState.cpp] ERROR: Cannot send round_end_ack - roomManager not set" << std::endl;
            return;
        }
        
        if (!roomManager->client) {
            std::cerr << "[GameState.cpp] ERROR: Cannot send round_end_ack - websocket client not initialized" << std::endl;
            return;
        }
        
        // Stop gesture detection if it's running
        if (roomManager->gestureDetector && roomManager->gestureDetector->isRunning()) {
            try {
                roomManager->gestureDetector->stop();
            } catch (const std::exception& e) {
                std::cerr << "[GameState.cpp] Error stopping gesture detector: " << e.what() << std::endl;
                // Continue anyway - this is a non-critical error
            }
        }
        
        // Stop the timer thread to ensure it doesn't continue running
        try {
            stopTimerThread();
        } catch (const std::exception& e) {
            std::cerr << "[GameState.cpp] Error stopping timer thread: " << e.what() << std::endl;
            // Continue anyway - this is a non-critical error
        }
        
        // Create and send round_end_ack event
        try {
            json payload = json::object();
            payload["roomId"] = roomManager->getRoomId();
            payload["playerId"] = deviceId;
            payload["roundNumber"] = currentRoundNumber;
            
            json message = json::object();
            message["event"] = "round_end_ack";  // IMPORTANT: This must match what the server expects
            message["payload"] = payload;
            
            std::string messageStr = message.dump();
            
            std::cout << "[GameState.cpp] Sending round_end_ack for round " << currentRoundNumber << std::endl;
            
            // Safely send the message
            bool sendResult = false;
            try {
                sendResult = roomManager->client->sendMessage(messageStr);
                if (!sendResult) {
                    std::cerr << "[GameState.cpp] Failed to send round_end_ack message" << std::endl;
                }
                roomManager->client->ensureMessageProcessing();
            } catch (const std::exception& e) {
                std::cerr << "[GameState.cpp] Exception sending round_end_ack: " << e.what() << std::endl;
            }
            
            // Reset the roundEndReceived flag after sending the ack
            roundEndReceived = false;
        } catch (const std::exception& e) {
            std::cerr << "[GameState.cpp] Error creating round_end_ack message: " << e.what() << std::endl;
        }
        
        // Update display to show "Waiting for next round" message
        if (displayManager) {
            try {
                displayManager->displayWaitingForNextRound(currentRoundNumber);
            } catch (const std::exception& e) {
                std::cerr << "[GameState.cpp] Error updating display for round end: " << e.what() << std::endl;
            }
        }
    } catch (const std::exception& e) {
        std::cerr << "[GameState.cpp] Unexpected exception in sendRoundEndEvent: " << e.what() << std::endl;
    } catch (...) {
        std::cerr << "[GameState.cpp] Unknown exception in sendRoundEndEvent" << std::endl;
    }
}

void GameState::autoPlayCard() {
    // Add a static flag to track if we're already auto-playing
    static std::atomic<bool> alreadyAutoPlaying{false};
    
    // Double-check timer has actually stopped to avoid race conditions
    if (timerActive || timerThreadRunning) {
        std::cout << "[GameState.cpp] WARNING: Timer still active during auto-play attempt, stopping it..." << std::endl;
        stopTimerThread();
    }
    
    // If we're already in the process of auto-playing, don't do it again
    if (alreadyAutoPlaying) {
        std::cout << "[GameState.cpp] Prevented duplicate auto-play attempt" << std::endl;
        return;
    }
    
    // Set flag to indicate we're processing an auto-play
    if (!alreadyAutoPlaying.exchange(true)) {
        std::cout << "[GameState.cpp] Starting auto-play sequence..." << std::endl;
    } else {
        std::cout << "[GameState.cpp] Another thread already started auto-play" << std::endl;
        return;
    }
    
    try {
        // Ensure we have cards to play
        if (playerCards.empty()) {
            std::cout << "[GameState.cpp] No cards available for auto-play" << std::endl;
            sendRoundEndEvent(); // Still send round end even if no cards
            alreadyAutoPlaying = false; // Reset flag before returning
            return;
        }
        
        // Safely get card count to prevent out-of-bounds errors
        size_t cardCount = playerCards.size();
        if (cardCount == 0) {
            std::cout << "[GameState.cpp] Player cards count is zero, cannot auto-play" << std::endl;
            alreadyAutoPlaying = false;
            return;
        }
        
        std::cout << "[GameState.cpp] Auto-playing from " << cardCount << " available cards" << std::endl;
        
        // Choose a card randomly from the available cards - with bounds protection
        std::random_device rd;
        std::mt19937 gen(rd());
        std::uniform_int_distribution<> distrib(0, std::max(0, static_cast<int>(cardCount) - 1));
        size_t cardIndex = distrib(gen);
        
        // Safety check to ensure cardIndex is valid
        if (cardIndex >= cardCount) {
            std::cout << "[GameState.cpp] ERROR: Card index out of bounds, using first card" << std::endl;
            cardIndex = 0;
        }
        
        // Get an iterator to the selected card - with safety checks
        std::string cardType, cardId;
        
        // Safe iterator approach
        try {
            auto it = playerCards.begin();
            // Safely advance iterator
            for (size_t i = 0; i < cardIndex && it != playerCards.end(); ++i) {
                ++it;
            }
            
            // Check if iterator is valid
            if (it != playerCards.end()) {
                // Extract card information
                cardType = it->first;
                cardId = it->second;
            } else {
                // Fallback to first card if iterator ended up invalid
                if (!playerCards.empty()) {
                    auto firstCard = playerCards.begin();
                    cardType = firstCard->first;
                    cardId = firstCard->second;
                } else {
                    throw std::runtime_error("No valid cards to play");
                }
            }
        } catch (const std::exception& e) {
            std::cerr << "[GameState.cpp] Error accessing card: " << e.what() << std::endl;
            alreadyAutoPlaying = false;
            return;
        }
        
        if (cardType.empty() || cardId.empty()) {
            std::cerr << "[GameState.cpp] Error: Selected card has empty type or ID" << std::endl;
            alreadyAutoPlaying = false;
            return;
        }
        
        std::cout << "[GameState.cpp] Auto-playing card: " << cardType << " (Card ID: " << cardId << ")" << std::endl;
        
        // Send the gesture event
        if (roomManager && roomManager->gestureEventSender) {
            try {
                roomManager->sendGestureEvent(
                    roomManager->getRoomId(), 
                    deviceId, 
                    cardType, 
                    0.95, // Default confidence value
                    cardId
                );
            } catch (const std::exception& e) {
                std::cerr << "[GameState.cpp] Error sending gesture event: " << e.what() << std::endl;
            }
        }
        
        // Update display back to cards and game info (without console output)
        if (displayManager) {
            try {
                displayManager->updateCardAndGameDisplay(false);
            } catch (const std::exception& e) {
                std::cerr << "[GameState.cpp] Error updating display: " << e.what() << std::endl;
            }
        }
        
        // Send round end event after auto-playing
        try {
            sendRoundEndEvent();
        } catch (const std::exception& e) {
            std::cerr << "[GameState.cpp] Error sending round end event: " << e.what() << std::endl;
        }
    }
    catch (const std::exception& e) {
        std::cerr << "[GameState.cpp] Error during auto-play: " << e.what() << std::endl;
    }
    catch (...) {
        std::cerr << "[GameState.cpp] Unknown error during auto-play" << std::endl;
    }
    
    // Reset auto-play flag
    alreadyAutoPlaying = false;
    std::cout << "[GameState.cpp] Auto-play sequence completed" << std::endl;
}

void GameState::handleConfirmedGesture(const std::string& gesture, float confidence, const std::string& cardId) {
    // CRITICAL: Stop timer immediately when rotary encoder is pressed (BEFORE anything else)
    std::cout << "[GameState.cpp] ROTARY BUTTON PRESSED - STOPPING TIMER IMMEDIATELY" << std::endl;
    
    // Double-safety - set flags directly AND call the stop method
    timerActive = false;
    timerThreadRunning = false;
    currentTurnTimeRemaining = 0;
    stopTimerThread();
    
    std::cout << "[GameState.cpp] Handling confirmed gesture: " << gesture << std::endl;
    
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
    
    // Update display to show confirmed gesture
    if (displayManager) {
        displayManager->displayGestureConfirmed(gesture);
    }
    
    // Send round end event after handling the gesture
    sendRoundEndEvent();
} 