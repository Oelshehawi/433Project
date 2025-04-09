#include "DisplayManager.h"
#include <iostream>
#include <iomanip>
#include "GameState.h"
#include "lcd_display.h"

DisplayManager::DisplayManager(GameState* gameState) 
    : gameState(gameState) {
}

DisplayManager::~DisplayManager() {
    // Nothing to clean up
}

void DisplayManager::updateCardAndGameDisplay(bool showOutput) {
    // Only log when debugging display issues or when showOutput is true
    if (showOutput) {
        std::cout << "\n[DisplayManager.cpp] ====== UPDATING DISPLAY ======" << std::endl;
    }
    
    if (!gameState) {
        std::cerr << "[DisplayManager.cpp] ERROR: GameState not set for DisplayManager" << std::endl;
        return;
    }
    
    // Get card counts
    int attackCount = 0;
    int defendCount = 0;
    int buildCount = 0;
    gameState->getCardCounts(attackCount, defendCount, buildCount);
    
    // Get the current timer value
    int timeRemaining = gameState->getCurrentTurnTimeRemaining();
    int roundNumber = gameState->getCurrentRoundNumber();
    
    // Debug info about what we're displaying - only if showOutput is true
    if (showOutput) {
        std::cout << "[DisplayManager.cpp] Display update called with:" << std::endl;
        std::cout << "[DisplayManager.cpp] Round: " << roundNumber << std::endl;
        std::cout << "[DisplayManager.cpp] Time remaining: " << timeRemaining << " seconds" << std::endl;
        std::cout << "[DisplayManager.cpp] Cards: ATK:" << attackCount << " DEF:" << defendCount << " BLD:" << buildCount << std::endl;
        std::cout << "[DisplayManager.cpp] Timer stopped: " << (gameState->isTimerRunning() ? "No" : "Yes") << std::endl;
    }
    
    // Create game info display
    char line1[32];
    char line2[32];
    char line3[32];
    
    // Format the header line with round info
    snprintf(line1, sizeof(line1), "=ROUND %d=", roundNumber);
    
    // Format the card type counts
    snprintf(line2, sizeof(line2), "ATK:%d DEF:%d BLD:%d", attackCount, defendCount, buildCount);
    
    // Format countdown timer based on timer status
    if (!gameState->isTimerRunning()) {
        snprintf(line3, sizeof(line3), "TIME: %d sec (PAUSED)", timeRemaining);
    } else {
        snprintf(line3, sizeof(line3), "TIME: %d sec", timeRemaining);
    }
    
    // Debug output before displaying - only if showOutput is true
    if (showOutput) {
        std::cout << "[DisplayManager.cpp] LCD Line 1: " << line1 << std::endl;
        std::cout << "[DisplayManager.cpp] LCD Line 2: " << line2 << std::endl;
        std::cout << "[DisplayManager.cpp] LCD Line 3: " << line3 << std::endl;
    }
    
    // Display the summary on LCD
    if (showOutput) {
        std::cout << "[DisplayManager.cpp] Sending to LCD via lcd_place_message..." << std::endl;
    }
    char* cardMsg[] = {line1, line2, line3};
    lcd_place_message(cardMsg, 3, lcd_center);
    if (showOutput) {
        std::cout << "[DisplayManager.cpp] LCD update complete" << std::endl;
    }
    
    // Also log to console - but limit output to reduce spam
    static int lastTimeRemaining = -1;
    static int lastRoundNumber = -1;
    
    // Only log in these cases:
    // 1. Round number changed (new round)
    // 2. First display after initialization (lastTimeRemaining == -1)
    // 3. Timer status has changed (we're now displaying TIMER STOPPED)
    // 4. showOutput is true (explicit update request)
    bool shouldLog = (lastRoundNumber != roundNumber ||    // Round changed
                     lastTimeRemaining == -1 ||           // First display
                     !gameState->isTimerRunning()) &&      // Timer just stopped
                     showOutput;                          // Only if showOutput is true
                    
    if (shouldLog) {
        std::cout << "\n************************************" << std::endl;
        std::cout << "*       GAME STATE UPDATE        *" << std::endl;
        std::cout << "************************************" << std::endl;
        std::cout << "* ROUND: " << roundNumber << std::endl;
        
        if (!gameState->isTimerRunning()) {
            std::cout << "* TIME:  " << timeRemaining << "s (PAUSED)" << std::endl;
        } else {
            std::cout << "* TIME:  " << timeRemaining << "s" << std::endl;
        }
        
        std::cout << "* CARDS: ATK:" << attackCount << " DEF:" << defendCount << " BLD:" << buildCount << std::endl;
        std::cout << "************************************\n" << std::endl;
    }
    
    // Update the stored values
    lastTimeRemaining = timeRemaining;
    lastRoundNumber = roundNumber;
    
    if (showOutput) {
        std::cout << "[DisplayManager.cpp] ====== DISPLAY UPDATE COMPLETE ======\n" << std::endl;
    }
}

void DisplayManager::displayRoundStart(int roundNumber, int timeRemaining) {
    // Update the LCD with round information
    char line1[32];
    char line2[32];
    
    snprintf(line1, sizeof(line1), "ROUND %d STARTED", roundNumber);
    snprintf(line2, sizeof(line2), "Time: %d sec", timeRemaining);
    
    char* startRoundMsg[] = {line1, line2};
    lcd_place_message(startRoundMsg, 2, lcd_center);
    
    std::cout << "Round " << roundNumber << " started with " << timeRemaining << " seconds" << std::endl;
}

void DisplayManager::displayRoundEndConfirmation(int roundNumber, const std::string& status) {
    // Display round end message
    char line1[32];
    char line2[32];
    
    snprintf(line1, sizeof(line1), "ROUND %d COMPLETE", roundNumber);
    
    // Different second line based on status
    if (status == "accepted") {
        snprintf(line2, sizeof(line2), "Move accepted!");
    } 
    else if (status == "rejected") {
        snprintf(line2, sizeof(line2), "Move rejected!");
    }
    else {
        // Default waiting message
        snprintf(line2, sizeof(line2), "Waiting for next round...");
    }
    
    char* endRoundMsg[] = {line1, line2};
    lcd_place_message(endRoundMsg, 2, lcd_center);
    
    std::cout << "[DisplayManager.cpp] Round " << roundNumber << " ended. Status: " << status << std::endl;
}

void DisplayManager::displayGameStarting() {
    char* startingMsg[] = {"Game starting", "Get ready..."};
    lcd_place_message(startingMsg, 2, lcd_center);
    
    std::cout << "Game is starting soon..." << std::endl;
}

void DisplayManager::displayGameStarted() {
    char* gameStartMsg[] = {"Game Started!", "Waiting for cards..."};
    lcd_place_message(gameStartMsg, 2, lcd_center);
    
    std::cout << "Game has started!" << std::endl;
}

void DisplayManager::displayGameEnded(bool isWinner) {
    char line1[32];
    char line2[32];
    
    snprintf(line1, sizeof(line1), "%s", isWinner ? "You Won!" : "You Lost");
    snprintf(line2, sizeof(line2), "Game Over");
    
    char* gameEndMsg[] = {line1, line2};
    lcd_place_message(gameEndMsg, 2, lcd_center);
    
    std::cout << "Game ended. " << (isWinner ? "You won!" : "You lost.") << std::endl;
}

void DisplayManager::displayRoomList(const std::vector<Room>& rooms) {
    if (rooms.empty()) {
        char* noRoomsMsg[] = {"No rooms available", "Create a new room"};
        lcd_place_message(noRoomsMsg, 2, lcd_center);
        
        std::cout << "No rooms available. Try creating a new room." << std::endl;
        return;
    }
    
    // Display room count on LCD
    char line1[32];
    char line2[32];
    
    snprintf(line1, sizeof(line1), "Available Rooms: %d", (int)rooms.size());
    snprintf(line2, sizeof(line2), "Check console for list");
    
    char* roomsMsg[] = {line1, line2};
    lcd_place_message(roomsMsg, 2, lcd_center);
    
    // Detailed list on console
    std::cout << "Available rooms:" << std::endl;
    std::cout << "--------------------------------------------------------" << std::endl;
    std::cout << std::left << std::setw(24) << "Room ID" << " | "
              << std::setw(25) << "Name" << " | "
              << std::setw(10) << "Players" << " | "
              << std::setw(10) << "Status" << std::endl;
    std::cout << "--------------------------------------------------------" << std::endl;
    
    for (const auto& room : rooms) {
        std::cout << std::left << std::setw(24) << room.id << " | "
                  << std::setw(25) << room.name << " | "
                  << std::setw(10) << room.playerCount << "/" << room.maxPlayers << " | "
                  << std::setw(10) << room.status << std::endl;
    }
    
    std::cout << "--------------------------------------------------------" << std::endl;
}

void DisplayManager::displayAutoPlay(const std::string& cardType) {
    char line1[32];
    char line2[32];
    
    snprintf(line1, sizeof(line1), "AUTO-PLAY");
    snprintf(line2, sizeof(line2), "Card: %s", cardType.c_str());
    
    char* autoPlayMsg[] = {line1, line2};
    lcd_place_message(autoPlayMsg, 2, lcd_center);
    
    std::cout << "Auto-playing a " << cardType << " card" << std::endl;
}

void DisplayManager::displayWaitingForResponse(const std::string& requestType) {
    char line1[32];
    char line2[32];
    
    snprintf(line1, sizeof(line1), "Waiting for response");
    snprintf(line2, sizeof(line2), "Request: %s", requestType.c_str());
    
    char* waitingMsg[] = {line1, line2};
    lcd_place_message(waitingMsg, 2, lcd_center);
}

void DisplayManager::displayRoomConnection(const std::string& roomName, int playerCount, int maxPlayers) {
    char line1[32];
    char line2[32];
    
    snprintf(line1, sizeof(line1), "Connected to room:");
    snprintf(line2, sizeof(line2), "%s (%d/%d)", roomName.c_str(), playerCount, maxPlayers);
    
    char* connectedMsg[] = {line1, line2};
    lcd_place_message(connectedMsg, 2, lcd_center);
    
    std::cout << "Connected to room: " << roomName << " (" << playerCount << "/" << maxPlayers << ")" << std::endl;
}

void DisplayManager::displayError(const std::string& errorMessage) {
    char line1[32];
    char line2[32];
    
    snprintf(line1, sizeof(line1), "ERROR");
    snprintf(line2, sizeof(line2), "%s", errorMessage.c_str());
    
    char* errorMsg[] = {line1, line2};
    lcd_place_message(errorMsg, 2, lcd_center);
    
    std::cerr << "Error: " << errorMessage << std::endl;
}

void DisplayManager::displayMessage(const std::string& line1, const std::string& line2) {
    char msg1[32];
    char msg2[32];
    
    snprintf(msg1, sizeof(msg1), "%s", line1.c_str());
    snprintf(msg2, sizeof(msg2), "%s", line2.c_str());
    
    char* message[] = {msg1, msg2};
    lcd_place_message(message, 2, lcd_center);
    
    std::cout << line1 << " - " << line2 << std::endl;
}

void DisplayManager::displayWaitingForNextRound(int completedRound) {
    char line1[32];
    char line2[32];
    
    snprintf(line1, sizeof(line1), "ROUND %d COMPLETE", completedRound);
    snprintf(line2, sizeof(line2), "Waiting for next round...");
    
    char* waitingMsg[] = {line1, line2};
    lcd_place_message(waitingMsg, 2, lcd_center);
    
    std::cout << "Round " << completedRound << " completed. Waiting for next round to start..." << std::endl;
}

void DisplayManager::displayGestureConfirmed(const std::string& gesture) {
    char line1[32];
    char line2[32];
    
    snprintf(line1, sizeof(line1), "GESTURE SENT");
    snprintf(line2, sizeof(line2), "%s", gesture.c_str());
    
    char* gestureMsg[] = {line1, line2};
    lcd_place_message(gestureMsg, 2, lcd_center);
    
    std::cout << "Gesture " << gesture << " confirmed and sent" << std::endl;
} 