#include "GestureDetector.h"
#include <iostream>
#include <iomanip>
#include <chrono>
#include <thread>
#include "lcd_display.h"
#include "../hal/rotary_press_statemachine.h"

// Function to get current time in milliseconds (used for gesture detection timing)
static long long getTimeInMs(void) {
    struct timespec spec;
    clock_gettime(CLOCK_REALTIME, &spec);
    long long seconds = spec.tv_sec;
    long long nanoSeconds = spec.tv_nsec;
    long long milliSeconds = seconds * 1000 + nanoSeconds / 1000000;
    return milliSeconds;
}

// GestureDetector implementation
GestureDetector::GestureDetector(RoomManager* rm) : running(false), roomManager(rm), eventSender(nullptr) {
    std::cout << "GestureDetector constructor" << std::endl;
    
    // Create the event sender if we have a valid room manager
    if (roomManager) {
        eventSender = new GestureEventSender(roomManager, 
                                           roomManager->getDeviceId(), 
                                           roomManager->getCurrentRoomId());
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
    if (!running.load()) {
        running.store(true);
        gestureThread = std::thread(&GestureDetector::gestureLoop, this);
    }
}

void GestureDetector::stop() {
    if (running.load()) {
        running.store(false);
        if (gestureThread.joinable()) {
            gestureThread.join();
        }
    }
}

// Log hand position for debugging
void GestureDetector::logHandPosition(const handPosition& handPos, bool shouldLog) {
    if (!shouldLog) return;
    
    std::cout << "Hand detected: " << handPos.num_fingers_held_up << " fingers up" << std::endl;
    std::cout << "Finger states: "; 
    std::cout << "Thumb=" << (handPos.thumb_held_up ? "UP" : "down") << ", ";
    std::cout << "Index=" << (handPos.index_held_up ? "UP" : "down") << ", ";
    std::cout << "Middle=" << (handPos.middle_held_up ? "UP" : "down") << ", ";
    std::cout << "Ring=" << (handPos.ring_held_up ? "UP" : "down") << ", ";
    std::cout << "Pinky=" << (handPos.pinky_held_up ? "UP" : "down") << std::endl;
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
        std::cerr << "Error: Could not open camera." << std::endl;
        return;
    }
    
    std::cout << "GestureDetector started" << std::endl;
    
    // Display initial message
    char* startMsg[] = {"Show a gesture", "to make your move"};
    lcd_place_message(startMsg, 2, lcd_center);
    
    while (running.load()) {
        if (roomManager == nullptr) {
            std::cerr << "Error: Room manager is not initialized." << std::endl;
            break;
        }
        
        // Make sure our event sender has the current room ID
        if (eventSender) {
            eventSender->setCurrentRoomId(roomManager->getCurrentRoomId());
        }
        
        cv::Mat frame;
        if (!camera.captureFrame(frame)) {
            std::cerr << "Error: Could not capture frame." << std::endl;
            continue;
        }
        
        if (frame.empty()) {
            std::cerr << "Error: Blank frame grabbed." << std::endl;
            continue;
        }
        
        handPosition handPos;
        auto status = hand_analyze_image(frame, &handPos);
        
        if (!status.ok()) {
            std::cerr << "Error analyzing hand: " << status.ToString() << std::endl;
            continue;
        }
        
        if (handPos.hand_visible) {
            {
                std::lock_guard<std::mutex> lock(handMutex);
                currentHand = handPos;
            }
            
            std::string detectedMove, actionType;
            if (recognizeGesture(handPos, detectedMove, actionType)) {
                // Log the recognized gesture
                std::cout << "Recognized gesture: " << detectedMove << " (" << actionType << ")" << std::endl;
                
                // Display confirmation message
                char confirmMessage[32];
                snprintf(confirmMessage, sizeof(confirmMessage), "%s detected", detectedMove.c_str());
                
                // Display on LCD
                char* msg[] = {confirmMessage, "Press to confirm"};
                lcd_place_message(msg, 2, lcd_center);
                
                // Get initial rotary encoder value
                int initialValue = rotary_press_statemachine_getValue();
                long long confirmationStartTime = getTimeInMs();
                bool gestureConfirmed = false;
                
                // Wait for confirmation or timeout (5 seconds)
                const int CONFIRMATION_TIMEOUT_MS = 5000; // 5 seconds
                
                while (running.load() && (getTimeInMs() - confirmationStartTime < CONFIRMATION_TIMEOUT_MS)) {
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
                    // Display sending message
                    char* sendingMsg[] = {"Sending gesture", "to server..."};
                    lcd_place_message(sendingMsg, 2, lcd_center);
                    
                    // Send the gesture
                    if (eventSender) {
                        eventSender->sendGesture(actionType, 0.95f);
                    } else {
                        // Fallback to direct room manager call
                        json gestureData = json::object();
                        gestureData["gesture"] = actionType;
                        gestureData["confidence"] = 0.95f;
                        roomManager->sendGestureData(gestureData.dump());
                    }
                    
                    // Display confirmation of sending
                    std::this_thread::sleep_for(std::chrono::milliseconds(1000));
                    char* sentMsg[] = {"Gesture sent", "Waiting for next round"};
                    lcd_place_message(sentMsg, 2, lcd_center);
                    
                    // Stop gesture detection after successful confirmation
                    std::cout << "Gesture confirmed and sent. Stopping detection." << std::endl;
                    running.store(false);
                    break;
                } else {
                    // Timed out without confirmation
                    char* timeoutMsg[] = {"Confirmation", "timed out"};
                    lcd_place_message(timeoutMsg, 2, lcd_center);
                    
                    // Short delay to show timeout message
                    std::this_thread::sleep_for(std::chrono::milliseconds(1500));
                    
                    // Reset to initial message
                    char* resetMsg[] = {"Show a gesture", "to make your move"};
                    lcd_place_message(resetMsg, 2, lcd_center);
                }
            }
        }
        
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }
    
    camera.closeCamera();
    std::cout << "GestureDetector stopped" << std::endl;
}

handPosition GestureDetector::getCurrentHand() {
    std::lock_guard<std::mutex> lock(handMutex);
    return currentHand;
}

void GestureDetector::runTestingMode() {
    std::cout << "Running camera test mode. Press any key to exit." << std::endl;
    
    // Just test the camera with simple feedback
    CameraHAL testCamera;
    if (!testCamera.openCamera()) {
        std::cerr << "Error: Could not open camera for testing" << std::endl;
        return;
    }
    
    // Show info on LCD
    char* testMsg[] = {"Camera Test Mode", "Running..."};
    lcd_place_message(testMsg, 2, lcd_center);
    
    bool firstCapture = true;
    int frames = 0;
    auto startTime = std::chrono::steady_clock::now();
    int gesturesDetected = 0;
    
    while (true) {
        cv::Mat frame;
        
        if (!testCamera.captureFrame(frame)) {
            std::cerr << "Error: Could not capture frame" << std::endl;
            break;
        }
        
        // If this is our first frame, show success message
        if (firstCapture) {
            std::cout << "Camera working! First frame captured successfully." << std::endl;
            std::cout << "Frame size: " << frame.cols << "x" << frame.rows << std::endl;
            firstCapture = false;
            
            char* successMsg[] = {"Camera working!", "Detecting gestures..."};
            lcd_place_message(successMsg, 2, lcd_center);
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
                
                // Display the recognized gesture
                std::cout << "Detected: " << detectedMove << " gesture" << std::endl;
                char gestureMsg[32];
                snprintf(gestureMsg, sizeof(gestureMsg), "Detected: %s", detectedMove.c_str());
                
                char countMsg[32];
                snprintf(countMsg, sizeof(countMsg), "Count: %d", gesturesDetected);
                
                char* displayMsg[] = {gestureMsg, countMsg};
                lcd_place_message(displayMsg, 2, lcd_center);
                
                // Pause briefly to show the gesture
                std::this_thread::sleep_for(std::chrono::milliseconds(500));
            }
            
            // Log hand position details
            logHandPosition(handPos, true);
        }
        
        // Check how long we've been running
        auto now = std::chrono::steady_clock::now();
        auto elapsed = std::chrono::duration_cast<std::chrono::seconds>(now - startTime).count();
        
        // Every 5 seconds, display frame rate if no gestures detected recently
        if (elapsed >= 5) {
            double fps = static_cast<double>(frames) / elapsed;
            std::cout << "Frames captured: " << frames << " (" << std::fixed << std::setprecision(1) << fps << " FPS)" << std::endl;
            
            char fpsMsg[32];
            snprintf(fpsMsg, sizeof(fpsMsg), "%.1f FPS", fps);
            char statsMsg[32];
            snprintf(statsMsg, sizeof(statsMsg), "Gestures: %d", gesturesDetected);
            
            char* successMsg[] = {fpsMsg, statsMsg};
            lcd_place_message(successMsg, 2, lcd_center);
            
            // Reset counters
            frames = 0;
            startTime = now;
        }
        
        // Check for button press to exit
        int currentValue = rotary_press_statemachine_getValue();
        static int previousValue = currentValue;
        if (currentValue != previousValue) {
            std::cout << "Button pressed, exiting camera test" << std::endl;
            previousValue = currentValue;
            break;
        }
        
        // Small delay to prevent consuming too much CPU
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
    }
    
    testCamera.closeCamera();
    
    // Show exit message
    char* exitMsg[] = {"Camera test", "complete"};
    lcd_place_message(exitMsg, 2, lcd_center);
} 