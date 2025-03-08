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

    return true;
}

// GestureDetector class implementation
GestureDetector::GestureDetector() : running(false), camera("/dev/video3") {}

GestureDetector::~GestureDetector() {
    stopDetection();
}

// Start detection in a separate thread
void GestureDetector::startDetection() {
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
    UDPSender sender("192.168.7.2", 12345);

    // Attempt to open the camera
    if (!detector->camera.openCamera()) {
        std::cerr << "Error: Could not open camera on /dev/video3" << std::endl;
        sender.sendMessage("Error: Could not open camera!");
        return;
    }

    while (detector->running) {
        GestureResult result;

        // Capture frame and verify
        cv::Mat frame;
        if (!detector->camera.captureFrame(frame)) {
            sender.sendMessage("Camera frame capture failed!");
            std::cerr << "Error: Could not capture frame" << std::endl;
            continue;
        }
        sender.sendMessage("Camera frame captured successfully!");

        // Attempt to detect a gesture
        if (detect_gesture(&result, detector->camera)) {
            std::cout << "Detected Gesture: " << result.gesture_name << std::endl;
            sender.sendMessage("Detected Gesture: " + result.gesture_name);
        } else {
            sender.sendMessage("No gesture detected.");
        }

        std::this_thread::sleep_for(std::chrono::milliseconds(500));
    }

    detector->camera.closeCamera();
    sender.sendMessage("Camera closed.");
}
