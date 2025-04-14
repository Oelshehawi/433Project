#include <iostream>
#include <string>
#include <sstream>
#include <chrono>
#include <thread>
#include <cstdlib>
#include <algorithm>
#include <fstream>
#include <atomic>
#include <thread>

#include "app/WebSocketClient.h"
#include "app/WebSocketReceiver.h"
#include "app/MessageHandler.h"
#include "app/RoomManager.h"
#include "app/GameState.h"
#include "app/DisplayManager.h"
#include "app/GestureDetector.h"
#include "app/GestureEventSender.h"
#include "app/lcd_display.h"
#include "hal/rotary_press_statemachine.h"
#include "hal/joystick_press.h"
#include "app/SoundManager.h"
#include "app/audioMixer.h"

//bazel build -c opt --crosstool_top=@crosstool//:toolchains --compiler=gcc --cpu=aarch64 --define MEDIAPIPE_DISABLE_GPU=1 //bazel_project_build:gesture_game

std::atomic<bool> joystickRunning = false;


// Function to display available commands
void displayHelp() {
    std::cout << "Available commands:" << std::endl;
    std::cout << "  help                - Display this help message" << std::endl;
    std::cout << "  setname <n>      - Set your player name" << std::endl;
    std::cout << "  listrooms           - Fetch and display available rooms" << std::endl;
    std::cout << "  createroom <n>   - Create a new room with the given name" << std::endl;
    std::cout << "  joinroom <room_id>  - Join a specific room" << std::endl;
    std::cout << "  leaveroom           - Leave the current room" << std::endl;
    std::cout << "  status              - Show current status" << std::endl;
    std::cout << "  ready               - Set your status to ready" << std::endl;
    std::cout << "  notready            - Set your status to not ready" << std::endl;
    std::cout << "  start               - Start gesture detection" << std::endl;
    std::cout << "  stop                - Stop gesture detection" << std::endl;
    std::cout << "  webcamtest          - Test Your Webcam to see if it works" << std::endl;
    // Testing commands - to be removed in final version
    std::cout << "  starttimer [seconds]  - Test: Start timer (default 30s)" << std::endl;
    std::cout << "  stoptimer             - Test: Stop timer" << std::endl;
    std::cout << "  displaytimer          - Test: Display timer on LCD" << std::endl;
    std::cout << "  exit                - Exit the application" << std::endl;
}

int main(int argc, char* argv[]) {
    // More aggressive silencing of output from specific warnings by redirecting stderr
    std::freopen("/dev/null", "w", stderr);
    
    // Suppress TensorFlow and MediaPipe verbose logging with environment variables
    setenv("TF_CPP_MIN_LOG_LEVEL", "3", 1);             // 0=debug, 1=info, 2=warning, 3=error
    setenv("GLOG_minloglevel", "3", 1);                 // 0=info, 1=warning, 2=error, 3=fatal
    setenv("GLOG_stderrthreshold", "3", 1);             // Only log errors and fatal messages
    setenv("MEDIAPIPE_DISABLE_VERBOSE_LOGGING", "1", 1); // Disable verbose MediaPipe logging
    setenv("MEDIAPIPE_NO_WARNING", "1", 1);             // Additional suppression for MediaPipe
    setenv("TERM", "linux", 1);                        // Remove colored output in terminal
    
    // After setting environment variables, restore stderr but with filtering
    std::freopen("/dev/tty", "w", stderr);
    
    std::cout << "=== Beagle Board Gesture Control Client - Starting up... ===" << std::endl;
    
    // Create a simple filter for stderr to suppress specific warning messages
    std::ofstream logFile("/tmp/mediapipe.log", std::ios::out | std::ios::app);
    std::streambuf* stderr_buf = std::cerr.rdbuf();
    std::cerr.rdbuf(logFile.rdbuf());

    std::thread joystickThread;

    
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
        
        // Create room manager with WebSocket client first
        std::cout << "Initializing Room Manager..." << std::endl;
        RoomManager* roomManager = new RoomManager(webSocketClient);
        
        // Create components in the correct order to handle dependencies
        // First create GameState with null pointers, we'll set them later
        GameState* gameState = new GameState(nullptr, nullptr, roomManager->getDeviceId());
        
        // Then create DisplayManager with gameState
        DisplayManager* displayManager = new DisplayManager(gameState);
        
        // Now set up the connections between components
        gameState->setRoomManager(roomManager);
        gameState->setDisplayManager(displayManager);
        roomManager->setGameState(gameState);
        roomManager->setDisplayManager(displayManager);
        
        // Create message handler using the correct parameter order
        MessageHandler* messageHandler = new MessageHandler(roomManager, gameState, webSocketClient);
        
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
        GestureDetector* detector = new GestureDetector(roomManager);
        
        // Connect gesture detector to room manager for auto-play
        roomManager->setGestureDetector(detector);
        
        // Create and initialize gesture event sender
        std::cout << "Initializing gesture event sender..." << std::endl;
        roomManager->gestureEventSender = new GestureEventSender(webSocketClient);
        
        // Test camera access
        std::cout << "Testing camera access..." << std::endl;
        if (!detector->testCameraAccess()) {
            std::cerr << "WARNING: Could not access camera. Gesture detection will not work." << std::endl;
            std::cerr << "Please check camera permissions and connections." << std::endl;
        } else {
            std::cout << "Camera access successful." << std::endl;
        }
        
        // Initialize LCD at startup
        std::cout << "Initializing LCD display..." << std::endl;
        lcd_init();
        
        // Initialize rotary encoder and joystick
        std::cout << "Initializing input controls..." << std::endl;
        rotary_press_statemachine_init();
        joystick_press_init();

        std::cout << "Initializing audio system..." << std::endl;
        AudioMixer_init();
        SoundManager_init();
        
        // Display welcome message
        char* welcomeMsg[] = {"Gesture Tower", "Game", "Ready!"};
        lcd_place_message(welcomeMsg, 3, lcd_center);
        
        bool detectionRunning = false;
        bool inputLocked = false;

        // Start background joystick thread for instant activation
        joystickThread = std::thread([&]() {
            while (true) {
                if (joystick_is_detecting() && !joystickRunning.load()) {
                    joystickRunning = true;  // prevent retriggering

                    std::cout << "\n[JOYSTICK] Press detected — starting gesture detection...\n";

                    if (!detector->isRunning()) {
                        detector->start();
                        detectionRunning = true;
                        std::cout << "[JOYSTICK] Gesture detection started.\n";
                    } else {
                        std::cout << "[JOYSTICK] Already running.\n";
                    }

                    joystick_toggle_detection();  // Reset toggle state
                    std::this_thread::sleep_for(std::chrono::milliseconds(500)); // Debounce
                    joystickRunning = false;
                }

                std::this_thread::sleep_for(std::chrono::milliseconds(100));
            }
        });

        
        std::cout << "=== Beagle Board Gesture Control Client ===" << std::endl;
        std::cout << "Device ID: " << roomManager->getDeviceId() << std::endl;
        displayHelp();
        
        while (true) {
            // Display prompt and get input

            std::cout << "> ";
            std::string line;
            if (!std::getline(std::cin, line)) {
                break;
            }
            
            // Sync the detectionRunning flag with the actual detector state
            // This ensures that if gesture detection was stopped elsewhere (via MessageHandler, etc.),
            // our UI state stays synchronized
            if (detector) {
                bool actualRunning = detector->isRunning();
                if (detectionRunning != actualRunning) {
                    std::cout << "Note: Gesture detection state changed externally. "
                              << "Updating from " << (detectionRunning ? "running" : "stopped") 
                              << " to " << (actualRunning ? "running" : "stopped") << std::endl;
                    detectionRunning = actualRunning;
                }
            }
            
            // Process input
            if (!line.empty()) {
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
                        std::cout << "Usage: setname <n>" << std::endl;
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
                        std::cout << "Please set your player name first using 'setname <n>'" << std::endl;
                    } else {
                        roomManager->joinRoom(roomId);
                        std::cout << "Sending join request for room: " << roomId << std::endl;
                    }
                }
                else if (command == "createroom") {
                    std::string roomName;
                    std::getline(iss >> std::ws, roomName);
                    
                    if (roomName.empty()) {
                        std::cout << "Usage: createroom <n>" << std::endl;
                    } else if (roomManager->getPlayerName().empty()) {
                        std::cout << "Please set your player name first using 'setname <n>'" << std::endl;
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
                // else if (command == "start") {
                //     // Check the actual running state from the detector, not just our local flag
                //     if (!detector->isRunning()) {
                //         if (!roomManager->isConnected()) {
                //             std::cout << "Warning: Not connected to a room. Gestures will not be sent to a game." << std::endl;
                //         }
                        
                //         detector->start();
                //         detectionRunning = true;
                //         std::cout << "Gesture detection started." << std::endl;
                //     } else {
                //         std::cout << "Gesture detection is already running." << std::endl;
                //     }
                // }
                else if (command == "start") {
                    if (!detector->isRunning()) {
                        detector->start();
                        detectionRunning = true;
                        std::cout << "Gesture detection started (via " 
                                  << (command == "start" ? "command" : "joystick") << ")." << std::endl;
                    } else {
                        std::cout << "Gesture detection is already running." << std::endl;
                    }
                }                               
                else if (command == "stop") {
                    // Check the actual running state from the detector, not just our local flag
                    if (detector->isRunning()) {
                        detector->stop();
                        detectionRunning = false;
                        std::cout << "Gesture detection stopped." << std::endl;
                    } else {
                        std::cout << "Gesture detection is already stopped." << std::endl;
                    }
                }
                else if (command == "webcamtest") {
                    detector->runTestingMode();
                }
                // TESTING COMMANDS - TO BE REMOVED IN FINAL VERSION
                else if (command == "starttimer") {
                    int seconds = 30;
                    iss >> seconds;
                    if (seconds <= 0) {
                        seconds = 30;
                    }
                    
                    std::cout << "TESTING: Starting timer with " << seconds << " seconds" << std::endl;
                    
                    if (gameState) {
                        // Start the timer
                        gameState->startTimer(seconds);
                        std::cout << "Timer started" << std::endl;
                    } else {
                        std::cout << "Error: GameState not available" << std::endl;
                    }
                }
                else if (command == "stoptimer") {
                    std::cout << "TESTING: Stopping timer" << std::endl;
                    
                    if (gameState) {
                        // Stop the timer
                        gameState->stopTimer();
                        std::cout << "Timer stopped" << std::endl;
                    } else {
                        std::cout << "Error: GameState not available" << std::endl;
                    }
                }
                else if (command == "displaytimer") {
                    std::cout << "TESTING: Displaying timer information" << std::endl;
                    
                    if (gameState && displayManager) {
                        // Display timer information
                        displayManager->updateCardAndGameDisplay(true);
                        std::cout << "Timer display updated" << std::endl;
                    } else {
                        std::cout << "Error: GameState or DisplayManager not available" << std::endl;
                    }
                }
                else if (command == "exit") {
                    if (detectionRunning) {
                        detector->stop();
                    }
                    
                    std::cout << "Exiting application..." << std::endl;
                    break;
                }
                else {
                    std::cout << "Unknown command: " << command << std::endl;
                    std::cout << "Type 'help' for a list of commands." << std::endl;
                }
            }
        }
        
        // Clean up resources
        if (detector) {
            delete detector;
        }
        
        if (roomManager) {
            delete roomManager;
        }
        
        if (gameState) {
            delete gameState;
        }
        
        if (displayManager) {
            delete displayManager;
        }
        
        if (messageHandler) {
            delete messageHandler;
        }
        
        if (webSocketClient) {
            webSocketClient->disconnect();
            delete webSocketClient;
        }

        SoundManager_cleanup();
        AudioMixer_cleanup();   

        
        // Restore stderr
        std::cerr.rdbuf(stderr_buf);
        
    } catch (const std::exception& e) {
        std::cout << "Error: " << e.what() << std::endl;
        return 1;
    }
    
    joystickThread.detach();  

    return 0;
}
