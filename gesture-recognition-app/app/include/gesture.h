#ifndef GESTURE_H
#define GESTURE_H

#include <opencv2/opencv.hpp>
#include <vector>
#include <thread>
#include <atomic>
#include <mutex>
#include "hal/camera_hal.h"
#include "udp_sender.h"
#include "room_manager.h"

struct GestureResult {
    std::string gesture_name;
    float confidence;
};

class GestureDetector {
public:
    GestureDetector();
    ~GestureDetector();
    
    void startDetection();
    void stopDetection();
    void runTestingMode();
    
    // Set the room manager to use for sending gestures with room information
    void setRoomManager(RoomManager* manager);
    
    static void detectionLoop(GestureDetector* detector);

private:
    std::atomic<bool> running;
    std::thread detectionThread;
    std::mutex landmark_mutex;
    CameraHAL camera;
    RoomManager* roomManager;  // Pointer to the room manager
};

bool detect_gesture(GestureResult *result, CameraHAL &camera);
std::vector<cv::Point> detect_hand_landmarks(cv::Mat frame);
int recognize_gesture(const std::vector<cv::Point>& landmarks);

#endif
