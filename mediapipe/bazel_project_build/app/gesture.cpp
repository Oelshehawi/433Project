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
#include <nlohmann/json.hpp>

using namespace cv;
#define WAIT_TIME 3000
// Define simple gestures
const char *GESTURES[] = {
    "Thumbs Up", 
    "Thumbs Down", 
    "Wave"
};

// Function to get current time in milliseconds
static long long getTimeInMs(void)
{
    struct timespec spec;
    clock_gettime(CLOCK_REALTIME, &spec);
    long long seconds = spec.tv_sec;
    long long nanoSeconds = spec.tv_nsec;
    long long milliSeconds = seconds * 1000
            + nanoSeconds / 1000000;
    return milliSeconds;
}

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
GestureDetector::GestureDetector() : running(false), roomManager(nullptr) {}

GestureDetector::~GestureDetector() {
    if (running) {
        stopDetection();
    }
}

void GestureDetector::setRoomManager(RoomManager* rm) {
    roomManager = rm;
}

// Test camera access without starting gesture detection
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

// Simple function to run camera in testing mode
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
            
            char* successMsg[] = {"Camera working!", "Press to exit"};
            lcd_place_message(successMsg, 2, lcd_center);
        }
        
        frames++;
        
        // Check how long we've been running
        auto now = std::chrono::steady_clock::now();
        auto elapsed = std::chrono::duration_cast<std::chrono::seconds>(now - startTime).count();
        
        // Every 5 seconds, display frame rate
        if (elapsed >= 5) {
            double fps = static_cast<double>(frames) / elapsed;
            std::cout << "Frames captured: " << frames << " (" << std::fixed << std::setprecision(1) << fps << " FPS)" << std::endl;
            
            char fpsMsg[32];
            snprintf(fpsMsg, sizeof(fpsMsg), "%.1f FPS", fps);
            char* successMsg[] = {"Camera working!", fpsMsg};
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

void GestureDetector::startDetection() {
    if (running) {
        std::cout << "Gesture detection is already running" << std::endl;
        return;
    }
    
    if (!roomManager) {
        std::cerr << "Error: RoomManager is not set" << std::endl;
        return;
    }
    
    running = true;
    detectionThread = std::thread(&GestureDetector::detectionLoop, this);
}

void GestureDetector::stopDetection() {
    if (!running) {
        std::cout << "Gesture detection is not running" << std::endl;
        return;
    }
    
    running = false;
    if (detectionThread.joinable()) {
        detectionThread.join();
    }
    
    // Cleanup camera if needed
    camera.closeCamera();
    
    // Reset LCD display
    char* stoppedMsg[] = {"Gesture detection", "stopped"};
    lcd_place_message(stoppedMsg, 2, lcd_center);
}

void GestureDetector::detectionLoop() {
    // Check if room manager is available
    if (!roomManager) {
        std::cerr << "Error: RoomManager not set for GestureDetector" << std::endl;
        running = false;
        return;
    }
    
    std::cout << "Gesture detector started with Device ID: " << roomManager->getDeviceId() << std::endl;
    
    // Attempt to open the camera
    if (!camera.openCamera()) {
        std::cerr << "Error: Could not open camera on /dev/video3" << std::endl;
        return;
    }
    
    // Display simple starting message
    char* startingMsg[] = {"Ready for", "gesture detection"};
    lcd_place_message(startingMsg, 2, lcd_center);
    std::this_thread::sleep_for(std::chrono::milliseconds(1000));
    
    // Server-based card management message
    if (roomManager->isGameActive()) {
        char* waitingMsg[] = {"Game in progress", "Server manages cards"};
        lcd_place_message(waitingMsg, 2, lcd_center);
        std::this_thread::sleep_for(std::chrono::seconds(2));
    } else {
        char* notInGameMsg[] = {"Not in game", "Join room & start"};
        lcd_place_message(notInGameMsg, 2, lcd_center);
        std::this_thread::sleep_for(std::chrono::seconds(2));
    }
    
    // Create hand positions for each game action
    handPosition basic_attack(1, true, false, true, false, false, false);  // 1 finger (index)
    handPosition basic_defend(5, true, true, true, true, true, true);      // 5 fingers
    handPosition basic_build(2, true, false, true, false, false, true);    // 2 fingers (index and pinky)
    
    // Variables for logging control
    int loopCounter = 0;
    
    // Main detection loop
    while (running) {
        loopCounter++;
        bool shouldLog = (loopCounter % 20 == 0); // Only log every 20th iteration
        
        // Simple prompt for gesture
        char* promptMsg[] = {"Show gesture", "for action"};
        lcd_place_message(promptMsg, 2, lcd_center);
        
        bool gestureDetected = false;
        std::string detectedMove = "";
        std::string actionType = "";
        
        // Gesture detection phase
        while (running && !gestureDetected) {
            // Capture frame and analyze hand position
            cv::Mat frame;
            if (shouldLog) std::cout << "Waiting for gesture..." << std::endl;
            
            if (!camera.captureFrame(frame)) {
                std::cerr << "Error: Could not capture frame" << std::endl;
                std::this_thread::sleep_for(std::chrono::milliseconds(500));
                continue;
            }
            
            // Save image for debugging
            cv::imwrite("/tmp/reference.bmp", frame);
            chmod("/tmp/reference.bmp", 0666);  // Make world-writable
            
            // Analyze hand position
            handPosition ret;
            hand_analyze_image(frame, &ret);
            
            if (!ret.hand_visible) {
                // No hand detected, keep waiting
                std::this_thread::sleep_for(std::chrono::milliseconds(100));
                continue;
            }
            
            // Determine the gesture based on hand position
            if (ret.num_fingers_held_up == 1 && ret.compare(basic_attack)) {
                detectedMove = "Attack";
                actionType = "attack";
                gestureDetected = true;
            } else if (ret.num_fingers_held_up == 5 && ret.compare(basic_defend)) {
                detectedMove = "Defend";
                actionType = "defend";
                gestureDetected = true;
            } else if (ret.num_fingers_held_up == 2 && ret.compare(basic_build)) {
                detectedMove = "Build";
                actionType = "build";
                gestureDetected = true;
            }
            
            // If a valid gesture was detected, break out of the detection loop
            if (gestureDetected) {
                std::cout << "Detected gesture: " << detectedMove << std::endl;
                break;
            }
            
            // Short delay before next detection attempt
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
        }
        
        // If we detected a valid gesture, ask for confirmation
        if (gestureDetected && running) {
            // Display the detected gesture and ask for confirmation
            char gestureMsgLine1[32];
            snprintf(gestureMsgLine1, sizeof(gestureMsgLine1), "%s detected", detectedMove.c_str());
            
            char* gestureMsg[] = {
                gestureMsgLine1,
                "Press to confirm"
            };
            
            lcd_place_message(gestureMsg, 2, lcd_center);
            
            // Get initial rotary encoder value
            int startValue = rotary_press_statemachine_getValue();
            long long startTime = getTimeInMs();
            bool gestureConfirmed = false;
            
            // Wait for confirmation or timeout
            while (running && getTimeInMs() - startTime < 5000) { // 5 second timeout
                if (startValue != rotary_press_statemachine_getValue()) {
                    gestureConfirmed = true;
                    break;
                }
                std::this_thread::sleep_for(std::chrono::milliseconds(50));
            }
            
            // If user confirmed, send the gesture data
            if (gestureConfirmed) {
                if (roomManager->isConnected()) {
                    // Create JSON gesture data
                    json gestureData = {
                        {"gesture", actionType},
                        {"confidence", 0.95}
                    };
                    
                    // Send the gesture data
                    bool success = roomManager->sendGestureData(gestureData.dump());
                    
                    if (success) {
                        std::cout << "Gesture data sent: " << actionType << std::endl;
                        char* sentMsg[] = {"Gesture sent", "to server"};
                        lcd_place_message(sentMsg, 2, lcd_center);
                    } else {
                        std::cout << "Failed to send gesture data" << std::endl;
                        char* failMsg[] = {"Failed to send", "gesture data"};
                        lcd_place_message(failMsg, 2, lcd_center);
                    }
                } else {
                    std::cout << "Not connected to a room. Cannot send gesture." << std::endl;
                    char* notConnectedMsg[] = {"Not in a room", "Join room first"};
                    lcd_place_message(notConnectedMsg, 2, lcd_center);
                }
                
                // Pause briefly to display the confirmation message
                std::this_thread::sleep_for(std::chrono::seconds(1));
            } else {
                // User did not confirm within the timeout period
                std::cout << "Gesture confirmation timed out" << std::endl;
                char* timeoutMsg[] = {"Confirmation", "timed out"};
                lcd_place_message(timeoutMsg, 2, lcd_center);
                std::this_thread::sleep_for(std::chrono::milliseconds(1000));
            }
        }
        
        // Short pause before next detection cycle
        std::this_thread::sleep_for(std::chrono::milliseconds(500));
    }
    
    // Cleanup
    camera.closeCamera();
}

// Display a list of cards on the LCD
void displayCardsOnLCD(const std::vector<Card>& cards) {
    if (cards.empty()) {
        char* noCardsMsg[] = {"No cards", "available"};
        lcd_place_message(noCardsMsg, 2, lcd_center);
        return;
    }
    
    // Clear the LCD first
    lcd_clear_screen();
    
    // Create a combined display showing all cards
    char line1[32];
    char line2[32];
    char line3[32];
    
    // Count card types
    int attackCount = 0;
    int defendCount = 0;
    int buildCount = 0;
    
    for (const auto& card : cards) {
        if (card.type == "attack") attackCount++;
        else if (card.type == "defend") defendCount++;
        else if (card.type == "build") buildCount++;
    }
    
    // Format the header line
    snprintf(line1, sizeof(line1), "YOUR CARDS:");
    
    // Format the card type counts
    snprintf(line2, sizeof(line2), "ATK:%d DEF:%d BLD:%d", attackCount, defendCount, buildCount);
    
    // Info line
    snprintf(line3, sizeof(line3), "Start to play");
    
    // Display the summary
    char* cardMsg[] = {line1, line2, line3};
    lcd_place_message(cardMsg, 3, lcd_center);
    
    // Log what we're displaying
    std::cout << "LCD now displaying cards:" << std::endl;
    std::cout << "- Attack cards: " << attackCount << std::endl;
    std::cout << "- Defend cards: " << defendCount << std::endl;
    std::cout << "- Build cards: " << buildCount << std::endl;
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