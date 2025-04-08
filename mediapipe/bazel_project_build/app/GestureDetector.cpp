#include "GestureDetector.h"
#include "RoomManager.h"
#include "GestureEventSender.h"
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
    stop();
    
    // Clean up the event sender
    if (eventSender) {
        delete eventSender;
        eventSender = nullptr;
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
    if (!runThread.load()) {
        runThread.store(true);
        gestureThread = std::thread(&GestureDetector::gestureLoop, this);
    }
}

void GestureDetector::stop() {
    if (runThread.load()) {
        runThread.store(false);
        if (gestureThread.joinable()) {
            gestureThread.join();
        }
    }
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
        return true;
    } 
    // Defend: All 5 fingers up
    else if (handPos.num_fingers_held_up >= 4 && handPos.thumb_held_up && handPos.index_held_up && 
             handPos.middle_held_up && handPos.ring_held_up && handPos.pinky_held_up) {
        detectedMove = "Defend";
        actionType = "defend";
        return true;
    } 
    // Build: 2 fingers (index and middle)
    else if (handPos.num_fingers_held_up == 2 && handPos.index_held_up && handPos.middle_held_up && 
             !handPos.thumb_held_up && !handPos.ring_held_up && !handPos.pinky_held_up) {
        detectedMove = "Build";
        actionType = "build";
        return true;
    }
    
    return false;
}

void GestureDetector::gestureLoop() {
    if (!camera.openCamera()) {
        return;
    }
    
    while (runThread.load()) {
        if (roomManager == nullptr) {
            return;
        }
        
        cv::Mat frame;
        if (!camera.captureFrame(frame)) {
            continue;
        }
        
        if (frame.empty()) {
            continue;
        }
        
        handPosition handPos;
        auto status = hand_analyze_image(frame, &handPos);
        
        if (!status.ok()) {
            continue;
        }
        
        if (handPos.hand_visible) {
            {
                std::lock_guard<std::mutex> lock(handMutex);
                currentHand = handPos;
            }
            
            std::string detectedMove, actionType;
            if (recognizeGesture(handPos, detectedMove, actionType)) {
                // Get initial rotary encoder value
                int initialValue = rotary_press_statemachine_getValue();
                long long confirmationStartTime = getTimeInMs();
                bool gestureConfirmed = false;
                
                // Wait for confirmation or timeout (5 seconds)
                const int CONFIRMATION_TIMEOUT_MS = 5000; // 5 seconds
                
                while (runThread.load() && (getTimeInMs() - confirmationStartTime < CONFIRMATION_TIMEOUT_MS)) {
                    // Check if button was pressed
                    int currentValue = rotary_press_statemachine_getValue();
                    if (currentValue != initialValue) {
                        gestureConfirmed = true;
                        break;
                    }
                    
                    // Small delay to prevent high CPU usage
                    std::this_thread::sleep_for(std::chrono::milliseconds(50));
                }
                
                // If confirmed or timed out
                if (gestureConfirmed) {
                    // Send the gesture
                    confirmGesture(actionType);
                } else {
                    // Short delay to show timeout message
                    std::this_thread::sleep_for(std::chrono::milliseconds(1500));
                }
            }
        }
        
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }
    
    camera.closeCamera();
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
    // Try to send the gesture via the event sender first
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
} 