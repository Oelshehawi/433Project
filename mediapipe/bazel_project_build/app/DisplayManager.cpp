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

void DisplayManager::updateCardAndGameDisplay() {
    // Only log when debugging display issues
    // std::cout << "\n[DisplayManager.cpp] ====== UPDATING DISPLAY ======" << std::endl;
    
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
    
    // Debug info about what we're displaying - reduced verbosity
    // std::cout << "[DisplayManager.cpp] Display update called with:" << std::endl;
    // std::cout << "[DisplayManager.cpp] Round: " << roundNumber << std::endl;
    // std::cout << "[DisplayManager.cpp] Time remaining: " << timeRemaining << " seconds" << std::endl;
    // std::cout << "[DisplayManager.cpp] Cards: ATK:" << attackCount << " DEF:" << defendCount << " BLD:" << buildCount << std::endl;
    
    // Create game info display
    char line1[32];
    char line2[32];
    char line3[32];
    
    // Format the header line with round info
    snprintf(line1, sizeof(line1), "=ROUND %d=", roundNumber);
    
    // Format the card type counts
    snprintf(line2, sizeof(line2), "ATK:%d DEF:%d BLD:%d", attackCount, defendCount, buildCount);
    
    // Format countdown timer (both players move simultaneously)
    snprintf(line3, sizeof(line3), "TIME: %d sec", timeRemaining);
    
    // Debug output before displaying - reduced verbosity
    // std::cout << "[DisplayManager.cpp] LCD Line 1: " << line1 << std::endl;
    // std::cout << "[DisplayManager.cpp] LCD Line 2: " << line2 << std::endl;
    // std::cout << "[DisplayManager.cpp] LCD Line 3: " << line3 << std::endl;
    
    // Display the summary on LCD
    // std::cout << "[DisplayManager.cpp] Sending to LCD via lcd_place_message..." << std::endl;
    char* cardMsg[] = {line1, line2, line3};
    lcd_place_message(cardMsg, 3, lcd_center);
    // std::cout << "[DisplayManager.cpp] LCD update complete" << std::endl;
    
    // Also log to console - only log major changes to avoid excessive output
    static int lastTimeRemaining = -1;
    if (timeRemaining % 5 == 0 || timeRemaining <= 3 || lastTimeRemaining != timeRemaining) {
        std::cout << "\n************************************" << std::endl;
        std::cout << "*       GAME STATE UPDATE        *" << std::endl;
        std::cout << "************************************" << std::endl;
        std::cout << "* ROUND: " << roundNumber << std::endl;
        std::cout << "* TIME:  " << timeRemaining << "s" << std::endl;
        std::cout << "* CARDS: ATK:" << attackCount << " DEF:" << defendCount << " BLD:" << buildCount << std::endl;
        std::cout << "************************************\n" << std::endl;
    }
    lastTimeRemaining = timeRemaining;
    
    // std::cout << "[DisplayManager.cpp] ====== DISPLAY UPDATE COMPLETE ======\n" << std::endl;
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

void DisplayManager::displayRoundEnd(int roundNumber, bool isWinner) {
    // Display round end message
    char line1[32];
    char line2[32];
    
    snprintf(line1, sizeof(line1), "ROUND %d COMPLETE", roundNumber);
    snprintf(line2, sizeof(line2), "%s", isWinner ? "You Won!" : "You Lost");
    
    char* endRoundMsg[] = {line1, line2};
    lcd_place_message(endRoundMsg, 2, lcd_center);
    
    std::cout << "Round " << roundNumber << " ended. " << (isWinner ? "You won!" : "You lost.") << std::endl;
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