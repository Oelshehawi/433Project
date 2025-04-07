#ifndef GESTURE_H
#define GESTURE_H

#include "RoomManager.h"

#include "../hal/camera_hal.h"
#include <thread>
#include <atomic>
#include <string>
#include <vector>

// Define gesture result structure
struct GestureResult {
    const char* gesture_name;
    float confidence;
};

// Forward declaration
class RoomManager;

// Detect gesture function prototype
bool detect_gesture(GestureResult* result, CameraHAL& camera);

// Helper function to display cards on LCD
void displayCardsOnLCD(const std::vector<Card>& cards);

class GestureDetector {
private:
    std::thread detectionThread;
    std::atomic<bool> running;
    RoomManager* roomManager;
    CameraHAL camera;

    // Member detection loop function
    void detectionLoop();

public:
    GestureDetector();
    ~GestureDetector();

    // Set room manager
    void setRoomManager(RoomManager* rm);

    // Start gesture detection in a separate thread
    void startDetection();

    // Stop gesture detection
    void stopDetection();

    // Test if the camera is accessible
    bool testCameraAccess();

    // Run webcam in testing mode
    void runTestingMode();
};

#endif // GESTURE_H
