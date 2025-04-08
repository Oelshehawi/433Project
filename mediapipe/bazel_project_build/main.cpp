#include "app/gesture.h"
#include "app/RoomManager.h"
#include "app/WebSocketClient.h"
#include "app/WebSocketReceiver.h"
#include "app/lcd_display.h"
#include "hal/rotary_press_statemachine.h"
#include <iostream>
#include <thread>
#include <string>
#include <sstream>
#include <exception>
#include <cstdlib>
#include <chrono>
//bazel build -c opt --crosstool_top=@crosstool//:toolchains --compiler=gcc --cpu=aarch64 --define MEDIAPIPE_DISABLE_GPU=1 //bazel_project_build:gesture_game

// Function to display available commands
void displayHelp() {
    std::cout << "Available commands:" << std::endl;
    std::cout << "  help                - Display this help message" << std::endl;
    std::cout << "  setname <name>      - Set your player name" << std::endl;
    std::cout << "  listrooms           - Fetch and display available rooms" << std::endl;
    std::cout << "  createroom <name>   - Create a new room with the given name" << std::endl;
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

int main(int argc, char* argv[]) {
    // Suppress TensorFlow and MediaPipe verbose logging
    setenv("TF_CPP_MIN_LOG_LEVEL", "2", 1);  // 0=debug, 1=info, 2=warning, 3=error
    setenv("GLOG_minloglevel", "2", 1);      // 0=info, 1=warning, 2=error, 3=fatal
    
    // Suppress specific warnings
    setenv("GLOG_stderrthreshold", "3", 1);  // Only log errors and fatal messages
    setenv("MEDIAPIPE_DISABLE_VERBOSE_LOGGING", "1", 1);  // Disable verbose MediaPipe logging
    
    std::cout << "=== Beagle Board Gesture Control Client - Starting up... ===" << std::endl;
    
    try {
        // Initialize WebSocket client
        std::cout << "Connecting to server via WebSocket..." << std::endl;
        WebSocketClient* webSocketClient = new WebSocketClient("four33project.onrender.com", 443, "/", true);
        
        // Try to connect with retries
        int retries = 0;
        const int maxRetries = 3;
        bool connected = false;
        
        while (retries < maxRetries && !connected) {
            if (retries > 0) {
                std::cout << "Retrying connection (attempt " << retries + 1 << " of " << maxRetries << ")..." << std::endl;
                // Wait 2 seconds between retries
                std::this_thread::sleep_for(std::chrono::seconds(2));
            }
            
            connected = webSocketClient->connect();
            retries++;
        }
        
        if (!connected) {
            std::cerr << "FATAL: Failed to connect to WebSocket server after " << maxRetries << " attempts. Cannot proceed." << std::endl;
            delete webSocketClient;
            return 1;
        }
        
        // Create room manager with WebSocket client
        std::cout << "Initializing Room Manager..." << std::endl;
        RoomManager* roomManager = new RoomManager(webSocketClient);
        
        // Start the WebSocket receiver to listen for server responses
        std::cout << "Starting WebSocket receiver..." << std::endl;
        if (!roomManager->startReceiver()) {
            std::cerr << "WARNING: Failed to start WebSocket receiver. Some functionality may be limited." << std::endl;
            std::cerr << "Check network connectivity and firewall settings." << std::endl;
        } else {
            std::cout << "WebSocket receiver started successfully." << std::endl;
        }
        
        // Connection test is already done during the WebSocketClient::connect() call
        // No need to send an additional test message
        std::cout << "Successfully connected to server." << std::endl;
        
        std::cout << "Initializing gesture detector..." << std::endl;
        GestureDetector detector;
        // Set the room manager for the detector
        detector.setRoomManager(roomManager);
        
        // Test camera access
        std::cout << "Testing camera access..." << std::endl;
        if (!detector.testCameraAccess()) {
            std::cerr << "WARNING: Could not access camera. Gesture detection will not work." << std::endl;
            std::cerr << "Please check camera permissions and connections." << std::endl;
        } else {
            std::cout << "Camera access successful." << std::endl;
        }
        
        // Initialize LCD at startup
        std::cout << "Initializing LCD display..." << std::endl;
        lcd_init();
        
        // Initialize rotary encoder
        std::cout << "Initializing input controls..." << std::endl;
        rotary_press_statemachine_init();
        
        // Display welcome message
        char* welcomeMsg[] = {"Gesture Tower", "Game", "Ready!"};
        lcd_place_message(welcomeMsg, 3, lcd_center);
        
        bool detectionRunning = false;
        bool inputLocked = false;
        
        std::cout << "=== Beagle Board Gesture Control Client ===" << std::endl;
        std::cout << "Device ID: " << roomManager->getDeviceId() << std::endl;
        displayHelp();
        
        std::string line;
        while (true) {
            // Simple prompt
            std::cout << "> ";
            std::getline(std::cin, line);
            
            // Skip empty lines
            if (line.empty()) {
                continue;
            }
            
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
                    roomManager->setPlayerName(name);
                    std::cout << "Player name set to: " << name << std::endl;
                }
            }
            else if (command == "listrooms") {
                std::cout << "Fetching rooms (may take a moment)..." << std::endl;
                roomManager->fetchAvailableRooms();
            }
            else if (command == "joinroom") {
                std::string roomId;
                iss >> roomId;
                
                if (roomId.empty()) {
                    std::cout << "Usage: joinroom <room_id>" << std::endl;
                } else if (roomManager->getPlayerName().empty()) {
                    std::cout << "Please set your player name first using 'setname <name>'" << std::endl;
                } else {
                    roomManager->joinRoom(roomId);
                    std::cout << "Sending join request for room: " << roomId << std::endl;
                }
            }
            else if (command == "createroom") {
                std::string roomName;
                std::getline(iss >> std::ws, roomName);
                
                if (roomName.empty()) {
                    std::cout << "Usage: createroom <name>" << std::endl;
                } else if (roomManager->getPlayerName().empty()) {
                    std::cout << "Please set your player name first using 'setname <name>'" << std::endl;
                } else {
                    roomManager->createRoom(roomName);
                    std::cout << "Sending create room request for: " << roomName << std::endl;
                }
            }
            else if (command == "leaveroom") {
                if (roomManager->isConnected()) {
                    roomManager->leaveRoom();
                    std::cout << "Sending leave request..." << std::endl;
                } else {
                    std::cout << "Not currently in a room." << std::endl;
                }
            }
            else if (command == "status") {
                std::cout << "Device ID: " << roomManager->getDeviceId() << std::endl;
                std::cout << "Player name: " << 
                    (roomManager->getPlayerName().empty() ? "(not set)" : roomManager->getPlayerName()) << std::endl;
                std::cout << "Room status: " << 
                    (roomManager->isConnected() ? ("Connected to room " + roomManager->getCurrentRoomId()) : "Not connected") << std::endl;
                std::cout << "Ready status: " << (roomManager->isReady() ? "Ready" : "Not ready") << std::endl;
                std::cout << "Gesture detection: " << (detectionRunning ? "Running" : "Stopped") << std::endl;
            }
            else if (command == "ready") {
                if (roomManager->isConnected()) {
                    roomManager->setReady(true);
                    std::cout << "Setting status to ready..." << std::endl;
                } else {
                    std::cout << "Not connected to a room." << std::endl;
                }
            }
            else if (command == "notready") {
                if (roomManager->isConnected()) {
                    roomManager->setReady(false);
                    std::cout << "Setting status to not ready..." << std::endl;
                } else {
                    std::cout << "Not connected to a room." << std::endl;
                }
            }
            else if (command == "start") {
                if (!detectionRunning) {
                    if (!roomManager->isConnected()) {
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
                
                if (roomManager->isConnected()) {
                    roomManager->leaveRoom();
                }
                
                // Cleanup LCD before exit
                lcd_cleanup();
                
                // Cleanup rotary encoder
                rotary_press_statemachine_cleanup();
                
                std::cout << "Exiting application..." << std::endl;
                break;
            }
            else if (!command.empty()) {
                std::cout << "Unknown command: " << command << ". Type 'help' for available commands." << std::endl;
            }
        }
        
        // Clean up resources
        delete roomManager;
        delete webSocketClient;
        
    } catch (const std::exception& e) {
        std::cerr << "FATAL ERROR: Unhandled exception: " << e.what() << std::endl;
        return 1;
    } catch (...) {
        std::cerr << "FATAL ERROR: Unknown exception occurred" << std::endl;
        return 1;
    }
    
    return 0;
}
