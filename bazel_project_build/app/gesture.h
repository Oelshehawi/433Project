#ifndef GESTURE_H
#define GESTURE_H

#include "RoomManager.h"
#include "../hal/camera_hal.h"
#include <thread>
#include <atomic>
#include <string>

// Define gesture result structure
struct GestureResult {
    const char* gesture_name;
    float confidence;
};

class GestureDetector {
private:
    std::thread detectionThread;
    std::atomic<bool> running;
    RoomManager* roomManager;
    CameraHAL camera;

    // Helper function for the detection thread
    static void detectionLoop(GestureDetector* detector);

public:
    GestureDetector();
    ~GestureDetector();

    // Start gesture detection in a separate thread
    void startDetection();

    // Stop gesture detection
    void stopDetection();

    // Set room manager
    void setRoomManager(RoomManager* manager) { roomManager = manager; }

    // Test if the camera is accessible
    bool testCameraAccess();

    // Run webcam in testing mode (shows camera preview)
    void runTestingMode();
};

// Function to detect gesture
bool detect_gesture(GestureResult* result, CameraHAL& camera);

#endif // GESTURE_H
