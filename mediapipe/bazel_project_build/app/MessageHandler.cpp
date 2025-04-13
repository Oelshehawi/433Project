#include "MessageHandler.h"
#include "RoomManager.h"
#include "GameState.h"
#include "DisplayManager.h"
#include "GestureDetector.h"
#include <iostream>
#include <nlohmann/json.hpp>
#include <sstream>

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
            else if (eventType == "move_status") {
                if (j.contains("payload")) {
                    handleMoveStatus(j["payload"]);
                }
            }
            else {
                // For unimplemented handlers, just forward to the RoomManager's handler
                roomManager->handleMessage(message);
                return;
            }
        }
        
        // Reset loading state after processing the message
        roomManager->resetLoadingState();
        
    } catch (const json::parse_error& e) {
        // Simply log error and reset loading state
        roomManager->resetLoadingState();
    }
}

void MessageHandler::handleRoundStart(const json& payload) {
    // Let GameState handle timer and round info (including cards processing if present)
    if (gameState) {
        gameState->updateTimerFromEvent(payload);
    }
}

void MessageHandler::handleRoundEnd(const json& payload) {
    // Extract round number
    int roundNumber = gameState ? gameState->getCurrentRoundNumber() : 1;
    if (payload.contains("roundNumber")) {
        roundNumber = payload["roundNumber"];
    }
    
    std::cout << "[MessageHandler.cpp] *** ROUND_END EVENT RECEIVED from server for round " << roundNumber << " ***" << std::endl;
    
    // Stop gesture detection if it's running
    if (roomManager && roomManager->gestureDetector && roomManager->gestureDetector->isRunning()) {
        std::cout << "[MessageHandler.cpp] Round ended - stopping gesture detection (was running)" << std::endl;
        roomManager->gestureDetector->stop();
        std::cout << "[MessageHandler.cpp] Gesture detection stopped, new state: " 
                  << (roomManager->gestureDetector->isRunning() ? "still running (error)" : "stopped successfully") << std::endl;
    } else {
        std::cout << "[MessageHandler.cpp] Round ended - gesture detection was not running" << std::endl;
    }
    
    // Stop the timer
    if (gameState) {
        gameState->stopTimer();
        gameState->setRoundEndReceived(true);
    }
    
    // Use DisplayManager to show results
    if (roomManager->displayManager) {
        roomManager->displayManager->displayRoundEndConfirmation(roundNumber);
    }
    
    // Immediately send round_end_ack after handling round_end event
    if (gameState) {
        std::cout << "[MessageHandler.cpp] Calling sendRoundEndEvent to acknowledge round end" << std::endl;
        gameState->sendRoundEndEvent();
    }
}

void MessageHandler::handleGestureEvent(const json& payload) {
    // Just log gesture events
    if (payload.contains("playerId") && payload.contains("gesture")) {
        std::string playerId = payload["playerId"];
        std::string gesture = payload["gesture"];
    }
}

void MessageHandler::handleGameStarting(const json& payload) {
    // Use DisplayManager to show countdown
    if (roomManager->displayManager) {
        roomManager->displayManager->displayGameStarting();
    }
}

void MessageHandler::handleGameStarted(const json& payload) {
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
        
        // Check if the message is targeted for this specific BeagleBoard
        if (payload.contains("targetPlayerId")) {
            std::string targetPlayerId = payload["targetPlayerId"];
            
            // If this message is not for us, ignore it
            if (targetPlayerId != roomManager->getDeviceId()) {
                return;
            }
        }
        
        // Handle CARDS command - display cards on LCD
        if (command == "CARDS" && payload.contains("cards")) {
            // Let GameState handle the cards
            if (gameState) {
                gameState->processCards(payload);
            }
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
                            roomManager->lastPlayerCount = playerCount;
                            roomManager->lastRoomStatus = roomStatus;
                        }
                        break;
                    }
                }
                
                // If we didn't find ourselves in the player list
                if (!foundSelf && roomManager->connected) {
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
            // Request room list to see updated player count
            roomManager->fetchAvailableRooms();
        }
    }
}

void MessageHandler::handleLeaveRoom(const json& payload) {
    // Handle leave_room response - clear currentRoomId when confirmed by server
    if (roomManager->currentRequestType == "leave_room") {
        roomManager->currentRoomId = "";
    }
}

void MessageHandler::handlePlayerReady(const json& payload) {
    // Handle player_ready events
    if (payload.contains("isReady")) {
        bool isReady = payload["isReady"];
        // Check if this is about us or another player
        if (payload.contains("playerId") && payload["playerId"] == roomManager->deviceId) {
            roomManager->ready = isReady;
        }
    }
}

// Handle move status response from server
void MessageHandler::handleMoveStatus(const json& payload) {
    // Extract status and reason
    std::string status = payload.contains("status") ? payload["status"].get<std::string>() : "unknown";
    std::string reason = payload.contains("reason") ? payload["reason"].get<std::string>() : "unknown";
    int roundNumber = payload.contains("roundNumber") ? payload["roundNumber"].get<int>() : 0;
    
    if (status == "accepted") {
        std::cout << "[MessageHandler.cpp] Move was accepted by server for round " << roundNumber << std::endl;
        
        // If the gesture detector is still running, stop it
        if (roomManager && roomManager->gestureDetector && roomManager->gestureDetector->isRunning()) {
            std::cout << "[MessageHandler.cpp] Move accepted - stopping gesture detection (was running)" << std::endl;
            roomManager->gestureDetector->stop();
            std::cout << "[MessageHandler.cpp] Gesture detection stopped, new state: " 
                      << (roomManager->gestureDetector->isRunning() ? "still running (error)" : "stopped successfully") << std::endl;
        } else {
            std::cout << "[MessageHandler.cpp] Move accepted - gesture detection was not running" << std::endl;
        }
        
        // Stop the timer
        if (gameState) {
            gameState->stopTimer();
        }
        
        // Update the display with accepted status
        if (roomManager && roomManager->displayManager) {
            roomManager->displayManager->displayRoundEndConfirmation(roundNumber, "accepted");
        }
        
        // Check if we already received a round_end event
        if (gameState && gameState->wasRoundEndReceived()) {
            std::cout << "[MessageHandler.cpp] Round end was already received, sending round_end_ack" << std::endl;
            gameState->sendRoundEndEvent();
        } else {
            std::cout << "[MessageHandler.cpp] Move accepted but waiting for round_end event before sending ack. "
                      << "This is normal - server will send round_end next." << std::endl;
        }
    } 
    else if (status == "rejected") {
        std::cout << "[MessageHandler.cpp] Move was rejected by server: " << reason << std::endl;
        
        // Update the display with rejected status
        if (roomManager && roomManager->displayManager) {
            roomManager->displayManager->displayRoundEndConfirmation(roundNumber, "rejected");
        }
        
        if (reason == "already_moved") {
            std::cout << "[MessageHandler.cpp] Already moved this round" << std::endl;
        }
        else if (reason == "invalid_round") {
            std::cout << "[MessageHandler.cpp] Invalid round number" << std::endl;
        }
    }
}

void MessageHandler::handleMoveAccepted(const json& payload) {
    std::cout << "[MessageHandler.cpp] Move was accepted by server for round " << payload["roundNumber"] << std::endl;
    
    // Only update display to show accepted move, but don't send another gesture
    if (roomManager->displayManager) {
        // Use the displayRoundEndConfirmation method which we know exists
        int roundNumber = payload.contains("roundNumber") ? payload["roundNumber"].get<int>() : 1;
        roomManager->displayManager->displayRoundEndConfirmation(roundNumber, "accepted");
    }
    
    std::cout << "[MessageHandler.cpp] Move accepted but waiting for round_end event before sending ack" << std::endl;
    
}
