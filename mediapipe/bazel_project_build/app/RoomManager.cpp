#include "RoomManager.h"
#include <iostream>
#include <random>
#include <sstream>
#include <algorithm>
#include <nlohmann/json.hpp>

// For convenience
using json = nlohmann::json;

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
    : client(client), receiver(nullptr), connected(false), ready(false), 
      isWaitingForResponse(false), currentRequestType("") {
    // Generate a unique device ID
    deviceId = generateDeviceId();
    std::cout << "Room Manager initialized with device ID: " << deviceId << std::endl;
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
}

bool RoomManager::startReceiver() {
    if (!client) {
        std::cerr << "No WebSocket client available" << std::endl;
        return false;
    }
    
    receiver = new WebSocketReceiver(client);
    receiver->setMessageCallback([this](const std::string& message) {
        this->handleMessage(message);
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
                        
                        for (const auto& player : room["players"]) {
                            if ((player.contains("id") && player["id"] == deviceId) ||
                                (player.contains("name") && player["name"] == playerName)) {
                                // We're in this room
                                connected = true;
                                foundSelf = true;
                                std::cout << "You're now connected to room: \"" << room["name"].get<std::string>() << "\"" << std::endl;
                                std::cout << "Players in room: " << playerCount << "/" 
                                          << (room.contains("maxPlayers") ? room["maxPlayers"].get<int>() : 2) << std::endl;
                                break;
                            }
                        }
                        
                        // If we didn't find ourselves in the player list
                        if (!foundSelf && connected) {
                            std::cout << "You're no longer in room: \"" << room["name"].get<std::string>() << "\"" << std::endl;
                            connected = false;
                            currentRoomId = "";
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
        else if (j.contains("event") && j["event"] == "turn_start") {
            // Handle turn start event
            if (j.contains("payload")) {
                auto& payload = j["payload"];
                if (payload.contains("playerId") && payload.contains("remainingTime")) {
                    std::lock_guard<std::mutex> lock(gameStateMutex);
                    
                    std::string turnPlayerId = payload["playerId"];
                    int remainingTime = payload["remainingTime"];
                    
                    // Update current turn
                    currentTurnPlayerId = turnPlayerId;
                    isMyTurn = (turnPlayerId == deviceId);
                    
                    // Calculate turn end time
                    turnTimeoutSeconds = remainingTime / 1000; // Convert ms to seconds
                    turnEndTime = std::chrono::steady_clock::now() + std::chrono::milliseconds(remainingTime);
                    
                    std::cout << "Turn started for player " << turnPlayerId 
                              << (isMyTurn ? " (YOU)" : "") 
                              << ". Time remaining: " << turnTimeoutSeconds << " seconds" << std::endl;
                }
            }
        }
        else if (j.contains("event") && j["event"] == "turn_end") {
            // Handle turn end event
            if (j.contains("payload")) {
                auto& payload = j["payload"];
                if (payload.contains("nextPlayerId") && payload.contains("gameState")) {
                    std::lock_guard<std::mutex> lock(gameStateMutex);
                    
                    // Update whose turn is next
                    currentTurnPlayerId = payload["nextPlayerId"];
                    isMyTurn = (currentTurnPlayerId == deviceId);
                    
                    // Parse the game state
                    auto& gameState = payload["gameState"];
                    
                    // Update tower heights if available as JSON objects
                    if (gameState.contains("towerHeights")) {
                        for (auto& [playerId, height] : gameState["towerHeights"].items()) {
                            if (playerId == deviceId) {
                                myTowerHeight = height;
                            } else {
                                opponentTowerHeight = height;
                            }
                        }
                    }
                    
                    // Update goal heights if available
                    if (gameState.contains("goalHeights")) {
                        for (auto& [playerId, height] : gameState["goalHeights"].items()) {
                            if (playerId == deviceId) {
                                myGoalHeight = height;
                            } else {
                                opponentGoalHeight = height;
                            }
                        }
                    }
                    
                    // Update shield status if available
                    if (gameState.contains("playerShields")) {
                        for (auto& [playerId, shieldActive] : gameState["playerShields"].items()) {
                            if (playerId == deviceId) {
                                myShieldActive = shieldActive;
                            } else {
                                opponentShieldActive = shieldActive;
                            }
                        }
                    }
                    
                    std::cout << "Turn ended. Next player: " << currentTurnPlayerId 
                              << (isMyTurn ? " (YOU)" : "") << std::endl;
                    std::cout << "Your tower height: " << myTowerHeight << "/" << myGoalHeight 
                              << ", Opponent: " << opponentTowerHeight << "/" << opponentGoalHeight << std::endl;
                }
            }
        }
        else if (j.contains("event") && j["event"] == "game_started") {
            // Handle game started event
            std::lock_guard<std::mutex> lock(gameStateMutex);
            
            // Reset game state
            myTowerHeight = 0;
            opponentTowerHeight = 0;
            myShieldActive = false;
            opponentShieldActive = false;
            isMyTurn = false;
            gameInProgress = true;
            
            std::cout << "Game started!" << std::endl;
        }
        else if (j.contains("event") && j["event"] == "game_ended") {
            // Handle game ended event
            if (j.contains("payload")) {
                auto& payload = j["payload"];
                if (payload.contains("winnerId")) {
                    std::lock_guard<std::mutex> lock(gameStateMutex);
                    
                    std::string winnerId = payload["winnerId"];
                    bool isWinner = (winnerId == deviceId);
                    
                    gameInProgress = false;
                    
                    std::cout << "Game ended. Winner: " << winnerId 
                              << (isWinner ? " (YOU WIN!)" : " (You lose)") << std::endl;
                }
            }
        }
        else if (j.contains("event") && j["event"] == "beagle_board_command") {
            // Handle beagle board specific commands
            if (j.contains("payload") && j["payload"].contains("command")) {
                std::string command = j["payload"]["command"];
                
                if (command == "CARDS" && j["payload"].contains("cards")) {
                    // Process card data from server
                    std::lock_guard<std::mutex> lock(cardsMutex);
                    playerCards.clear();
                    
                    for (const auto& cardJson : j["payload"]["cards"]) {
                        Card card;
                        card.id = cardJson["id"];
                        card.type = cardJson["type"];
                        card.name = cardJson["name"];
                        card.description = cardJson["description"];
                        playerCards.push_back(card);
                    }
                    
                    std::cout << "Received " << playerCards.size() << " cards from server" << std::endl;
                    for (const auto& card : playerCards) {
                        std::cout << "Card: " << card.name << " (" << card.type << ") - " << card.description << std::endl;
                    }
                }
                else if (command == "GAME_STATE" && j["payload"].contains("gameState")) {
                    // Handle full game state update
                    std::lock_guard<std::mutex> lock(gameStateMutex);
                    
                    auto& gameState = j["payload"]["gameState"];
                    
                    // Parse all relevant game state
                    if (gameState.contains("towerHeights")) {
                        for (auto& [playerId, height] : gameState["towerHeights"].items()) {
                            if (playerId == deviceId) {
                                myTowerHeight = height;
                            } else {
                                opponentTowerHeight = height;
                            }
                        }
                    }
                    
                    if (gameState.contains("goalHeights")) {
                        for (auto& [playerId, height] : gameState["goalHeights"].items()) {
                            if (playerId == deviceId) {
                                myGoalHeight = height;
                            } else {
                                opponentGoalHeight = height;
                            }
                        }
                    }
                    
                    if (gameState.contains("currentTurn")) {
                        currentTurnPlayerId = gameState["currentTurn"];
                        isMyTurn = (currentTurnPlayerId == deviceId);
                    }
                    
                    std::cout << "Received full game state update" << std::endl;
                    std::cout << "Your tower: " << myTowerHeight << "/" << myGoalHeight 
                              << ", Opponent: " << opponentTowerHeight << "/" << opponentGoalHeight << std::endl;
                    std::cout << "Current turn: " << (isMyTurn ? "YOUR TURN" : "OPPONENT'S TURN") << std::endl;
                }
            }
            
            resetLoadingState();
        }
        else if (j.contains("event") && j["event"] == "gesture_event") {
            // Handle gesture events
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

bool RoomManager::fetchAvailableRooms() {
    // Create JSON message directly
    json message = json::object();
    message["event"] = "room_list";
    message["payload"] = json::object();
    
    std::string jsonMessage = message.dump();
    
    // Set request tracking for room_list to control logging
    isWaitingForResponse = true;
    currentRequestType = "room_list";
    
    // Direct send without logging or tracking for maximum performance
    bool result = client->sendMessage(jsonMessage);
    
    // Make sure client processes the message right away
    client->ensureMessageProcessing();
    
    return result;
}

bool RoomManager::joinRoom(const std::string& roomId) {
    if (!client) {
        return false;
    }
    
    // Can't join a room if already in one
    if (connected) {
        std::cerr << "Already connected to a room. Leave current room first." << std::endl;
        return false;
    }
    
    // Create JSON message directly
    json payload = json::object();
    payload["roomId"] = roomId;
    payload["playerId"] = deviceId;
    payload["playerName"] = playerName;
    
    json message = json::object();
    message["event"] = "join_room";
    message["payload"] = payload;
    
    std::string jsonMessage = message.dump();
    
    // Store room ID for reference
    currentRoomId = roomId;
    
    // Set request tracking
    isWaitingForResponse = true;
    currentRequestType = "join_room";
    
    // Direct send for maximum performance
    bool result = client->sendMessage(jsonMessage);
    client->ensureMessageProcessing();
    
    return result;
}

bool RoomManager::leaveRoom() {
    if (!client) {
        return false;
    }
    
    if (!connected) {
        return false;
    }
    
    // Create JSON message directly
    json payload = json::object();
    payload["roomId"] = currentRoomId;
    payload["playerId"] = deviceId;
    
    json message = json::object();
    message["event"] = "leave_room";
    message["payload"] = payload;
    
    std::string jsonMessage = message.dump();
    
    // Set request tracking
    isWaitingForResponse = true;
    currentRequestType = "leave_room";
    
    // Set status immediately to improve user experience
    connected = false;
    std::cout << "Successfully left room" << std::endl;
    
    // Direct send for maximum performance and request callback immediately
    bool result = client->sendMessage(jsonMessage);
    client->ensureMessageProcessing();
    
    return result;
}

void RoomManager::setReady(bool isReady) {
    if (!client || !connected) {
        return;
    }
    
    ready = isReady;
    
    // Create JSON message directly
    json payload = json::object();
    payload["roomId"] = currentRoomId;
    payload["playerId"] = deviceId;
    payload["isReady"] = isReady;
    
    json message = json::object();
    message["event"] = "player_ready";
    message["payload"] = payload;
    
    std::string jsonMessage = message.dump();
    
    // Set request tracking
    isWaitingForResponse = true;
    currentRequestType = "player_ready";
    
    // Direct send for maximum performance
    client->sendMessage(jsonMessage);
    client->ensureMessageProcessing();
}

bool RoomManager::sendGestureData(const std::string& gestureData) {
    if (!client || !client->isConnected() || !connected) {
        std::cerr << "Cannot send gesture data: not connected" << std::endl;
        return false;
    }
    
    // Simple string version for backward compatibility
    std::string message = "GESTURE|DeviceID:" + deviceId + "|RoomID:" + currentRoomId + "|" + gestureData;
    return client->sendMessage(message);
}

const std::vector<Room> RoomManager::getAvailableRooms() const {
    std::lock_guard<std::mutex> lock(const_cast<std::mutex&>(roomsMutex));
    return availableRooms;
}

// Add new method to parse JSON room list
void RoomManager::parseJsonRoomList(const json& roomsArray) {
    std::lock_guard<std::mutex> lock(roomsMutex);
    availableRooms.clear();
    
    if (roomsArray.is_array()) {
        for (const auto& roomJson : roomsArray) {
            // Initialize all fields to ensure no garbage values
            Room room;
            room.id = "";
            room.name = "";
            room.playerCount = 0;
            room.maxPlayers = 0;
            room.status = "";
            
            // Extract required fields
            if (roomJson.contains("id")) room.id = roomJson["id"];
            if (roomJson.contains("name")) room.name = roomJson["name"];
            if (roomJson.contains("status")) room.status = roomJson["status"];
            
            // Extract player count - use playerCount field if available (server filtered count)
            if (roomJson.contains("playerCount")) {
                try {
                    room.playerCount = roomJson["playerCount"];
                } catch (...) {
                    room.playerCount = 0;
                }
            } else if (roomJson.contains("players") && roomJson["players"].is_array()) {
                // If no playerCount field, count BeagleBoard players manually
                int count = 0;
                for (const auto& player : roomJson["players"]) {
                    if (player.contains("playerType") && player["playerType"] == "beagleboard") {
                        count++;
                    }
                }
                room.playerCount = count;
            }
            
            if (roomJson.contains("maxPlayers")) {
                try {
                    room.maxPlayers = roomJson["maxPlayers"];
                } catch (...) {
                    room.maxPlayers = 2; // Default value
                }
            }
            
            availableRooms.push_back(room);
        }
    }
}

void RoomManager::displayRoomList() {
    std::lock_guard<std::mutex> lock(roomsMutex);
    
    if (availableRooms.empty()) {
        std::cout << "No rooms available." << std::endl;
    } else {
        std::cout << "Available rooms:" << std::endl;
        for (const auto& room : availableRooms) {
            std::cout << "  ID: " << room.id << " | Name: " << room.name 
                      << " | Players: " << room.playerCount << "/" << room.maxPlayers 
                      << " | Status: " << room.status << std::endl;
        }
    }
}

bool RoomManager::createRoom(const std::string& roomName) {
    if (!client) {
        return false;
    }
    
    // Can't create a room if already in one
    if (connected) {
        std::cerr << "Already connected to a room. Leave current room first." << std::endl;
        return false;
    }
    
    // Check if player name is set
    if (playerName.empty()) {
        std::cerr << "Player name is not set. Please use 'setname' command first." << std::endl;
        return false;
    }
    
    // Generate a random room ID
    std::string roomId = "BB_";
    static const char alphanum[] =
        "0123456789"
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> dis(0, sizeof(alphanum) - 2);
    
    for (int i = 0; i < 5; ++i) {
        roomId += alphanum[dis(gen)];
    }
    
    // Store the intended room ID before sending the request
    currentRoomId = roomId;
    
    // Use JSON message format directly
    json room = json::object();
    room["id"] = roomId;
    room["name"] = roomName;
    room["maxPlayers"] = 2;  // Ensure this is set to 2 for multiplayer support
    room["status"] = "waiting";
    room["hostId"] = deviceId;
    
    // Create player object
    json player = json::object();
    player["id"] = deviceId;
    player["name"] = playerName;
    player["isReady"] = false;  // Player starts as not ready
    player["connected"] = true;
    player["playerType"] = "beagleboard";
    
    // Add player to room
    json players = json::array();
    players.push_back(player);
    room["players"] = players;
    
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

// Card management implementations
const std::vector<Card> RoomManager::getPlayerCards() const {
    std::lock_guard<std::mutex> lock(const_cast<std::mutex&>(cardsMutex));
    return playerCards;
}

Card* RoomManager::findCardByType(const std::string& type) {
    std::lock_guard<std::mutex> lock(cardsMutex);
    for (auto& card : playerCards) {
        if (card.type == type) {
            return &card;
        }
    }
    return nullptr;
}

bool RoomManager::sendCardAction(const std::string& cardId, const std::string& action) {
    if (!client || !client->isConnected() || !connected) {
        std::cerr << "Cannot send card action: not connected" << std::endl;
        return false;
    }
    
    // Check if the action is valid
    if (action != "attack" && action != "defend" && action != "build") {
        std::cerr << "Invalid card action: " << action << std::endl;
        return false;
    }
    
    // Check if we have this card
    bool cardFound = false;
    {
        std::lock_guard<std::mutex> lock(cardsMutex);
        for (const auto& card : playerCards) {
            if (card.id == cardId) {
                cardFound = true;
                break;
            }
        }
    }
    
    if (!cardFound) {
        std::cerr << "Card not found: " << cardId << std::endl;
        return false;
    }
    
    // Create JSON gesture data
    json gestureData = {
        {"gesture", action},
        {"cardId", cardId},
        {"confidence", 1.0}
    };
    
    // Send the gesture data
    std::string message = "GESTURE|DeviceID:" + deviceId + "|RoomID:" + currentRoomId + "|" + gestureData.dump();
    return client->sendMessage(message);
}

// Get the opponent's name
std::string RoomManager::getOpponentName() const {
    return opponentName;
}

// Get the remaining time in the current turn (in seconds)
int RoomManager::getRemainingTurnTime() const {
    std::lock_guard<std::mutex> lock(const_cast<std::mutex&>(gameStateMutex));
    
    auto now = std::chrono::steady_clock::now();
    auto remaining = std::chrono::duration_cast<std::chrono::seconds>(turnEndTime - now).count();
    
    return remaining > 0 ? static_cast<int>(remaining) : 0;
}

// Check if it's this player's turn
bool RoomManager::isPlayerTurn() const {
    std::lock_guard<std::mutex> lock(const_cast<std::mutex&>(gameStateMutex));
    return isMyTurn;
}

// Get the current tower heights and goal heights
void RoomManager::getTowerStatus(int& myHeight, int& myGoal, int& oppHeight, int& oppGoal) const {
    std::lock_guard<std::mutex> lock(const_cast<std::mutex&>(gameStateMutex));
    myHeight = myTowerHeight;
    myGoal = myGoalHeight;
    oppHeight = opponentTowerHeight;
    oppGoal = opponentGoalHeight;
}

// Check if my shield is active
bool RoomManager::isShieldActive() const {
    std::lock_guard<std::mutex> lock(const_cast<std::mutex&>(gameStateMutex));
    return myShieldActive;
}

// Check if the game is in progress
bool RoomManager::isGameActive() const {
    std::lock_guard<std::mutex> lock(const_cast<std::mutex&>(gameStateMutex));
    return gameInProgress;
} 