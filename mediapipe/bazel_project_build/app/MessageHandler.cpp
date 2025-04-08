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
        std::cout << "[MessageHandler.cpp] Received message to handle" << std::endl;
        
        // Parse message as JSON
        json j = json::parse(message);
        
        // Route to appropriate handler based on event type
        if (j.contains("event")) {
            std::string eventType = j["event"];
            std::cout << "[MessageHandler.cpp] Handling event type: " << eventType << std::endl;
            
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
                std::cout << "[MessageHandler.cpp] Got a round_start event!" << std::endl;
                if (j.contains("payload")) {
                    handleRoundStart(j["payload"]);
                } else {
                    std::cout << "[MessageHandler.cpp] WARNING: round_start event has no payload!" << std::endl;
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
    std::cout << "\n[MessageHandler.cpp] =========== ROUND START EVENT BEING PROCESSED ===========\n" << std::endl;
    std::cout << "[MessageHandler.cpp] Full payload: " << payload.dump(2) << std::endl;
    
    // Check if cards are included in the round_start event (new format)
    if (payload.contains("playerCards") && payload["playerCards"].is_object()) {
        std::cout << "[MessageHandler.cpp] Round start event includes cards data (new format)" << std::endl;
        
        // Get our device ID
        std::string ourDeviceId = roomManager ? roomManager->getDeviceId() : "unknown";
        std::cout << "[MessageHandler.cpp] Our device ID: " << ourDeviceId << std::endl;
        
        // Check if our device ID is in the playerCards object
        if (payload["playerCards"].contains(ourDeviceId)) {
            std::cout << "[MessageHandler.cpp] Found our cards in the payload!" << std::endl;
            std::cout << "[MessageHandler.cpp] Card count: " << payload["playerCards"][ourDeviceId].size() << std::endl;
            
            // Print first card details if available
            if (payload["playerCards"][ourDeviceId].size() > 0) {
                auto& firstCard = payload["playerCards"][ourDeviceId][0];
                std::cout << "[MessageHandler.cpp] First card type: " << firstCard.value("type", "unknown") << std::endl;
            }
        } else {
            std::cout << "[MessageHandler.cpp] WARNING: Our device ID not found in playerCards!" << std::endl;
            std::cout << "[MessageHandler.cpp] Available player IDs: ";
            for (auto& [playerId, cards] : payload["playerCards"].items()) {
                std::cout << playerId << " ";
            }
            std::cout << std::endl;
        }
    } else {
        std::cout << "[MessageHandler.cpp] Round start event does NOT include cards data!" << std::endl;
    }
    
    // Let GameState handle timer and round info (including cards processing if present)
    if (gameState) {
        std::cout << "[MessageHandler.cpp] Calling gameState->updateTimerFromEvent()" << std::endl;
        gameState->updateTimerFromEvent(payload);
        std::cout << "[MessageHandler.cpp] Returned from gameState->updateTimerFromEvent()" << std::endl;
    }
    else {
        std::cerr << "[MessageHandler.cpp] ERROR: GameState not available for round start event" << std::endl;
    }
    
    std::cout << "\n[MessageHandler.cpp] =========== ROUND START PROCESSING COMPLETE ===========\n" << std::endl;
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
        std::cout << "[MessageHandler.cpp] BEAGLEBOARD COMMAND RECEIVED: " << command << std::endl;
        
        // Check if the message is targeted for this specific BeagleBoard
        if (payload.contains("targetPlayerId")) {
            std::string targetPlayerId = payload["targetPlayerId"];
            
            // If this message is not for us, ignore it
            if (targetPlayerId != roomManager->getDeviceId()) {
                std::cout << "[MessageHandler.cpp] Ignoring command targeted for another player: " << targetPlayerId << std::endl;
                return;
            }
            
            std::cout << "[MessageHandler.cpp] Processing targeted command for this device" << std::endl;
        }
        
        // Handle CARDS command - display cards on LCD
        if (command == "CARDS" && payload.contains("cards")) {
            // Print a clear dividing line to make logs easier to read
            std::cout << "\n===========================================" << std::endl;
            std::cout << "BEAGLEBOARD COMMAND RECEIVED: CARDS UPDATE" << std::endl;
            if (payload.contains("targetPlayerId")) {
                std::cout << "Target Player ID: \"" << payload["targetPlayerId"].get<std::string>() << "\"" << std::endl;
            }
            if (payload.contains("cards") && payload["cards"].is_array()) {
                std::cout << "Number of cards: " << payload["cards"].size() << std::endl;
            }
            std::cout << "===========================================\n" << std::endl;
            
            // Let GameState handle the cards
            if (gameState) {
                gameState->processCards(payload);
            }
            else {
                std::cerr << "[MessageHandler.cpp] Error: GameState not available for cards command" << std::endl;
            }
        }
        
        // Log additional details if available
        if (payload.contains("details")) {
            std::cout << "[MessageHandler.cpp] Command details: " << payload["details"].dump() << std::endl;
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