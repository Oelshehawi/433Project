#pragma once

#include <string>
#include <vector>
#include "GameState.h"

// Forward declarations
class GameState;
struct Card;

class DisplayManager {
private:
    GameState* gameState;

public:
    DisplayManager(GameState* gameState);
    ~DisplayManager();

    // Display methods
    void updateCardAndGameDisplay(bool showOutput = true);
    void displayRoundStart(int roundNumber, int timeRemaining);
    void displayRoundEndConfirmation(int roundNumber, const std::string& status = "waiting");
    void displayWaitingForNextRound(int completedRound);
    void displayGameStarting();
    void displayGameStarted();
    void displayGameEnded(bool isWinner);
    void displayRoomList(const std::vector<struct Room>& rooms);
    void displayAutoPlay(const std::string& cardType);
    void displayWaitingForResponse(const std::string& requestType);
    void displayRoomConnection(const std::string& roomName, int playerCount, int maxPlayers);
    void displayError(const std::string& errorMessage);
    void displayMessage(const std::string& line1, const std::string& line2);
    void displayGestureConfirmed(const std::string& gesture);
    
    // Set the GameState (needed to resolve circular reference)
    void setGameState(GameState* gs) { gameState = gs; }
}; 