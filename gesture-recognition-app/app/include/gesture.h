#ifndef GESTURE_H
#define GESTURE_H

#include <opencv2/opencv.hpp>
#include <vector>
#include <thread>
#include <atomic>
#include <mutex>
#include "hal/camera_hal.h"
#include "udp_sender.h"

struct GestureResult {
    std::string gesture_name;
};

class GestureDetector {
public:
    GestureDetector();
    ~GestureDetector();
    void startDetection();
    void stopDetection();
    static void detectionLoop(GestureDetector* detector);

private:
    std::atomic<bool> running;
    std::thread detectionThread;
    std::mutex landmark_mutex;
    CameraHAL camera;
};

bool detect_gesture(GestureResult *result, CameraHAL &camera);
std::vector<cv::Point> detect_hand_landmarks(cv::Mat frame);
int recognize_gesture(const std::vector<cv::Point>& landmarks);

#endif
