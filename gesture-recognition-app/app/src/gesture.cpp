#include "gesture.h"
#include "udp_sender.h"
#include <opencv2/opencv.hpp>
#include <opencv2/imgproc.hpp>
#include <opencv2/highgui.hpp>
#include <iostream>
#include <fstream>
#include <mutex>
#include <chrono>
#include <thread>
#include <random>
#include <map>
#include <unistd.h>
#include <cstring>

using namespace cv;

// Define simple gestures
const char *GESTURES[] = {
    "Thumbs Up", 
    "Thumbs Down", 
    "Wave"
};

// Function to detect landmarks 
std::vector<cv::Point> detect_hand_landmarks(cv::Mat frame) {
    std::vector<cv::Point> landmarks;
    
    
    if (frame.empty()) {
        std::cerr << "Error: Empty frame received!" << std::endl;
        return landmarks;
    }

    landmarks.push_back(cv::Point(100, 200));  // Dummy point
    landmarks.push_back(cv::Point(150, 250));  
    landmarks.push_back(cv::Point(200, 300)); 

    return landmarks;
}

// Recognize gesture from landmarks
int recognize_gesture(const std::vector<cv::Point>& landmarks) {
    if (landmarks.size() < 3) return -1; // Ensure at least 3 points

    // Placeholder logic to recognize 3 simple gestures - change later for new gestures
    if (landmarks[0].y < landmarks[1].y && landmarks[0].y < landmarks[2].y) return 0; // Thumbs Up
    if (landmarks[0].y > landmarks[1].y && landmarks[0].y > landmarks[2].y) return 1; // Thumbs Down
    if (landmarks[0].x < landmarks[1].x && landmarks[1].x < landmarks[2].x) return 2; // Wave

    return -1;
}

// Generate random confidence between 0.7 and 1.0
float generateConfidence() {
    static std::random_device rd;
    static std::mt19937 gen(rd());
    static std::uniform_real_distribution<float> dis(0.7f, 1.0f);
    return dis(gen);
}

// Detect gesture function
bool detect_gesture(GestureResult *result, CameraHAL &camera) {
    cv::Mat frame;

    if (!camera.captureFrame(frame)) {
        std::cerr << "Error: Could not capture frame" << std::endl;
        return false;
    }

    std::vector<cv::Point> landmarks = detect_hand_landmarks(frame);
    if (landmarks.empty()) {
        return false;
    }

    int detected_index = recognize_gesture(landmarks);
    if (detected_index == -1) {
        return false;
    }

    result->gesture_name = GESTURES[detected_index];
    result->confidence = generateConfidence();

    return true;
}

// GestureDetector class implementation
GestureDetector::GestureDetector() : running(false), camera("/dev/video3"), roomManager(nullptr) {}

GestureDetector::~GestureDetector() {
    stopDetection();
}

// Set the room manager
void GestureDetector::setRoomManager(RoomManager* manager) {
    roomManager = manager;
}

// Start detection in a separate thread
void GestureDetector::startDetection() {
    if (!roomManager) {
        std::cerr << "Error: Room manager not set. Call setRoomManager() before starting detection." << std::endl;
        return;
    }
    
    running = true;
    detectionThread = std::thread(detectionLoop, this);
}

// Stop detection
void GestureDetector::stopDetection() {
    running = false;
    if (detectionThread.joinable()) detectionThread.join();
}

// Detection loop
void GestureDetector::detectionLoop(GestureDetector* detector) {
    if (!detector->roomManager) {
        std::cerr << "Error: Room manager not set. Cannot start detection." << std::endl;
        return;
    }
    
    // Get a reference to room manager for easier access
    RoomManager& roomManager = *(detector->roomManager);
    
    std::cout << "Gesture detector started with Device ID: " << roomManager.getDeviceId() << std::endl;
    
    // Send a hello message to announce this device
    roomManager.sendHello();
    
    // Attempt to open the camera
    if (!detector->camera.openCamera()) {
        std::cerr << "Error: Could not open camera on /dev/video3" << std::endl;
        return;
    }
    
    // Request available rooms from server
    roomManager.requestRoomList();
    
    // Wait a moment for server to respond (in a real implementation, we'd listen for response)
    std::this_thread::sleep_for(std::chrono::seconds(2));
    
    // Set a default player name if not already set
    if (roomManager.getPlayerName().empty()) {
        roomManager.setPlayerName("Player1");
    }
    
    // Join a room (in a real implementation, we'd parse the server response and let user choose)
    roomManager.joinRoom("room1");

    while (detector->running) {
        GestureResult result;

        // Capture frame and verify
        cv::Mat frame;
        if (!detector->camera.captureFrame(frame)) {
            std::cerr << "Error: Could not capture frame" << std::endl;
            continue;
        }

        // Attempt to detect a gesture
        if (detect_gesture(&result, detector->camera)) {
            std::cout << "Detected Gesture: " << result.gesture_name 
                      << " (confidence: " << result.confidence << ")" << std::endl;
            
            // Send the gesture to the server via the room manager
            roomManager.sendGestureDetection(result.gesture_name, result.confidence);
        }

        std::this_thread::sleep_for(std::chrono::milliseconds(500));
    }
    
    // When stopping, leave the room if we're in one
    if (roomManager.isConnected()) {
        roomManager.leaveRoom();
    }

    detector->camera.closeCamera();
}
