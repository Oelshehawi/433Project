#include "RoomManager.h"
#include "DisplayManager.h"
#include "GameState.h"
#include "MessageHandler.h"
#include <iostream>
#include <random>
#include <sstream>
#include <algorithm>
#include <ctime>     // For std::time
#include <nlohmann/json.hpp>

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
      messageHandler(nullptr), gameState(nullptr), displayManager(nullptr),
      connected(false), ready(false), 
      isWaitingForResponse(false), currentRequestType(""), lastRoomStatus(""), lastPlayerCount(0) {
    
    // Properly seed global random number generator for any legacy code that might use it
    std::srand(static_cast<unsigned int>(std::time(nullptr)));
    
    // Generate a unique device ID
    deviceId = generateDeviceId();
    std::cout << "[RoomManager.cpp] Room Manager initialized with device ID: " << deviceId << std::endl;
    
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
}

bool RoomManager::startReceiver() {
    if (!client) {
        std::cerr << "No WebSocket client available" << std::endl;
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
                                    std::cout << "You're now connected to room: \"" << room["name"].get<std::string>() << "\"" << std::endl;
                                    std::cout << "Players in room: " << playerCount << "/" 
                                              << (room.contains("maxPlayers") ? room["maxPlayers"].get<int>() : 2) << std::endl;
                                    
                                    // Update tracking variables
                                    lastPlayerCount = playerCount;
                                    lastRoomStatus = roomStatus;
                                }
                                break;
                            }
                        }
                        
                        // If we didn't find ourselves in the player list
                        if (!foundSelf && connected) {
                            std::cout << "You're no longer in room: \"" << room["name"].get<std::string>() << "\"" << std::endl;
                            connected = false;
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
                    std::cout << "Successfully joined room: " << roomId << std::endl;
                    // Request room list to see updated player count
                    fetchAvailableRooms();
                }
            }
            resetLoadingState();
        }
        else if (j.contains("event") && j["event"] == "leave_room") {
            // Handle leave_room response - clear currentRoomId when confirmed by server
            if (currentRequestType == "leave_room") {
                currentRoomId = "";
                std::cout << "Server confirmed room exit" << std::endl;
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
                    std::cout << "Your ready status is now: " << (isReady ? "Ready" : "Not ready") << std::endl;
                } else {
                    std::cout << "Another player's ready status changed" << std::endl;
                }
            }
            resetLoadingState();
        }
        else if (j.contains("event") && j["event"] == "round_start") {
            // Handle round start events
            if (j.contains("payload")) {
                std::cout << "----------------------------------------" << std::endl;
                std::cout << "[RoomManager.cpp] ROUND START EVENT RECEIVED" << std::endl;
                
                // Debug the exact data received
                std::cout << "[RoomManager.cpp] Round start payload: " << j["payload"].dump(2) << std::endl;
                
                // Check if this is the new format with cards included
                if (j["payload"].contains("playerCards")) {
                    std::cout << "[RoomManager.cpp] Round start includes cards data (new format)" << std::endl;
                }
                
                // Extract round number - this is the important part
                int roundNumber = 1;
                
                if (j["payload"].contains("roundNumber")) {
                    roundNumber = j["payload"]["roundNumber"];
                    std::cout << "[RoomManager.cpp] Starting Round Number: " << roundNumber << std::endl;
                }
                
                // Update currentRoundNumber directly
                currentRoundNumber = roundNumber;
                
                // Let GameState handle timer and cards (client-side only now)
                if (gameState) {
                    gameState->updateTimerFromEvent(j["payload"]);
                    
                    // If we have cards, they should now be updated from the round_start event directly
                    // So we don't need separate handling for lastReceivedCards here
                }
                else {
                    std::cerr << "[RoomManager.cpp] Error: GameState not available for round start event" << std::endl;
                }
                
                std::cout << "----------------------------------------" << std::endl;
            }
            resetLoadingState();
        }
        else if (j.contains("event") && j["event"] == "round_end") {
            // Handle round end events
            if (j.contains("payload")) {
                std::cout << "----------------------------------------" << std::endl;
                std::cout << "ROUND END EVENT RECEIVED" << std::endl;
                
                // Debug the exact data received
                std::cout << "Round end payload: " << j["payload"].dump() << std::endl;
                
                int roundNumber = currentRoundNumber;
                if (j["payload"].contains("roundNumber")) {
                    roundNumber = j["payload"]["roundNumber"];
                    std::cout << "Completed Round Number: " << roundNumber << std::endl;
                }
                
                // Check for round results
                bool isWinner = false;
                if (j["payload"].contains("roundWinner")) {
                    std::string winnerId = j["payload"]["roundWinner"];
                    isWinner = (winnerId == deviceId);
                    std::cout << "Round winner: " << (isWinner ? "YOU" : winnerId) << std::endl;
                }
                
                // Use DisplayManager to update the LCD with round result
                if (displayManager) {
                    displayManager->displayRoundEnd(roundNumber, isWinner);
                }
                
                // Stop any active timer since the round has ended
                if (gameState) {
                    gameState->stopTimerThread();
                }
                
                std::cout << "Waiting for next round to begin..." << std::endl;
                std::cout << "----------------------------------------" << std::endl;
            }
            resetLoadingState();
        }
        else if (j.contains("event") && j["event"] == "game_starting") {
            // Handle game starting event (countdown)
            std::cout << "Game is starting soon..." << std::endl;
            
            // Use DisplayManager to show countdown
            if (displayManager) {
                displayManager->displayGameStarting();
            }
            
            resetLoadingState();
        }
        else if (j.contains("event") && j["event"] == "game_started") {
            // Handle game started event - just update game status
            gameInProgress = true;
            std::cout << "Game has started!" << std::endl;
            
            // Use DisplayManager to show game has started
            if (displayManager) {
                displayManager->displayGameStarted();
            }
            
            resetLoadingState();
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
                    std::cout << "Current round: " << roundNumber << std::endl;
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
                std::cout << "Received server command: " << command << std::endl;
                
                // Check if the message is targeted for this specific BeagleBoard
                bool isTargetedMessage = false;
                if (j["payload"].contains("targetPlayerId")) {
                    std::string targetPlayerId = j["payload"]["targetPlayerId"];
                    isTargetedMessage = true;
                    
                    // If this message is not for us, ignore it
                    if (targetPlayerId != deviceId) {
                        std::cout << "Ignoring command targeted for another player: " << targetPlayerId << std::endl;
                        resetLoadingState();
                        return;
                    }
                    
                    std::cout << "Processing targeted command for this device" << std::endl;
                }
                
                // Handle CARDS command - display cards on LCD
                if (command == "CARDS" && j["payload"].contains("cards")) {
                    std::cout << "Received cards from server" << std::endl;
                    
                    // Let GameState handle the cards
                    if (gameState) {
                        gameState->processCards(j["payload"]);
                    }
                    else {
                        std::cerr << "Error: GameState not available for cards command" << std::endl;
                    }
                }
                
                // Log the details
                if (j["payload"].contains("details")) {
                    std::cout << "Command details: " << j["payload"]["details"].dump() << std::endl;
                }
            }
            
            resetLoadingState();
        }
        else if (j.contains("event") && j["event"] == "gesture_event") {
            // Handle gesture events - just log them
            if (j.contains("payload")) {
                auto& payload = j["payload"];
                if (payload.contains("playerId") && payload.contains("gesture")) {
                    std::string playerId = payload["playerId"];
                    std::string gesture = payload["gesture"];
                    
                    // Log gesture event
                    std::cout << "Gesture event: " << gesture << " from player " << playerId 
                              << (playerId == deviceId ? " (YOU)" : "") << std::endl;
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
        std::cerr << "Error parsing JSON message: " << e.what() << std::endl;
        
        // Try legacy format parsing for backwards compatibility
        if (message.find("ROOMLIST|") == 0) {
            parseRoomList(message.substr(9)); // Skip "ROOMLIST|"
            
            // Only display room list if this was in response to a listrooms command
            if (currentRequestType == "room_list") {
                displayRoomList();
            }
            
            // Reset loading state
            resetLoadingState();
        }
        else if (message.find("JOINED|") == 0) {
            std::cout << "Successfully joined room" << std::endl;
            connected = true;
            resetLoadingState();
        }
        else if (message.find("LEFT|") == 0) {
            std::cout << "Successfully left room" << std::endl;
            connected = false;
            currentRoomId = "";
            resetLoadingState();
        }
        else if (message.find("RESPONSE:JOIN_ROOM") == 0) {
            if (message.find("status:SUCCESS") != std::string::npos) {
                std::cout << "Successfully joined room" << std::endl;
                connected = true;
            } else {
                std::cerr << "Failed to join room: " << message << std::endl;
            }
            resetLoadingState();
        }
        else if (message.find("RESPONSE:LEAVE_ROOM") == 0) {
            if (message.find("status:SUCCESS") != std::string::npos) {
                std::cout << "Successfully left room" << std::endl;
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
        std::cout << "No rooms available. Try creating a new room." << std::endl;
        return;
    }
    
    std::cout << "Available rooms:" << std::endl;
    std::cout << "--------------------------------------------------------" << std::endl;
    std::cout << std::left << std::setw(24) << "Room ID" << " | "
              << std::setw(25) << "Name" << " | "
              << std::setw(10) << "Players" << " | "
              << std::setw(10) << "Status" << std::endl;
    std::cout << "--------------------------------------------------------" << std::endl;
    
    for (const auto& room : availableRooms) {
        std::cout << std::left << std::setw(24) << room.id << " | "
                  << std::setw(25) << room.name << " | "
                  << std::setw(10) << room.playerCount << "/" << room.maxPlayers << " | "
                  << std::setw(10) << room.status << std::endl;
    }
    
    std::cout << "--------------------------------------------------------" << std::endl;
}

bool RoomManager::fetchAvailableRooms() {
    // Create JSON message directly
    json message = json::object();
    message["event"] = "room_list";
    message["payload"] = json::object();
    
    std::string jsonMessage = message.dump();
    
    // Direct send for maximum performance
    return sendMessageWithTracking(jsonMessage, "room_list");
}

bool RoomManager::createRoom(const std::string& roomName) {
    if (!client || !client->isConnected()) {
        std::cerr << "Cannot create room: WebSocket not connected" << std::endl;
        return false;
    }
    
    if (roomName.empty()) {
        std::cerr << "Cannot create room: Room name is empty" << std::endl;
        return false;
    }
    
    if (playerName.empty()) {
        std::cerr << "Cannot create room: Player name is not set" << std::endl;
        return false;
    }
    
    // Generate a random room ID using modern C++ random number generation
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> dis(1000, 9999); // Range 1000-9999 for 4 digit numbers
    std::string roomId = "room_" + std::to_string(dis(gen));
    
    std::cout << "[RoomManager.cpp] Generated random room ID: " << roomId << std::endl;
    
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
    
    std::cout << "Sending create room request: " << jsonMessage << std::endl;
    
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

bool RoomManager::sendMessageWithTracking(const std::string& message, const std::string& requestType) {
    if (!client) {
        return false;
    }
    
    // Check if we're already waiting for a response
    if (isWaitingForResponse) {
        // Instead of waiting for a timeout, allow new requests to proceed
        // and simply update the tracking information
        std::cout << "New request while waiting for " << currentRequestType << ", continuing anyway" << std::endl;
        resetLoadingState();
    }
    
    // Set loading state
    isWaitingForResponse = true;
    currentRequestType = requestType;
    lastRequestTime = std::chrono::steady_clock::now();
    
    // Send the message
    return client->sendMessage(message);
}

// Getters implementation
const std::vector<Room> RoomManager::getAvailableRooms() const {
    std::lock_guard<std::mutex> lock(const_cast<std::mutex&>(roomsMutex));
    return availableRooms;
}

bool RoomManager::joinRoom(const std::string& roomId) {
    if (!client || !client->isConnected()) {
        std::cerr << "Cannot join room: WebSocket not connected" << std::endl;
        return false;
    }
    
    if (roomId.empty()) {
        std::cerr << "Cannot join room: Room ID is empty" << std::endl;
        return false;
    }
    
    if (playerName.empty()) {
        std::cerr << "Cannot join room: Player name is not set" << std::endl;
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
    
    std::cout << "Sending join request: " << jsonMessage << std::endl;
    
    return sendMessageWithTracking(jsonMessage, "join_room");
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
    
    std::string jsonMessage = message.dump();
    
    connected = false; // Optimistically mark as disconnected
    
    return sendMessageWithTracking(jsonMessage, "leave_room");
}

void RoomManager::setReady(bool isReady) {
    if (!client || !connected) {
        std::cerr << "Cannot set ready status: not connected to a room" << std::endl;
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
    
    std::string jsonMessage = message.dump();
    
    // Set ready status for tracking purposes - will be confirmed by server response
    ready = isReady;
    
    // TEST CODE: Force a display update to verify LCD is working
    if (isReady && gameState && displayManager) {
        std::cout << "\n[RoomManager.cpp] TEST: Forcing a display update to verify LCD..." << std::endl;
        // Set some example values for testing
        gameState->setCurrentRoundNumber(1);
        gameState->setCurrentTurnTimeRemaining(30);
        // Try to update the display
        displayManager->updateCardAndGameDisplay();
        std::cout << "[RoomManager.cpp] TEST: Display update complete\n" << std::endl;
    }
    
    // Send the message - no tracking needed as we'll receive room_updated
    client->sendMessage(jsonMessage);
}

bool RoomManager::sendGestureData(const std::string& gestureData) {
    if (!client || !client->isConnected() || !connected) {
        std::cerr << "Cannot send gesture data: not connected" << std::endl;
        return false;
    }
    
    // Create JSON message using modern format
    json payload = json::object();
    payload["playerId"] = deviceId;
    payload["roomId"] = currentRoomId;
    
    // Parse the gesture data as JSON and add it to the payload
    try {
        json gestureJson = json::parse(gestureData);
        payload["gesture"] = gestureJson["gesture"];
        payload["confidence"] = gestureJson["confidence"];
    } catch (const json::parse_error& e) {
        // If parsing fails, try to include the raw data
        std::cerr << "Error parsing gesture data: " << e.what() << std::endl;
        payload["gestureData"] = gestureData;
    }
    
    json message = json::object();
    message["event"] = "gesture_event";
    message["payload"] = payload;
    
    std::string jsonMessage = message.dump();
    std::cout << "Sending gesture event: " << jsonMessage << std::endl;
    
    return client->sendMessage(jsonMessage);
} 