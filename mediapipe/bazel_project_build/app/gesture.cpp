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
    
    // Wait a moment for server to respond (in a real implementation, we'd listen for response)
    std::this_thread::sleep_for(std::chrono::seconds(2));
    
    // Set a default player name if not already set
    if (roomManager.getPlayerName().empty()) {
        roomManager.setPlayerName("Player1");
    }
    
    // Initialize LCD
    lcd_init();
    
    // Initialize rotary encoder
    rotary_press_statemachine_init();
    
    // Create hand positions for each game action
    handPosition basic_attack(1, true, false, true, false, false, false);  // 1 finger (index)
    handPosition basic_defend(5, true, true, true, true, true, true);      // 5 fingers
    handPosition basic_build(2, true, false, true, false, false, true);    // 2 fingers (index and pinky)

    // Main detection loop
    while (detector->running) {
        // First check if game is active and display appropriate information
        if (roomManager.isGameActive()) {
            // Get current tower heights and goals
            int myTowerHeight, myGoalHeight, oppTowerHeight, oppGoalHeight;
            roomManager.getTowerStatus(myTowerHeight, myGoalHeight, oppTowerHeight, oppGoalHeight);
            
            // Display current game state on LCD
            char gameStateStr[32];
            snprintf(gameStateStr, sizeof(gameStateStr), "Tower: %d/%d vs %d/%d", 
                    myTowerHeight, myGoalHeight, oppTowerHeight, oppGoalHeight);
            
            // Display turn information
            char turnInfoStr[32];
            if (roomManager.isPlayerTurn()) {
                int remainingTime = roomManager.getRemainingTurnTime();
                snprintf(turnInfoStr, sizeof(turnInfoStr), "YOUR TURN (%ds)", remainingTime);
            } else {
                snprintf(turnInfoStr, sizeof(turnInfoStr), "OPPONENT'S TURN");
            }
            
            // Display shield status if active
            char statusStr[32];
            if (roomManager.isShieldActive()) {
                snprintf(statusStr, sizeof(statusStr), "SHIELD ACTIVE");
            } else {
                snprintf(statusStr, sizeof(statusStr), "NO SHIELD");
            }
            
            // Create message array for LCD
            char* lcdMessage[] = {gameStateStr, turnInfoStr, statusStr};
            lcd_place_message(lcdMessage, 3, lcd_center);
            
            // Display available cards if we have them
            std::vector<Card> playerCards = roomManager.getPlayerCards();
            if (!playerCards.empty()) {
                // Format card display message
                char cardMessages[3][32];
                for (size_t i = 0; i < playerCards.size() && i < 3; i++) {
                    snprintf(cardMessages[i], sizeof(cardMessages[i]), "%s", playerCards[i].name.c_str());
                }
                
                char* cardDisplayMsg[] = {
                    cardMessages[0], 
                    (playerCards.size() > 1) ? cardMessages[1] : (char*)"",
                    (playerCards.size() > 2) ? cardMessages[2] : (char*)""
                };
                lcd_place_message(cardDisplayMsg, playerCards.size(), lcd_center);
            }
        } else {
            // Display current cards if available and no active game
            std::vector<Card> playerCards = roomManager.getPlayerCards();
            if (!playerCards.empty()) {
                // Display cards on LCD
                displayCardsOnLCD(playerCards);
            } else {
                // No cards available yet, show waiting message
                char* waiting[] = {"Waiting for", "cards..."};
                lcd_place_message(waiting, 2, lcd_center);
            }
        }
        
        // Capture frame and analyze hand position
        cv::Mat frame;
        std::cout << "Taking image..." << std::endl;
        if (!detector->camera.captureFrame(frame)) {
            std::cerr << "Error: Could not capture frame" << std::endl;
            continue;
        }
        
        cv::imwrite("/tmp/reference.bmp", frame);
        chmod("/tmp/reference.bmp", 0666);  // Make world-writable
        
        // Save initial rotary value to detect button press
        int start_value = rotary_press_statemachine_getValue();
        
        // Analyze hand position
        handPosition ret;
        hand_analyze_image(frame, &ret);
        
        if (ret.hand_visible == false) {
            std::cout << "HAND NOT VISIBLE" << std::endl;
            // Show message on LCD
            char* nohand[] = {"No hand", "detected"};
            lcd_place_message(nohand, 2, lcd_center);
        } else {
            std::cout << "CURRENT HAND POSITION" << std::endl;
            std::cout << "NUM FINGERS RAISED : "<< ret.num_fingers_held_up << std::endl;
            std::cout << "THUMB" << ((ret.thumb_raised == true) ? " RAISED" : " NOT RAISED") << std::endl;
            std::cout << "INDEX" << ((ret.index_raised == true) ? " RAISED" : " NOT RAISED") << std::endl;
            std::cout << "MIDDLE" << ((ret.middle_raised == true) ? " RAISED" : " NOT RAISED") << std::endl;
            std::cout << "RING" << ((ret.ring_raised == true) ? " RAISED" : " NOT RAISED") << std::endl;
            std::cout << "PINKY" << ((ret.pinky_raised == true) ? " RAISED" : " NOT RAISED") << std::endl;
            
            // Determine the current gesture based on hand position
            std::string move = "invalid move";
            std::string actionType = "";
            
            // Map hand position to game action
            if (ret.hand_visible) {
                if (ret.num_fingers_held_up == 1 && ret.compare(basic_attack)) {
                    move = "basic attack";
                    actionType = "attack";
                } else if (ret.num_fingers_held_up == 5 && ret.compare(basic_defend)) {
                    move = "basic defend";
                    actionType = "defend";
                } else if (ret.num_fingers_held_up == 2 && ret.compare(basic_build)) {
                    move = "basic build";
                    actionType = "build";
                }
            }
            
            // Display current move on LCD
            char* moveArray[] = {(char*)move.c_str()};
            lcd_place_message(moveArray, 1, lcd_center);
            
            // Only process action if it's our turn or if game isn't turn-based
            bool canTakeAction = !roomManager.isGameActive() || roomManager.isPlayerTurn();
            
            if (canTakeAction) {
                // Wait for user interaction or timeout
                long long start_time = getTimeInMs();
                bool data_sent = false;
                
                while (getTimeInMs() - start_time < WAIT_TIME && ret.hand_visible == true) {
                    if (start_value != rotary_press_statemachine_getValue() && data_sent == false) {
                        std::cout << "Sending gesture data to webserver..." << std::endl;
                        
                        // Check if we have a card for this action
                        if (actionType != "" && actionType != "invalid move") {
                            Card* matchingCard = roomManager.findCardByType(actionType);
                            if (matchingCard != nullptr) {
                                // Display selected card on LCD
                                char* cardName[] = {(char*)matchingCard->name.c_str()};
                                lcd_place_message(cardName, 1, lcd_center);
                                
                                // Send card action to server
                                std::cout << "Using card: " << matchingCard->name << " (" << matchingCard->id << ")" << std::endl;
                                roomManager.sendCardAction(matchingCard->id, actionType);
                            } else {
                                // No matching card, just send basic action
                                roomManager.sendGestureData(move);
                            }
                        } else {
                            // Invalid move, send as-is
                            roomManager.sendGestureData(move);
                        }
                        
                        data_sent = true;
                        
                        // Show confirmation on LCD
                        char* sent[] = {"Action sent!"};
                        lcd_place_message(sent, 1, lcd_center);
                        std::this_thread::sleep_for(std::chrono::milliseconds(1000));
                    }
                }
            } else {
                // Not our turn, display message
                char* notTurn[] = {"Not your turn!"};
                lcd_place_message(notTurn, 1, lcd_center);
                std::this_thread::sleep_for(std::chrono::milliseconds(1000));
            }
        }

        std::this_thread::sleep_for(std::chrono::milliseconds(500));
    }
    
    // When stopping, leave the room if we're in one
    if (roomManager.isConnected()) {
        roomManager.leaveRoom();
    }
    
    // Cleanup
    lcd_cleanup();
    detector->camera.closeCamera();
    rotary_press_statemachine_cleanup();
}

// New helper function to display cards on LCD
void displayCardsOnLCD(const std::vector<Card>& cards) {
    char** cardMessages = new char*[cards.size()];
    
    // Prepare card messages
    for (size_t i = 0; i < cards.size(); i++) {
        std::string cardText = cards[i].name + " (" + cards[i].type + ")";
        cardMessages[i] = new char[cardText.length() + 1];
        strcpy(cardMessages[i], cardText.c_str());
    }
    
    // Display cards on LCD
    lcd_place_message(cardMessages, cards.size(), lcd_center);
    
    // Clean up memory
    for (size_t i = 0; i < cards.size(); i++) {
        delete[] cardMessages[i];
    }
    delete[] cardMessages;
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