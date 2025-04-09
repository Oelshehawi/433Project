#include "RoomManager.h"
#include "DisplayManager.h"
#include "GameState.h"
#include "MessageHandler.h"
#include "GestureEventSender.h"
#include <iostream>
#include <random>
#include <sstream>
#include <algorithm>
#include <ctime>     // For std::time
#include <nlohmann/json.hpp>
#include <thread>

// Forward declarations for LCD functions (from lcd_display.h)
extern "C" {
    typedef enum {
        lcd_center,
        lcd_top_left,
        lcd_top_right,
        lcd_bottom_left,
        lcd_bottom_right
    } lcd_location;
    
    void lcd_place_message(char** messages, int length, lcd_location location);
}

// For convenience
using json = nlohmann::json;

// Forward declaration
class RoomManager;

// Generate a random device ID
std::string RoomManager::generateDeviceId() {
    static const char alphanum[] =
        "0123456789"
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        "abcdefghijklmnopqrstuvwxyz";
    
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> dis(0, sizeof(alphanum) - 2);
    
    std::string id = "bb_";
    for (int i = 0; i < 8; ++i) {
        id += alphanum[dis(gen)];
    }
    
    return id;
}

RoomManager::RoomManager(WebSocketClient* client)
    : client(client), receiver(nullptr), 
      messageHandler(nullptr), gameState(nullptr), displayManager(nullptr), gestureDetector(nullptr),
      gestureEventSender(nullptr),
      connected(false), ready(false), 
      isWaitingForResponse(false), currentRequestType(""), lastRoomStatus(""), lastPlayerCount(0), gameInProgress(false) {
    
    // Properly seed global random number generator for any legacy code that might use it
    std::srand(static_cast<unsigned int>(std::time(nullptr)));
    
    // Generate a unique device ID
    deviceId = generateDeviceId();
    
    // Create the display manager first with nullptr for gameState
    displayManager = new DisplayManager(nullptr);
    
    // Create the game state manager with displayManager
    gameState = new GameState(this, displayManager, deviceId);
    
    // Update the display manager's game state reference
    displayManager->setGameState(gameState);
    
    // Create the message handler
    messageHandler = new MessageHandler(this, gameState, client);
}

RoomManager::~RoomManager() {
    // Ensure we're disconnected
    if (connected) {
        leaveRoom();
    }
    
    // Cleanup receiver
    if (receiver) {
        receiver->stop();
        delete receiver;
        receiver = nullptr;
    }
    
    // Cleanup message handler
    if (messageHandler) {
        delete messageHandler;
        messageHandler = nullptr;
    }
    
    // Cleanup game state
    if (gameState) {
        delete gameState;
        gameState = nullptr;
    }
    
    // Cleanup display manager
    if (displayManager) {
        delete displayManager;
        displayManager = nullptr;
    }
    
    // Cleanup gesture event sender
    if (gestureEventSender) {
        delete gestureEventSender;
        gestureEventSender = nullptr;
    }
}

bool RoomManager::startReceiver() {
    if (!client) {
        return false;
    }
    
    receiver = new WebSocketReceiver(client);
    receiver->setMessageCallback([this](const std::string& message) {
        if (messageHandler) {
            messageHandler->handleMessage(message);
        } else {
            this->handleMessage(message);
        }
    });
    
    return receiver->start();
}

void RoomManager::handleMessage(const std::string& message) {
    try {
        // Parse message as JSON
        json j = json::parse(message);
        
        if (j.contains("event") && j["event"] == "room_list") {
            if (j.contains("payload") && j["payload"].contains("rooms")) {
                // Extract rooms from the payload
                parseJsonRoomList(j["payload"]["rooms"]);
                
                // Only display room list if this was in response to a listrooms command
                if (currentRequestType == "room_list") {
                    displayRoomList();
                }
                
                // Reset loading state after handling the response
                resetLoadingState();
            }
        }
        else if (j.contains("event") && j["event"] == "room_updated") {
            // Check if we're in this room
            if (j.contains("payload") && j["payload"].contains("room")) {
                auto& room = j["payload"]["room"];
                
                // If this is our current room
                if (room.contains("id") && room["id"] == currentRoomId) {
                    // Check if we're in the player list
                    if (room.contains("players") && room["players"].is_array()) {
                        bool foundSelf = false;
                        // Also count total players for information purposes
                        int playerCount = room["players"].size();
                        std::string roomStatus = room.contains("status") ? room["status"].get<std::string>() : "waiting";
                        
                        for (const auto& player : room["players"]) {
                            if ((player.contains("id") && player["id"] == deviceId) ||
                                (player.contains("name") && player["name"] == playerName)) {
                                // We're in this room
                                connected = true;
                                foundSelf = true;
                                
                                // Only print room update message if something changed
                                bool playerCountChanged = (playerCount != lastPlayerCount);
                                bool statusChanged = (roomStatus != lastRoomStatus);
                                
                                if (playerCountChanged || statusChanged) {
                                    lastPlayerCount = playerCount;
                                    lastRoomStatus = roomStatus;
                                }
                                break;
                            }
                        }
                        
                        // If we didn't find ourselves in the player list
                        if (!foundSelf && connected) {
                            currentRoomId = "";
                            lastPlayerCount = 0;
                            lastRoomStatus = "";
                        }
                    }
                }
                
                // If this was in response to a create_room request, reset the loading state
                if (currentRequestType == "create_room") {
                    resetLoadingState();
                }
                else {
                    // Always reset loading state for room_updated events
                    resetLoadingState();
                }
            }
            else {
                // Even if payload or room is missing, reset loading state
                resetLoadingState();
            }
        }
        else if (j.contains("event") && j["event"] == "join_room") {
            // Handle join_room response
            if (j.contains("payload") && j["payload"].contains("roomId")) {
                std::string roomId = j["payload"]["roomId"];
                if (roomId == currentRoomId) {
                    connected = true;
                    fetchAvailableRooms();
                }
            }
            resetLoadingState();
        }
        else if (j.contains("event") && j["event"] == "leave_room") {
            // Handle leave_room response - clear currentRoomId when confirmed by server
            if (currentRequestType == "leave_room") {
                currentRoomId = "";
            }
            resetLoadingState();
        }
        else if (j.contains("event") && j["event"] == "player_ready") {
            // Handle player_ready events
            if (j.contains("payload") && j["payload"].contains("isReady")) {
                bool isReady = j["payload"]["isReady"];
                // Check if this is about us or another player
                if (j["payload"].contains("playerId") && j["payload"]["playerId"] == deviceId) {
                    ready = isReady;
                }
            }
            resetLoadingState();
        }
        else if (j.contains("event") && j["event"] == "round_start") {
            // Handle round start events
            if (j.contains("payload")) {
                // Check if this is the new format with cards included
                if (j["payload"].contains("playerCards")) {
                }
                
                // Extract round number - this is the important part
                int roundNumber = 1;
                
                if (j["payload"].contains("roundNumber")) {
                    roundNumber = j["payload"]["roundNumber"];
                }
                
                // Update currentRoundNumber directly
                currentRoundNumber = roundNumber;
                
                // Let GameState handle timer and cards (client-side only now)
                if (gameState) {
                    gameState->updateTimerFromEvent(j["payload"]);
                }
            }
            resetLoadingState();
        }
        else if (j.contains("event") && j["event"] == "round_end") {
            // Handle round end events
            if (j.contains("payload")) {
                int roundNumber = currentRoundNumber;
                if (j["payload"].contains("roundNumber")) {
                    roundNumber = j["payload"]["roundNumber"];
                }
                
                // Check for round results
                bool isWinner = false;
                if (j["payload"].contains("roundWinner")) {
                    std::string winnerId = j["payload"]["roundWinner"];
                    isWinner = (winnerId == deviceId);
                }
                
                // Use DisplayManager to update the LCD with round result
                if (displayManager) {
                    displayManager->displayRoundEndConfirmation(roundNumber);
                }
                
                // Stop any active timer since the round has ended
                if (gameState) {
                    gameState->stopTimer();
                }
            }
            resetLoadingState();
        }
        else if (j.contains("event") && j["event"] == "game_starting") {
            // Handle game starting event (countdown)
            if (j.contains("payload")) {
                // Use DisplayManager to show countdown
                if (displayManager) {
                    displayManager->displayGameStarting();
                }
            }
            resetLoadingState();
        }
        else if (j.contains("event") && j["event"] == "game_started") {
            // Handle game started event - just update game status
            gameInProgress = true;
            
            // Use DisplayManager to show game has started
            if (displayManager) {
                displayManager->displayGameStarted();
            }
        }
        else if (j.contains("event") && j["event"] == "game_ended") {
            // Handle game ended event
            if (j.contains("payload") && j["payload"].contains("winnerId")) {
                std::string winnerId = j["payload"]["winnerId"];
                bool isWinner = (winnerId == deviceId);
                
                // Use DisplayManager to show game ended
                if (displayManager) {
                    displayManager->displayGameEnded(isWinner);
                }
                
                // Mark game as no longer in progress
                gameInProgress = false;
            }
            resetLoadingState();
        }
        else if (j.contains("event") && j["event"] == "game_state_update") {
            // Handle game state updates
            if (j.contains("payload") && j["payload"].contains("gameState")) {
                auto& gameState = j["payload"]["gameState"];
                
                // Extract round number if available
                int roundNumber = 0;
                if (gameState.contains("roundNumber")) {
                    roundNumber = gameState["roundNumber"];
                    currentRoundNumber = roundNumber;
                }
                
                // If we have cards, update the display with current game info
                if (lastReceivedCards.size() > 0) {
                    displayManager->updateCardAndGameDisplay();
                }
            }
            resetLoadingState();
        }
        else if (j.contains("event") && j["event"] == "beagle_board_command") {
            // Handle beagle board specific commands
            if (j.contains("payload") && j["payload"].contains("command")) {
                std::string command = j["payload"]["command"];
                
                // Check if the message is targeted for this specific BeagleBoard
                bool isTargetedMessage = false;
                if (j["payload"].contains("targetPlayerId")) {
                    std::string targetPlayerId = j["payload"]["targetPlayerId"];
                    isTargetedMessage = true;
                    
                    // If this message is not for us, ignore it
                    if (targetPlayerId != deviceId) {
                        return;
                    }
                }
                
                // Handle CARDS command - display cards on LCD
                if (command == "CARDS" && j["payload"].contains("cards")) {
                    // Let GameState handle the cards
                    if (gameState) {
                        gameState->processCards(j["payload"]);
                    }
                }
            }
            
            resetLoadingState();
        }
        else if (j.contains("event") && j["event"] == "gesture_event") {
            // Handle gesture events - just log them
            if (j.contains("payload")) {
                auto& payload = j["payload"];
                if (payload.contains("playerId") && payload.contains("gesture")) {
                }
            }
            
            resetLoadingState();
        }
        else {
            // If the event doesn't match any of the above, still reset the loading state
            // in case it was a response to a command
            resetLoadingState();
        }
    } catch (const json::parse_error& e) {
        // Try legacy format parsing for backwards compatibility
        if (message.find("ROOMLIST|") == 0) {
            parseRoomList(message.substr(9)); // Skip "ROOMLIST|"
            
            // Reset loading state
            resetLoadingState();
        }
        else if (message.find("JOINED|") == 0) {
            connected = true;
            resetLoadingState();
        }
        else if (message.find("LEFT|") == 0) {
            connected = false;
            currentRoomId = "";
            resetLoadingState();
        }
        else if (message.find("RESPONSE:JOIN_ROOM") == 0) {
            if (message.find("status:SUCCESS") != std::string::npos) {
                connected = true;
            }
            resetLoadingState();
        }
        else if (message.find("RESPONSE:LEAVE_ROOM") == 0) {
            if (message.find("status:SUCCESS") != std::string::npos) {
                connected = false;
                currentRoomId = "";
            }
            resetLoadingState();
        }
        else {
            // Unknown message format, still reset loading state
            resetLoadingState();
        }
    }
}

void RoomManager::parseRoomList(const std::string& response) {
    std::lock_guard<std::mutex> lock(roomsMutex);
    availableRooms.clear();
    
    std::istringstream ss(response);
    std::string roomInfo;
    
    while (std::getline(ss, roomInfo, '|')) {
        if (roomInfo.empty()) continue;
        
        // Parse room information (format: "ID:xxx|Name:xxx|Players:x/y|Status:xxx")
        Room room;
        size_t idPos = roomInfo.find("ID:");
        size_t namePos = roomInfo.find("Name:");
        size_t playersPos = roomInfo.find("Players:");
        size_t statusPos = roomInfo.find("Status:");
        
        if (idPos != std::string::npos) {
            size_t endPos = roomInfo.find("|", idPos);
            room.id = roomInfo.substr(idPos + 3, endPos - idPos - 3);
        }
        
        if (namePos != std::string::npos) {
            size_t endPos = roomInfo.find("|", namePos);
            room.name = roomInfo.substr(namePos + 5, endPos - namePos - 5);
        }
        
        if (playersPos != std::string::npos) {
            size_t endPos = roomInfo.find("|", playersPos);
            std::string playersStr = roomInfo.substr(playersPos + 8, endPos - playersPos - 8);
            
            // Parse "x/y" format
            size_t slashPos = playersStr.find("/");
            if (slashPos != std::string::npos) {
                room.playerCount = std::stoi(playersStr.substr(0, slashPos));
                room.maxPlayers = std::stoi(playersStr.substr(slashPos + 1));
            }
        }
        
        if (statusPos != std::string::npos) {
            size_t endPos = roomInfo.find("|", statusPos);
            room.status = roomInfo.substr(statusPos + 7, endPos - statusPos - 7);
        }
        
        availableRooms.push_back(room);
    }
}

void RoomManager::parseJsonRoomList(const json& roomsJson) {
    std::lock_guard<std::mutex> lock(roomsMutex);
    availableRooms.clear();
    
    // Process each room in the JSON array
    for (const auto& roomJson : roomsJson) {
        Room room;
        
        if (roomJson.contains("id")) room.id = roomJson["id"];
        if (roomJson.contains("name")) room.name = roomJson["name"];
        if (roomJson.contains("playerCount")) room.playerCount = roomJson["playerCount"];
        if (roomJson.contains("maxPlayers")) room.maxPlayers = roomJson["maxPlayers"];
        if (roomJson.contains("status")) room.status = roomJson["status"];
        
        availableRooms.push_back(room);
    }
}

void RoomManager::displayRoomList() {
    std::lock_guard<std::mutex> lock(roomsMutex);
    
    if (availableRooms.empty()) {
        std::cout << "[RoomManager] No rooms available." << std::endl;
        return;
    }
    
    std::cout << "[RoomManager] Available rooms: " << std::endl;
    for (const auto& room : availableRooms) {
        std::cout << "[RoomManager] Room ID: " << room.id << ", Name: " << room.name 
                  << ", Players: " << room.playerCount << "/" << room.maxPlayers 
                  << ", Status: " << room.status << std::endl;
    }
}

bool RoomManager::fetchAvailableRooms() {
    // Create JSON message directly
    json message = json::object();
    message["event"] = "room_list";
    message["payload"] = json::object();
    
    std::string jsonMessage = message.dump();
    
    // Set tracking state
    isWaitingForResponse = true;
    currentRequestType = "room_list";
    
    // Direct send for maximum performance
    bool result = client->sendMessage(jsonMessage);
    
    // Ensure immediate processing
    client->ensureMessageProcessing();
    
    return result;
}

bool RoomManager::createRoom(const std::string& roomName) {
    if (!client || !client->isConnected()) {
        return false;
    }
    
    if (roomName.empty()) {
        return false;
    }
    
    if (playerName.empty()) {
        return false;
    }
    
    // Generate a random room ID using modern C++ random number generation
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> dis(1000, 9999); // Range 1000-9999 for 4 digit numbers
    std::string roomId = "room_" + std::to_string(dis(gen));
    
    // Create payload for room creation
    json room = json::object();
    room["id"] = roomId;
    room["name"] = roomName;
    room["maxPlayers"] = 2;
    room["status"] = "waiting";
    room["hostId"] = deviceId;
    
    // Create players array with the creator
    json players = json::array();
    json player = json::object();
    player["id"] = deviceId;
    player["name"] = playerName;
    player["playerType"] = "beagleboard";
    player["isReady"] = false;
    player["connected"] = true;
    players.push_back(player);
    
    room["players"] = players;
    
    // Set current room ID for tracking
    currentRoomId = roomId;
    
    // Create payload
    json payload = json::object();
    payload["room"] = room;
    
    // Create final message
    json message = json::object();
    message["event"] = "create_room";
    message["payload"] = payload;
    
    std::string jsonMessage = message.dump();
    
    // Set request tracking 
    isWaitingForResponse = true;
    currentRequestType = "create_room";
    
    // Direct send for maximum performance
    bool result = client->sendMessage(jsonMessage);
    client->ensureMessageProcessing();
    
    return result;
}

void RoomManager::resetLoadingState() {
    isWaitingForResponse = false;
    currentRequestType = "";
}

// Getters implementation
const std::vector<Room> RoomManager::getAvailableRooms() const {
    std::lock_guard<std::mutex> lock(const_cast<std::mutex&>(roomsMutex));
    return availableRooms;
}

bool RoomManager::joinRoom(const std::string& roomId) {
    if (!client || !client->isConnected()) {
        return false;
    }
    
    if (roomId.empty()) {
        return false;
    }
    
    if (playerName.empty()) {
        return false;
    }
    
    // Set current room ID for tracking purposes
    currentRoomId = roomId;
    
    // Create JSON message with fixed payload format
    json payload = json::object();
    payload["roomId"] = roomId;
    payload["playerId"] = deviceId;
    payload["playerName"] = playerName;
    
    json message = json::object();
    message["event"] = "join_room";
    message["payload"] = payload;
    
    std::string jsonMessage = message.dump();
    
    // Send message directly with immediate processing
    bool result = client->sendMessage(jsonMessage);
    client->ensureMessageProcessing();
    
    return result;
}

bool RoomManager::leaveRoom() {
    if (!client || !connected) {
        // If not connected to a room, there's nothing to leave
        return false;
    }
    
    // Create JSON message
    json payload = json::object();
    payload["roomId"] = currentRoomId;
    payload["playerId"] = deviceId;
    
    json message = json::object();
    message["event"] = "leave_room";
    message["payload"] = payload;
    
    connected = false; // Optimistically mark as disconnected
    
    // Send message directly with immediate processing
    bool result = client->sendMessage(message.dump());
    client->ensureMessageProcessing();
    
    return result;
}

void RoomManager::setReady(bool isReady) {
    if (!client || !connected) {
        return;
    }
    
    // Create JSON message
    json payload = json::object();
    payload["roomId"] = currentRoomId;
    payload["playerId"] = deviceId;
    payload["isReady"] = isReady;
    
    json message = json::object();
    message["event"] = "player_ready";
    message["payload"] = payload;
    
    // Set ready status for tracking purposes - will be confirmed by server response
    ready = isReady;
    
    // Send the message - no tracking needed as we'll receive room_updated
    client->sendMessage(message.dump());
    client->ensureMessageProcessing();
}

bool RoomManager::sendGestureEvent(const std::string& roomId, const std::string& playerId, 
                                  const std::string& gesture, float confidence, const std::string& cardId) {
    try {
        // Validate inputs
        if (roomId.empty() || playerId.empty() || gesture.empty()) {
            std::cerr << "[RoomManager.cpp] Invalid parameters for gesture event" << std::endl;
            return false;
        }
        
        // Check if client is valid with retry logic
        if (!client) {
            std::cerr << "[RoomManager.cpp] WebSocket client is null, cannot send gesture" << std::endl;
            return false;
        }
        
        // Check connection status with more defensive approach
        if (!client->isConnected()) {
            std::cerr << "[RoomManager.cpp] WebSocket client is not connected, cannot send gesture" << std::endl;
            // Don't attempt to fix connection here - would add too much complexity
            return false;
        }
        
        // Ensure we have a valid gesture event sender with retry logic
        int maxRetries = 2;
        for (int attempt = 0; attempt <= maxRetries; attempt++) {
            if (!gestureEventSender) {
                if (attempt < maxRetries) {
                    std::cout << "[RoomManager.cpp] Creating new GestureEventSender (attempt " << (attempt+1) << ")" << std::endl;
                    // Create the gesture event sender if it doesn't exist
                    try {
                        gestureEventSender = new GestureEventSender(client);
                    } catch (const std::exception& e) {
                        std::cerr << "[RoomManager.cpp] Failed to create GestureEventSender: " << e.what() << std::endl;
                        // Sleep briefly before retry
                        std::this_thread::sleep_for(std::chrono::milliseconds(100));
                        continue; // Try again
                    }
                    
                    if (!gestureEventSender) {
                        std::cerr << "[RoomManager.cpp] Failed to allocate GestureEventSender" << std::endl;
                        // Sleep briefly before retry
                        std::this_thread::sleep_for(std::chrono::milliseconds(100));
                        continue; // Try again
                    }
                } else {
                    std::cerr << "[RoomManager.cpp] Failed to create GestureEventSender after " << maxRetries << " attempts" << std::endl;
                    return false;
                }
            }
            
            // If we got here, we have a valid gestureEventSender
            break;
        }
        
        // Final safety check - if we still don't have a valid sender, return false
        if (!gestureEventSender) {
            std::cerr << "[RoomManager.cpp] GestureEventSender is still null after retry attempts" << std::endl;
            return false;
        }
        
        std::cout << "[RoomManager.cpp] Sending gesture event: " << gesture << " with card ID: " << cardId << std::endl;
        
        // Forward the gesture event to the gesture event sender with retry logic
        bool result = false;
        int sendRetries = 1;
        
        for (int attempt = 0; attempt <= sendRetries; attempt++) {
            try {
                result = gestureEventSender->sendGestureEvent(roomId, playerId, gesture, confidence, cardId);
                
                if (result) {
                    // Success, break out of retry loop
                    break;
                } else if (attempt < sendRetries) {
                    // Failed but can retry
                    std::cerr << "[RoomManager.cpp] Send failed, retrying..." << std::endl;
                    std::this_thread::sleep_for(std::chrono::milliseconds(100));
                }
            } catch (const std::exception& e) {
                std::cerr << "[RoomManager.cpp] Exception in sendGestureEvent: " << e.what() << std::endl;
                
                if (attempt < sendRetries) {
                    // Try to recover sender
                    try {
                        if (gestureEventSender) {
                            delete gestureEventSender;
                        }
                        gestureEventSender = new GestureEventSender(client);
                        std::this_thread::sleep_for(std::chrono::milliseconds(100));
                    } catch (...) {
                        std::cerr << "[RoomManager.cpp] Failed to recover gestureEventSender" << std::endl;
                    }
                } else {
                    return false;
                }
            }
        }
        
        // Ensure message processing with extra safety
        if (client && client->isConnected()) {
            try {
                client->ensureMessageProcessing();
            } catch (const std::exception& e) {
                std::cerr << "[RoomManager.cpp] Exception in ensureMessageProcessing: " << e.what() << std::endl;
                // Still return true if the send succeeded
            }
        }
        
        return result;
    } catch (const std::exception& e) {
        std::cerr << "[RoomManager.cpp] Unexpected exception in sendGestureEvent: " << e.what() << std::endl;
        return false;
    } catch (...) {
        std::cerr << "[RoomManager.cpp] Unknown exception in sendGestureEvent" << std::endl;
        return false;
    }
} 