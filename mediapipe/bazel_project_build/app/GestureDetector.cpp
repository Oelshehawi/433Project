#include "GestureDetector.h"
#include "RoomManager.h"
#include "GestureEventSender.h"
#include "GameState.h"
#include "DisplayManager.h"
#include "SoundManager.h"
#include <iostream>
#include <unistd.h>
#include <cmath>
#include <algorithm>
#include <map>
#include <chrono>
#include <thread>
#include "lcd_display.h"
#include "../hal/rotary_press_statemachine.h"

// Get current time in milliseconds
long long GestureDetector::getTimeInMs() {
    auto now = std::chrono::system_clock::now();
    auto duration = now.time_since_epoch();
    return std::chrono::duration_cast<std::chrono::milliseconds>(duration).count();
}

// GestureDetector implementation
GestureDetector::GestureDetector(RoomManager* roomManager)
    : roomManager(roomManager), 
      runThread(false), 
      handTopPosition(0.0),
      handBottomPosition(0.0),
      confidenceThreshold(0.65),
      gestureEnabled(true),
      processingStarted(false) {
    
    // Create the gesture event sender if we have a client
    if (roomManager && roomManager->getClient()) {
        eventSender = new GestureEventSender(roomManager->getClient());
    } else {
        eventSender = nullptr;
    }
}

GestureDetector::~GestureDetector() {
    try {
        std::cout << "[GestureDetector.cpp] Destructor called, cleaning up resources" << std::endl;
        
        // First set the run flag to false to tell the thread to exit
        runThread.store(false);
        
        // Then join the thread if it's joinable
        if (gestureThread.joinable()) {
            std::cout << "[GestureDetector.cpp] Waiting for gesture thread to join in destructor..." << std::endl;
            gestureThread.join();
            std::cout << "[GestureDetector.cpp] Gesture thread successfully joined in destructor" << std::endl;
        }
        
        // Clean up the event sender
        if (eventSender) {
            delete eventSender;
            eventSender = nullptr;
        }
        
        std::cout << "[GestureDetector.cpp] Destructor completed successfully" << std::endl;
    } catch (const std::exception& e) {
        std::cerr << "[GestureDetector.cpp] Exception in destructor: " << e.what() << std::endl;
    } catch (...) {
        std::cerr << "[GestureDetector.cpp] Unknown exception in destructor" << std::endl;
    }
}

bool GestureDetector::testCameraAccess() {
    CameraHAL testCamera;
    bool success = testCamera.openCamera();
    if (success) {
        cv::Mat frame;
        success = testCamera.captureFrame(frame);
        testCamera.closeCamera();
    }
    return success;
}

void GestureDetector::start() {
    // Make sure we're in a clean state before starting
    // If thread is still joinable but runThread is false, we need to clean up first
    if (gestureThread.joinable()) {
        std::cout << "[GestureDetector.cpp] Thread is still joinable, cleaning up before starting new thread" << std::endl;
        try {
            // Force wait for thread to exit if it's still running
            if (gestureThread.joinable()) {
                gestureThread.join();
            }
        } catch (const std::exception& e) {
            std::cerr << "[GestureDetector.cpp] Exception while joining thread: " << e.what() << std::endl;
        }
    }
    
    // Now we can safely start a new thread
    if (!runThread.load()) {
        std::cout << "[GestureDetector.cpp] Starting gesture detection thread" << std::endl;
        runThread.store(true);
        
        try {
            gestureThread = std::thread(&GestureDetector::gestureLoop, this);
            std::cout << "[GestureDetector.cpp] Gesture detection thread started successfully" << std::endl;
        } catch (const std::exception& e) {
            // If thread creation fails, make sure we set runThread back to false
            runThread.store(false);
            std::cerr << "[GestureDetector.cpp] Failed to start gesture thread: " << e.what() << std::endl;
        }
    } else {
        std::cout << "[GestureDetector.cpp] Gesture detection is already running." << std::endl;
    }
}

void GestureDetector::stop() {
    std::cout << "[GestureDetector.cpp] Stopping gesture detection. Current state: " << (runThread.load() ? "running" : "not running") << std::endl;
    
    if (runThread.load()) {
        runThread.store(false);
        if (gestureThread.joinable()) {
            std::cout << "[GestureDetector.cpp] Waiting for gesture thread to join..." << std::endl;
            gestureThread.join();
            std::cout << "[GestureDetector.cpp] Gesture thread successfully joined" << std::endl;
        } else {
            std::cout << "[GestureDetector.cpp] Gesture thread is not joinable" << std::endl;
        }
    } else {
        std::cout << "[GestureDetector.cpp] Gesture detection was already stopped" << std::endl;
    }
    
    // Force set runThread to false to ensure clean state
    runThread.store(false);
}

// Log hand position for debugging
void GestureDetector::logHandPosition(const handPosition& handPos, bool shouldLog) {
    if (!shouldLog) return;
}

// Recognize gesture from hand position
bool GestureDetector::recognizeGesture(const handPosition& handPos, std::string& detectedMove, std::string& actionType) {
    // Attack: 1 finger (index only)
    if (handPos.num_fingers_held_up == 1 && handPos.index_held_up && 
        !handPos.thumb_held_up && !handPos.middle_held_up && !handPos.ring_held_up && !handPos.pinky_held_up) {
        detectedMove = "Attack";
        actionType = "attack";
        SoundManager_playAttack();
        std::cout << "[GestureDetector.cpp] Detected gesture: Attack" << std::endl;
        
        // Display confirmation message if we have a display manager
        if (roomManager && roomManager->gameState) {
            DisplayManager* dm = roomManager->gameState->getDisplayManager();
            if (dm) {
                dm->displayMessage(
                    "ATTACK DETECTED",
                    "Press button to confirm"
                );
            }
        }
        return true;
    } 
    // Defend: All 5 fingers up
    else if (handPos.num_fingers_held_up >= 4 && handPos.thumb_held_up && handPos.index_held_up && 
             handPos.middle_held_up && handPos.ring_held_up && handPos.pinky_held_up) {
        detectedMove = "Defend";
        actionType = "defend";
        SoundManager_playShield();
        std::cout << "[GestureDetector.cpp] Detected gesture: Defend" << std::endl;
        
        // Display confirmation message if we have a display manager
        if (roomManager && roomManager->gameState) {
            DisplayManager* dm = roomManager->gameState->getDisplayManager();
            if (dm) {
                dm->displayMessage(
                    "DEFEND DETECTED",
                    "Press button to confirm"
                );
            }
        }
        return true;
    } 
    // Build: 2 fingers (index and middle)
    else if (handPos.num_fingers_held_up == 2 && handPos.index_held_up && handPos.middle_held_up && 
             !handPos.thumb_held_up && !handPos.ring_held_up && !handPos.pinky_held_up) {
        detectedMove = "Build";
        actionType = "build";
        SoundManager_playBuild();
        std::cout << "[GestureDetector.cpp] Detected gesture: Build" << std::endl;
        
        // Display confirmation message if we have a display manager
        if (roomManager && roomManager->gameState) {
            DisplayManager* dm = roomManager->gameState->getDisplayManager();
            if (dm) {
                dm->displayMessage(
                    "BUILD DETECTED",
                    "Press button to confirm"
                );
            }
        }
        return true;
    }
    
    return false;
}

void GestureDetector::gestureLoop() {
    // Use try-catch to ensure camera is closed properly even if exceptions occur
    try {
        if (!camera.openCamera()) {
            std::cout << "[GestureDetector.cpp] Failed to open camera" << std::endl;
            return;
        }
        
        std::cout << "[GestureDetector.cpp] Gesture detection loop started" << std::endl;
        
        while (runThread.load()) {
            if (roomManager == nullptr) {
                std::cout << "[GestureDetector.cpp] Room manager is null, exiting gesture loop" << std::endl;
                break;
            }
            
            cv::Mat frame;
            if (!camera.captureFrame(frame)) {
                std::this_thread::sleep_for(std::chrono::milliseconds(10));
                continue;
            }
            
            if (frame.empty()) {
                std::this_thread::sleep_for(std::chrono::milliseconds(10));
                continue;
            }
            
            handPosition handPos;
            auto status = hand_analyze_image(frame, &handPos);
            
            if (!status.ok()) {
                std::this_thread::sleep_for(std::chrono::milliseconds(10));
                continue;
            }
            
            if (handPos.hand_visible) {
                {
                    std::lock_guard<std::mutex> lock(handMutex);
                    currentHand = handPos;
                }
                
                // Debug output for hand position
                if (handPos.num_fingers_held_up > 0) {
                    std::cout << "[GestureDetector.cpp] Fingers up: " << handPos.num_fingers_held_up 
                            << " (I:" << handPos.index_held_up
                            << " M:" << handPos.middle_held_up
                            << " R:" << handPos.ring_held_up
                            << " P:" << handPos.pinky_held_up
                            << " T:" << handPos.thumb_held_up << ")" << std::endl;
                }
                
                std::string detectedMove, actionType;
                if (recognizeGesture(handPos, detectedMove, actionType)) {
                    // Get initial rotary encoder value
                    int initialValue = rotary_press_statemachine_getValue();
                    long long confirmationStartTime = getTimeInMs();
                    bool gestureConfirmed = false;
                    
                    // Wait for confirmation or timeout (5 seconds)
                    const int CONFIRMATION_TIMEOUT_MS = 5000; // 5 seconds
                    
                    std::cout << "[GestureDetector.cpp] Waiting for gesture confirmation... (press button)" << std::endl;
                    
                    // After initializing wait period, update display with time remaining info
                    if (roomManager && roomManager->gameState) {
                        DisplayManager* dm = roomManager->gameState->getDisplayManager();
                        if (dm) {
                            dm->displayMessage(
                                detectedMove + " DETECTED",
                                "Press button to confirm"
                            );
                        }
                    }
                    
                    while (runThread.load() && (getTimeInMs() - confirmationStartTime < CONFIRMATION_TIMEOUT_MS)) {
                        // Check if button was pressed
                        int currentValue = rotary_press_statemachine_getValue();
                        if (currentValue != initialValue) {
                            gestureConfirmed = true;
                            std::cout << "[GestureDetector.cpp] Gesture confirmed with button press" << std::endl;
                            break;
                        }
                        
                        // Update countdown display every second
                        static long long lastUpdateTime = 0;
                        long long currentTime = getTimeInMs();
                        int remainingSeconds = (CONFIRMATION_TIMEOUT_MS - (currentTime - confirmationStartTime)) / 1000;
                        
                        if (currentTime - lastUpdateTime > 1000 && roomManager && roomManager->gameState) {
                            DisplayManager* dm = roomManager->gameState->getDisplayManager();
                            if (dm) {
                                char countdownMessage[32];
                                snprintf(countdownMessage, sizeof(countdownMessage), "Confirm (%d sec left)", remainingSeconds + 1);
                                dm->displayMessage(
                                    detectedMove + " DETECTED",
                                    countdownMessage
                                );
                                lastUpdateTime = currentTime;
                            }
                        }
                        
                        // Small delay to prevent high CPU usage
                        std::this_thread::sleep_for(std::chrono::milliseconds(50));
                    }
                    
                    // If confirmed or timed out
                    if (gestureConfirmed) {
                        // Send the gesture
                        std::cout << "[GestureDetector.cpp] Sending confirmed gesture: " << detectedMove << std::endl;
                        confirmGesture(actionType);
                        
                        // After successful confirmation and sending, stop the gesture detection
                        // until it's restarted for the next round
                        std::cout << "[GestureDetector.cpp] Gesture confirmed and sent. Stopping detection until next round." << std::endl;
                        runThread.store(false); // Properly set runThread to false before breaking
                        break; // Exit the main loop to stop detection
                    } else {
                        std::cout << "[GestureDetector.cpp] Gesture confirmation timed out" << std::endl;
                        // Short delay to show timeout message
                        std::this_thread::sleep_for(std::chrono::milliseconds(1500));
                    }
                }
            }
            
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
        }
    }
    catch (const std::exception& e) {
        std::cerr << "[GestureDetector.cpp] Exception in gesture loop: " << e.what() << std::endl;
    }
    catch (...) {
        std::cerr << "[GestureDetector.cpp] Unknown exception in gesture loop" << std::endl;
    }
    
    // Always make sure the camera is closed when we exit the loop
    try {
        std::cout << "[GestureDetector.cpp] Gesture detection loop ended, closing camera" << std::endl;
        camera.closeCamera();
    }
    catch (const std::exception& e) {
        std::cerr << "[GestureDetector.cpp] Exception closing camera: " << e.what() << std::endl;
    }
}

handPosition GestureDetector::getCurrentHand() {
    std::lock_guard<std::mutex> lock(handMutex);
    return currentHand;
}

void GestureDetector::runTestingMode() {
    // Just test the camera with simple feedback
    CameraHAL testCamera;
    if (!testCamera.openCamera()) {
        return;
    }
    
    bool firstCapture = true;
    int frames = 0;
    auto startTime = std::chrono::steady_clock::now();
    int gesturesDetected = 0;
    
    while (true) {
        cv::Mat frame;
        
        if (!testCamera.captureFrame(frame)) {
            break;
        }
        
        // If this is our first frame, show success message
        if (firstCapture) {
            firstCapture = false;
        }
        
        frames++;
        
        // Analyze hand position in the image
        handPosition handPos;
        auto status = hand_analyze_image(frame, &handPos);
        
        if (status.ok() && handPos.hand_visible) {
            // Try to recognize a gesture
            std::string detectedMove, actionType;
            if (recognizeGesture(handPos, detectedMove, actionType)) {
                gesturesDetected++;
            }
        }
        
        // Check how long we've been running
        auto now = std::chrono::steady_clock::now();
        auto elapsed = std::chrono::duration_cast<std::chrono::seconds>(now - startTime).count();
        
        // Every 5 seconds, display frame rate if no gestures detected recently
        if (elapsed >= 5) {
            double fps = static_cast<double>(frames) / elapsed;
            
            // Reset counters
            frames = 0;
            startTime = now;
        }
        
        // Check for button press to exit
        int currentValue = rotary_press_statemachine_getValue();
        static int previousValue = currentValue;
        if (currentValue != previousValue) {
            break;
        }
        
        // Small delay to prevent consuming too much CPU
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
    }
    
    testCamera.closeCamera();
}

void GestureDetector::confirmGesture(const std::string& actionType) {
    // FIRST PRIORITY: Stop the timer immediately when rotary encoder is pressed
    if (roomManager && roomManager->gameState) {
        // Stopping the timer is now a single call that handles everything
        roomManager->gameState->stopTimer();
        
        // Optionally force the timer to zero if needed for display purposes
        // roomManager->gameState->setCurrentTurnTimeRemaining(0);
    }
    
    // Try to send the gesture via the event sender
    bool sent = false;
    if (eventSender && roomManager) {
        sent = eventSender->sendGestureEvent(
            roomManager->getCurrentRoomId(),
            roomManager->getDeviceId(),
            actionType,
            0.95f
        );
    }
    
    // Fallback to the room manager if sending via event sender failed
    if (!sent && roomManager) {
        // Create an event sender if it doesn't exist
        if (!eventSender && roomManager->getClient()) {
            eventSender = new GestureEventSender(roomManager->getClient());
        }
        
        // Try again with the newly created event sender
        if (eventSender) {
            eventSender->sendGestureEvent(
                roomManager->getCurrentRoomId(),
                roomManager->getDeviceId(),
                actionType,
                0.95f
            );
            // Ensure message processing
            if (roomManager->getClient()) {
                roomManager->getClient()->ensureMessageProcessing();
            }
        }
    }
    
    // Mark the thread as not running but don't call stop() to avoid deadlock
    // This is now handled in the gestureLoop with runThread.store(false)
    std::cout << "[GestureDetector.cpp] Gesture confirmed, runThread will be set to false" << std::endl;
} 