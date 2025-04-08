#pragma once

#include <string>
#include <thread>
#include <atomic>
#include <mutex>
#include <opencv2/opencv.hpp>
#include <nlohmann/json.hpp>
#include "hand_recognition.hpp"
#include "../hal/camera_hal.h"

// Forward declarations
class RoomManager;
class GestureEventSender;

// For convenience
using json = nlohmann::json;

class GestureDetector {
private:
    std::atomic<bool> runThread;
    std::thread gestureThread;
    RoomManager* roomManager;
    GestureEventSender* eventSender;
    
    // Hand tracking variables
    std::mutex handMutex;
    handPosition currentHand;
    double handTopPosition;
    double handBottomPosition;
    double confidenceThreshold;
    
    // Control flags
    bool gestureEnabled;
    bool processingStarted;
    
    CameraHAL camera;
    
    // Gesture detection loop
    void gestureLoop();
    
    // Gesture recognition function
    bool recognizeGesture(const handPosition& handPos, std::string& detectedMove, std::string& actionType);
    
    // Debug helpers
    void logHandPosition(const handPosition& handPos, bool shouldLog);
    
    // Helper to confirm and send a detected gesture
    void confirmGesture(const std::string& actionType);
    
    // Helper to get current time in milliseconds
    long long getTimeInMs();

public:
    GestureDetector(RoomManager* rm);
    ~GestureDetector();
    
    // Start and stop detection
    void start();
    void stop();
    
    // Check if running
    bool isRunning() const { return runThread.load(); }
    
    // Get current hand position
    handPosition getCurrentHand();
    
    // Test camera access
    bool testCameraAccess();
    
    // Run testing mode with feedback
    void runTestingMode();
}; 