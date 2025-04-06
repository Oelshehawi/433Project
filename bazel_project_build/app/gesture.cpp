#include "gesture.h"
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
#include <time.h>
#include "hand_recognition.hpp"
#include "../hal/rotary_press_statemachine.h"
#include "lcd_display.h"
#include <sys/stat.h>

using namespace cv;
#define WAIT_TIME 3000
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
GestureDetector::GestureDetector() : running(false), roomManager(nullptr), camera("/dev/video3") {}

GestureDetector::~GestureDetector() {
    stopDetection();
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

// Test if the camera is accessible
bool GestureDetector::testCameraAccess() {
    if (camera.openCamera()) {
        // Successfully opened camera, close it again
        cv::Mat testFrame;
        bool frameSuccess = camera.captureFrame(testFrame);
        camera.closeCamera();
        return frameSuccess;
    }
    return false;
}
static long long getTimeInMs(void)
{
    long long MS_PER_SEC = 1000;
    long long NS_PER_MS = 1000000;
    struct timespec spec;
    clock_gettime(CLOCK_REALTIME, &spec);
    long long seconds = spec.tv_sec;
    long long nanoSeconds = spec.tv_nsec;
    long long milliSeconds = seconds * MS_PER_SEC
    + nanoSeconds / NS_PER_MS;
    return milliSeconds;
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
    
    // Attempt to open the camera
    if (!detector->camera.openCamera()) {
        std::cerr << "Error: Could not open camera on /dev/video3" << std::endl;
        return;
    }
    
    // Set a default player name if not already set
    if (roomManager.getPlayerName().empty()) {
        roomManager.setPlayerName("Player1");
    }
    
    // Don't join a room here, let the main thread handle room management
    //Testing for LCD, remove this when done
    lcd_init();
    char* test[] = {"test1", "test2"};
    std::cout << "Testing LCD" << std::endl;
    lcd_place_message(test, 2, lcd_center);
    rotary_press_statemachine_init();
    lcd_cleanup();
    rotary_press_statemachine_init();
    while (detector->running) {
        GestureResult result;

        // Capture frame and verify
        cv::Mat frame;
        std::cout << "Taking image..." << std::endl;
        if (!detector->camera.captureFrame(frame)) {
            std::cerr << "Error: Could not capture frame" << std::endl;
            continue;
        }
        cv::imwrite("reference.jpg", frame);
        int start_value = rotary_press_statemachine_getValue();
        // Attempt to detect a gesture
        if (detect_gesture(&result, detector->camera)) {
            std::cout << "Detected Gesture: " << result.gesture_name 
                      << " (confidence: " << result.confidence << ")" << std::endl;
            
            // Send the gesture to the server via the room manager - use sendGestureData instead
            std::string gestureData = "Gesture:" + std::string(result.gesture_name) + 
                                   "|Confidence:" + std::to_string(result.confidence);
                                   
            handPosition ret;
            hand_analyze_image(frame,&ret);
            if (ret.hand_visible == false){
                std::cout << "HAND NOT VISIBLE" << std::endl;
            }else{
                std::cout << "CURRENT HAND POSITION" << std::endl;
                std::cout << "NUM FINGERS RAISED : "<< ret.num_fingers_held_up << std::endl;
                std::cout << "THUMB" << ((ret.thumb_raised == true) ? " RAISED" : " NOT RAISED") << std::endl;
                std::cout << "INDEX" << ((ret.index_raised == true) ? " RAISED" : " NOT RAISED") << std::endl;
                std::cout << "MIDDLE" << ((ret.middle_raised == true) ? " RAISED" : " NOT RAISED") << std::endl;
                std::cout << "RING" << ((ret.ring_raised == true) ? " RAISED" : " NOT RAISED") << std::endl;
                std::cout << "PINKY" << ((ret.pinky_raised == true) ? " RAISED" : " NOT RAISED") << std::endl;
                
            }
            //Do something with image
            //TODO : Add lcd to show current gesture and countdown until refreshes image
            //sleep(1);
            long long start_time = getTimeInMs();
            bool data_sent = false;
            //Require user to press on rotary encoder to send the gesture to the webserver
            while (getTimeInMs() - start_time < WAIT_TIME && ret.hand_visible == true){
                if (start_value != rotary_press_statemachine_getValue() && data_sent == false){
                    std::cout << "Sending gesture data to webserver..." << std::endl;
                    //Send data to webserver
                    roomManager.sendGestureData(gestureData);
                    data_sent = true;
                    
                }
            }
        }

        std::this_thread::sleep_for(std::chrono::milliseconds(500));
    }
    
    // When stopping, leave the room if we're in one
    if (roomManager.isConnected()) {
        roomManager.leaveRoom();
    }
    
    detector->camera.closeCamera();
    rotary_press_statemachine_cleanup();
}


// Training section

std::vector<float> normalize_landmarks(const std::vector<cv::Point>& landmarks) {
    std::vector<float> flat;
    int base_x = landmarks[0].x;
    int base_y = landmarks[0].y;
    for (auto& p : landmarks) {
        flat.push_back(p.x - base_x);
        flat.push_back(p.y - base_y);
    }
    float max_val = 1.0f;
    for (float f : flat) max_val = std::max(max_val, std::abs(f));
    for (auto& f : flat) f /= max_val;
    return flat;
}

void save_gesture_to_csv(int label, const std::vector<float>& data) {
    std::ofstream file("gesture_data.csv", std::ios::app);
    file << label;
    for (const auto& val : data) file << "," << val;
    file << "\n";
}

void GestureDetector::runTestingMode() {
    cv::VideoCapture cap("/dev/video3");
    if (!cap.isOpened()) {
        std::cerr << "ERROR: Cannot open /dev/video3\n";
        return;
    }

    cv::Mat frame;
    while (true) {
        cap >> frame;
        if (frame.empty()) break;


        std::string text = "Test Screen.";
        cv::putText(frame, text, {220, 20}, cv::FONT_HERSHEY_SIMPLEX, 0.7, cv::Scalar(0, 255, 255), 2);

        std::string textExit = "Press ESC to Exit";
        cv::putText(frame, textExit, {220, 430}, cv::FONT_HERSHEY_SIMPLEX, 0.7, cv::Scalar(0, 255, 255), 2);

        cv::imshow("Test Screen", frame);
        char key = static_cast<char>(cv::waitKey(10));

        if (key == 27) break; // ESC
    }

    cap.release();
    cv::destroyAllWindows();
}