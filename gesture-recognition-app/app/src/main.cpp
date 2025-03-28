#include "gesture.h"
#include "room_manager.h"
#include <iostream>
#include <thread>
#include <string>
#include <sstream>

// Function to display available commands
void displayHelp() {
    std::cout << "Available commands:" << std::endl;
    std::cout << "  help                - Display this help message" << std::endl;
    std::cout << "  setname <name>      - Set your player name" << std::endl;
    std::cout << "  listrooms           - Fetch and display available rooms" << std::endl;
    std::cout << "  joinroom <room_id>  - Join a specific room" << std::endl;
    std::cout << "  leaveroom           - Leave the current room" << std::endl;
    std::cout << "  status              - Show current status" << std::endl;
    std::cout << "  ready               - Set your status to ready" << std::endl;
    std::cout << "  notready            - Set your status to not ready" << std::endl;
    std::cout << "  start               - Start gesture detection" << std::endl;
    std::cout << "  stop                - Stop gesture detection" << std::endl;
    std::cout << "  webcamtest          - Test Your Webcam to see if it works" << std::endl;
    std::cout << "  exit                - Exit the application" << std::endl;
}

int main() {

    // Initialize UDP sender for the room manager
    UDPSender* udpSender = new UDPSender("159.54.171.194", 9090);  // Server IP and port
    
    // Create room manager with UDP sender
    RoomManager roomManager(udpSender, ".device_id.cfg", 9091); // Listen on port 9091 for responses
    
    // Start the UDP receiver to listen for server responses
    if (!roomManager.startReceiver()) {
        std::cerr << "Failed to start UDP receiver. Some functionality may be limited." << std::endl;
    } else {
        std::cout << "UDP receiver started successfully." << std::endl;
    }
    
    GestureDetector detector;
    // Set the room manager for the detector
    detector.setRoomManager(&roomManager);
    
    bool detectionRunning = false;
    
    std::cout << "=== Beagle Board Gesture Control Client ===" << std::endl;
    std::cout << "Device ID: " << roomManager.getDeviceId() << std::endl;
    displayHelp();
    
    std::string line;
    while (true) {
        std::cout << "> ";
        std::getline(std::cin, line);
        
        // Parse command
        std::istringstream iss(line);
        std::string command;
        iss >> command;
        
        if (command == "help") {
            displayHelp();
        }
        else if (command == "setname") {
            std::string name;
            std::getline(iss >> std::ws, name);
            
            if (name.empty()) {
                std::cout << "Usage: setname <name>" << std::endl;
            } else {
                roomManager.setPlayerName(name);
                std::cout << "Player name set to: " << name << std::endl;
            }
        }
        else if (command == "listrooms") {
            std::cout << "Fetching available rooms..." << std::endl;
            if (roomManager.fetchAvailableRooms()) {
                const auto& rooms = roomManager.getAvailableRooms();
                if (rooms.empty()) {
                    std::cout << "No rooms available." << std::endl;
                } else {
                    std::cout << "Available rooms:" << std::endl;
                    for (const auto& room : rooms) {
                        std::cout << "  ID: " << room.id << " | Name: " << room.name 
                                  << " | Players: " << room.playerCount << "/" << room.maxPlayers 
                                  << " | Status: " << room.status << std::endl;
                    }
                }
            } else {
                std::cout << "Failed to fetch rooms. Check your network connection." << std::endl;
            }
        }
        else if (command == "joinroom") {
            std::string roomId;
            iss >> roomId;
            
            if (roomId.empty()) {
                std::cout << "Usage: joinroom <room_id>" << std::endl;
            } else if (roomManager.getPlayerName().empty()) {
                std::cout << "Please set your player name first using 'setname <name>'" << std::endl;
            } else {
                if (roomManager.joinRoom(roomId)) {
                    std::cout << "Successfully joined room: " << roomId << std::endl;
                } else {
                    std::cout << "Failed to join room. Check the room ID and try again." << std::endl;
                }
            }
        }
        else if (command == "leaveroom") {
            if (roomManager.isConnected()) {
                if (roomManager.leaveRoom()) {
                    std::cout << "Successfully left room." << std::endl;
                } else {
                    std::cout << "Failed to leave room." << std::endl;
                }
            } else {
                std::cout << "Not currently in a room." << std::endl;
            }
        }
        else if (command == "status") {
            std::cout << "Device ID: " << roomManager.getDeviceId() << std::endl;
            std::cout << "Player name: " << 
                (roomManager.getPlayerName().empty() ? "(not set)" : roomManager.getPlayerName()) << std::endl;
            std::cout << "Room status: " << 
                (roomManager.isConnected() ? ("Connected to room " + roomManager.getCurrentRoomId()) : "Not connected") << std::endl;
            std::cout << "Gesture detection: " << (detectionRunning ? "Running" : "Stopped") << std::endl;
        }
        else if (command == "ready") {
            roomManager.setReady(true);
        }
        else if (command == "notready") {
            roomManager.setReady(false);
        }
        else if (command == "start") {
            if (!detectionRunning) {
                if (!roomManager.isConnected()) {
                    std::cout << "Warning: Not connected to a room. Gestures will not be sent to a game." << std::endl;
                }
                
                detector.startDetection();
                detectionRunning = true;
                std::cout << "Gesture detection started." << std::endl;
            } else {
                std::cout << "Gesture detection is already running." << std::endl;
            }
        }
        else if (command == "stop") {
            if (detectionRunning) {
                detector.stopDetection();
                detectionRunning = false;
                std::cout << "Gesture detection stopped." << std::endl;
            } else {
                std::cout << "Gesture detection is already stopped." << std::endl;
            }
        }
        else if (command == "webcamtest") {
            detector.runTestingMode();
        }
        else if (command == "exit") {
            if (detectionRunning) {
                detector.stopDetection();
            }
            
            if (roomManager.isConnected()) {
                roomManager.leaveRoom();
            }
            
            std::cout << "Exiting application..." << std::endl;
            break;
        }
        else if (!command.empty()) {
            std::cout << "Unknown command: " << command << ". Type 'help' for available commands." << std::endl;
        }
    }

    delete udpSender;
    return 0;
}
