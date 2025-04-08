#include "MessageHandler.h"
#include "RoomManager.h"
#include "GameState.h"
#include "DisplayManager.h"
#include <iostream>
#include <nlohmann/json.hpp>

// For convenience
using json = nlohmann::json;

MessageHandler::MessageHandler(RoomManager* roomManager, GameState* gameState, WebSocketClient* client)
    : roomManager(roomManager), gameState(gameState), client(client) {
}

MessageHandler::~MessageHandler() {
    // Nothing to clean up
}

void MessageHandler::handleMessage(const std::string& message) {
    try {
        // Parse message as JSON
        json j = json::parse(message);
        
        // Route to appropriate handler based on event type
        if (j.contains("event")) {
            std::string eventType = j["event"];
            
            if (eventType == "room_list") {
                if (j.contains("payload")) {
                    handleRoomList(j["payload"]);
                }
            }
            else if (eventType == "room_updated") {
                if (j.contains("payload")) {
                    handleRoomUpdated(j["payload"]);
                }
            }
            else if (eventType == "round_start") {
                if (j.contains("payload")) {
                    handleRoundStart(j["payload"]);
                }
            }
            else if (eventType == "round_end") {
                if (j.contains("payload")) {
                    handleRoundEnd(j["payload"]);
                }
            }
            else if (eventType == "game_started") {
                if (j.contains("payload")) {
                    handleGameStarted(j["payload"]);
                }
            }
            else if (eventType == "game_starting") {
                if (j.contains("payload")) {
                    handleGameStarting(j["payload"]);
                }
            }
            else if (eventType == "game_ended") {
                if (j.contains("payload")) {
                    handleGameEnded(j["payload"]);
                }
            }
            else if (eventType == "beagle_board_command") {
                if (j.contains("payload")) {
                    handleBeagleBoardCommand(j["payload"]);
                }
            }
            else if (eventType == "gesture_event") {
                if (j.contains("payload")) {
                    handleGestureEvent(j["payload"]);
                }
            }
            else {
                // For unimplemented handlers, just forward to the RoomManager's handler
                // This is a temporary bridge until we fully implement all handlers
                roomManager->handleMessage(message);
                return;
            }
        }
        
        // Reset loading state after processing the message
        roomManager->resetLoadingState();
        
    } catch (const json::parse_error& e) {
        std::cerr << "MessageHandler: Error parsing JSON message: " << e.what() << std::endl;
        // Simply log error and reset loading state
        roomManager->resetLoadingState();
    }
}

void MessageHandler::handleRoundStart(const json& payload) {
    std::cout << "Round started" << std::endl;
    
    // Let GameState handle timer and round info
    if (gameState) {
        gameState->updateTimerFromEvent(payload);
    }
    else {
        std::cerr << "Error: GameState not available for round start event" << std::endl;
    }
}

void MessageHandler::handleRoundEnd(const json& payload) {
    std::cout << "Round ended" << std::endl;
    
    // Extract round number
    int roundNumber = gameState ? gameState->getCurrentRoundNumber() : 1;
    if (payload.contains("roundNumber")) {
        roundNumber = payload["roundNumber"];
    }
    
    // Check for round results
    bool isWinner = false;
    if (payload.contains("roundWinner")) {
        std::string winnerId = payload["roundWinner"];
        isWinner = (winnerId == roomManager->getDeviceId());
    }
    
    // Use DisplayManager to show results
    if (roomManager->displayManager) {
        roomManager->displayManager->displayRoundEnd(roundNumber, isWinner);
    }
}

void MessageHandler::handleGestureEvent(const json& payload) {
    // Just log gesture events
    if (payload.contains("playerId") && payload.contains("gesture")) {
        std::string playerId = payload["playerId"];
        std::string gesture = payload["gesture"];
        
        // Log gesture event
        std::cout << "Gesture event: " << gesture << " from player " << playerId 
                  << (playerId == roomManager->getDeviceId() ? " (YOU)" : "") << std::endl;
    }
}

void MessageHandler::handleGameStarting(const json& payload) {
    std::cout << "Game is starting soon..." << std::endl;
    
    // Use DisplayManager to show countdown
    if (roomManager->displayManager) {
        roomManager->displayManager->displayGameStarting();
    }
}

void MessageHandler::handleGameStarted(const json& payload) {
    std::cout << "Game has started!" << std::endl;
    
    // Update game state
    if (roomManager) {
        roomManager->gameInProgress = true;
    }
    
    // Use DisplayManager to show game has started
    if (roomManager->displayManager) {
        roomManager->displayManager->displayGameStarted();
    }
}

void MessageHandler::handleGameEnded(const json& payload) {
    // Check if there's a winner
    if (payload.contains("winnerId")) {
        std::string winnerId = payload["winnerId"];
        bool isWinner = (winnerId == roomManager->getDeviceId());
        
        // Use DisplayManager to show game ended
        if (roomManager->displayManager) {
            roomManager->displayManager->displayGameEnded(isWinner);
        }
        
        // Update game state
        if (roomManager) {
            roomManager->gameInProgress = false;
        }
    }
}

void MessageHandler::handleBeagleBoardCommand(const json& payload) {
    if (payload.contains("command")) {
        std::string command = payload["command"];
        std::cout << "Received server command: " << command << std::endl;
        
        // Check if the message is targeted for this specific BeagleBoard
        if (payload.contains("targetPlayerId")) {
            std::string targetPlayerId = payload["targetPlayerId"];
            
            // If this message is not for us, ignore it
            if (targetPlayerId != roomManager->getDeviceId()) {
                std::cout << "Ignoring command targeted for another player: " << targetPlayerId << std::endl;
                return;
            }
            
            std::cout << "Processing targeted command for this device" << std::endl;
        }
        
        // Handle CARDS command - display cards on LCD
        if (command == "CARDS" && payload.contains("cards")) {
            std::cout << "Received cards from server" << std::endl;
            
            // Let GameState handle the cards
            if (gameState) {
                gameState->processCards(payload);
            }
            else {
                std::cerr << "Error: GameState not available for cards command" << std::endl;
            }
        }
        
        // Log additional details if available
        if (payload.contains("details")) {
            std::cout << "Command details: " << payload["details"].dump() << std::endl;
        }
    }
}

void MessageHandler::handleRoomList(const json& payload) {
    if (payload.contains("rooms")) {
        // Extract rooms from the payload
        roomManager->parseJsonRoomList(payload["rooms"]);
        
        // Only display room list if this was in response to a listrooms command
        if (roomManager->currentRequestType == "room_list") {
            roomManager->displayRoomList();
        }
    }
}

void MessageHandler::handleRoomUpdated(const json& payload) {
    // Check if we're in this room
    if (payload.contains("room")) {
        auto& room = payload["room"];
        
        // If this is our current room
        if (room.contains("id") && room["id"] == roomManager->currentRoomId) {
            // Check if we're in the player list
            if (room.contains("players") && room["players"].is_array()) {
                bool foundSelf = false;
                // Also count total players for information purposes
                int playerCount = room["players"].size();
                std::string roomStatus = room.contains("status") ? room["status"].get<std::string>() : "waiting";
                
                for (const auto& player : room["players"]) {
                    if ((player.contains("id") && player["id"] == roomManager->deviceId) ||
                        (player.contains("name") && player["name"] == roomManager->playerName)) {
                        // We're in this room
                        roomManager->connected = true;
                        foundSelf = true;
                        
                        // Only print room update message if something changed
                        bool playerCountChanged = (playerCount != roomManager->lastPlayerCount);
                        bool statusChanged = (roomStatus != roomManager->lastRoomStatus);
                        
                        if (playerCountChanged || statusChanged) {
                            std::cout << "You're now connected to room: \"" << room["name"].get<std::string>() << "\"" << std::endl;
                            std::cout << "Players in room: " << playerCount << "/" 
                                      << (room.contains("maxPlayers") ? room["maxPlayers"].get<int>() : 2) << std::endl;
                            
                            // Update tracking variables
                            roomManager->lastPlayerCount = playerCount;
                            roomManager->lastRoomStatus = roomStatus;
                        }
                        break;
                    }
                }
                
                // If we didn't find ourselves in the player list
                if (!foundSelf && roomManager->connected) {
                    std::cout << "You're no longer in room: \"" << room["name"].get<std::string>() << "\"" << std::endl;
                    roomManager->connected = false;
                    roomManager->currentRoomId = "";
                    roomManager->lastPlayerCount = 0;
                    roomManager->lastRoomStatus = "";
                }
            }
        }
    }
}

void MessageHandler::handleJoinRoom(const json& payload) {
    // Handle join_room response
    if (payload.contains("roomId")) {
        std::string roomId = payload["roomId"];
        if (roomId == roomManager->currentRoomId) {
            roomManager->connected = true;
            std::cout << "Successfully joined room: " << roomId << std::endl;
            // Request room list to see updated player count
            roomManager->fetchAvailableRooms();
        }
    }
}

void MessageHandler::handleLeaveRoom(const json& payload) {
    // Handle leave_room response - clear currentRoomId when confirmed by server
    if (roomManager->currentRequestType == "leave_room") {
        roomManager->currentRoomId = "";
        std::cout << "Server confirmed room exit" << std::endl;
    }
}

void MessageHandler::handlePlayerReady(const json& payload) {
    // Handle player_ready events
    if (payload.contains("isReady")) {
        bool isReady = payload["isReady"];
        // Check if this is about us or another player
        if (payload.contains("playerId") && payload["playerId"] == roomManager->deviceId) {
            roomManager->ready = isReady;
            std::cout << "Your ready status is now: " << (isReady ? "Ready" : "Not ready") << std::endl;
        } else {
            std::cout << "Another player's ready status changed" << std::endl;
        }
    }
}

// The implementations for the specific event handlers will go here when we finish the full refactoring 