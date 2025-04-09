#pragma once

#include <string>
#include <nlohmann/json.hpp>
#include "WebSocketClient.h"
#include "GameState.h"

// Forward declarations
class RoomManager;
class GameState;

// For convenience
using json = nlohmann::json;

class MessageHandler {
private:
    RoomManager* roomManager;
    GameState* gameState;
    WebSocketClient* client;

public:
    MessageHandler(RoomManager* roomManager, GameState* gameState, WebSocketClient* client);
    ~MessageHandler();

    // Main message handling function
    void handleMessage(const std::string& message);

    // Specific event handlers
    void handleRoomUpdated(const json& payload);
    void handleRoomList(const json& payload);
    void handleJoinRoom(const json& payload);
    void handleLeaveRoom(const json& payload);
    void handlePlayerReady(const json& payload);
    void handleRoundStart(const json& payload);
    void handleRoundEnd(const json& payload);
    void handleGameStarting(const json& payload);
    void handleGameStarted(const json& payload);
    void handleGameEnded(const json& payload);
    void handleGameStateUpdate(const json& payload);
    void handleBeagleBoardCommand(const json& payload);
    void handleGestureEvent(const json& payload);
    void handleMoveStatus(const json& payload);
    void handleMoveAccepted(const json& payload);
}; 