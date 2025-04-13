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
      roundEndReceived(false), timerRunning(false) {
}

GameState::~GameState() {
    stopTimer();
}

void GameState::startTimer(int seconds) {
    // Kill any existing timer thread first
    stopTimer();
    
    // Set time and flag
    currentTurnTimeRemaining = seconds;
    timerRunning = true;
    
    std::cout << "[GameState.cpp] Starting timer with " << seconds << " seconds" << std::endl;
    
    // Create new thread
    std::lock_guard<std::mutex> lock(timerMutex);
    timerThread = std::thread(&GameState::updateTimer, this);
}

void GameState::stopTimer() {
    // Log the current timer value before stopping
    std::cout << "[GameState.cpp] Stopping timer. Current time remaining: " << currentTurnTimeRemaining << "s" << std::endl;
    
    // Set flag to false
    timerRunning = false;
    
    // Join thread if it exists
    {
        std::lock_guard<std::mutex> lock(timerMutex);
        if (timerThread.joinable()) {
            timerThread.join();
        }
    }
    
    // Update display to show timer paused
    if (displayManager) {
        displayManager->updateCardAndGameDisplay(true);
    }
}

void GameState::updateTimer() {
    while (timerRunning) {
        // Sleep for 1 second
        std::this_thread::sleep_for(std::chrono::seconds(1));
        
        // Check if we should exit
        if (!timerRunning) {
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
            // Stop timer
            timerRunning = false;
            
            // Auto-play card when timer expires
            autoPlayCard();
            break;
        }
    }
}

void GameState::updateTimerFromEvent(const json& roundStartPayload) {
    std::cout << "[GameState.cpp] Received round_start event - initializing timer" << std::endl;
    
    // Update round number
    if (roundStartPayload.contains("roundNumber")) {
        int newRoundNumber = roundStartPayload["roundNumber"];
        currentRoundNumber = newRoundNumber;
    }
    
    // Handle cards if they're included in round_start payload (new format)
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
        }
    }
    
    // Force a display update to show the new round and cards
    if (displayManager) {
        displayManager->updateCardAndGameDisplay(true);
    }
    
    // Start the timer with default 30 seconds
    startTimer(30);
}

void GameState::processCards(const json& cardsPayload) {
    if (!cardsPayload.contains("cards")) {
        return;
    }
    
    // Clear the current cards
    lastReceivedCards.clear();
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
        displayManager->updateCardAndGameDisplay(true);
    }
    
    // Start timer if not already running
    if (!timerRunning) {
        startTimer();
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
        
        // Stop the timer to ensure it doesn't continue running
        try {
            stopTimer();
        } catch (const std::exception& e) {
            std::cerr << "[GameState.cpp] Error stopping timer: " << e.what() << std::endl;
            // Continue anyway - this is a non-critical error
        }
        
        // Create and send round_end_ack event
        try {
            json payload = json::object();
            payload["roomId"] = roomManager->getRoomId();
            payload["playerId"] = deviceId;
            payload["roundNumber"] = currentRoundNumber;
            
            json message = json::object();
            message["event"] = "round_end_ack"; 
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
    std::cout << "[GameState.cpp] autoPlayCard called - timer expired" << std::endl;
    
    // Don't check gameInProgress state anymore to ensure auto-play always works
    if (!roomManager) {
        std::cout << "[GameState.cpp] Auto-play skipped: roomManager is null" << std::endl;
        return;
    }
    
    // Stop gesture detection if it's running
    if (roomManager->gestureDetector && roomManager->gestureDetector->isRunning()) {
        std::cout << "[GameState.cpp] Stopping gesture detection due to timer expiration" << std::endl;
        roomManager->gestureDetector->stop();
    }
    
    // Choose a card type to play based on what's available
    std::string cardType = "attack"; // Default to attack if we have no cards
    std::string cardId = "";
    
    // Get card counts to see what's available
    int attackCount = 0, defendCount = 0, buildCount = 0;
    getCardCounts(attackCount, defendCount, buildCount);
    
    std::cout << "[GameState.cpp] Available cards - Attack: " << attackCount 
              << ", Defend: " << defendCount 
              << ", Build: " << buildCount << std::endl;
    
    // Choose the first available card type in order of preference: attack, defend, build
    if (attackCount > 0 && playerCards.find("attack") != playerCards.end()) {
        cardType = "attack";
        cardId = playerCards["attack"];
    } else if (defendCount > 0 && playerCards.find("defend") != playerCards.end()) {
        cardType = "defend";
        cardId = playerCards["defend"];
    } else if (buildCount > 0 && playerCards.find("build") != playerCards.end()) {
        cardType = "build";
        cardId = playerCards["build"];
    }
    
    std::cout << "[GameState.cpp] Auto-playing card type: " << cardType << " with ID: " << cardId << std::endl;
    
    // Send the gesture directly
    if (roomManager && roomManager->gestureEventSender) {
        roomManager->sendGestureEvent(
            roomManager->getRoomId(),
            deviceId,
            cardType,  // Use the card type as the gesture
            0.8,       // Default confidence
            cardId     // Use the actual card ID
        );
    }
    
    // Update display to show confirmed gesture
    if (displayManager) {
        displayManager->displayGestureConfirmed(cardType);
    }
}

void GameState::handleConfirmedGesture(const std::string& gesture, float confidence, const std::string& cardId) {
    // Log current timer value before stopping
    std::cout << "[GameState.cpp] Confirming gesture with " << currentTurnTimeRemaining << "s remaining" << std::endl;
    
    // Stop timer immediately
    stopTimer();
    
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
} 