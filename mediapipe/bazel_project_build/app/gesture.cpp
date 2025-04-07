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
    
    // Display simple starting message
    char* startingMsg[] = {"Ready for", "gesture detection"};
    lcd_place_message(startingMsg, 2, lcd_center);
    std::this_thread::sleep_for(std::chrono::milliseconds(1000));
    
    // Check if we have cards first
    std::vector<Card> initialCards = roomManager.getPlayerCards();
    if (initialCards.empty()) {
        std::cout << "No cards available. Waiting for cards from server..." << std::endl;
        
        // Show waiting message on LCD
        char* waitingMsg[] = {"Waiting for cards", "from server..."};
        lcd_place_message(waitingMsg, 2, lcd_center);
        
        // Wait a bit for cards to be received
        std::this_thread::sleep_for(std::chrono::seconds(3));
        
        // Check again for cards
        initialCards = roomManager.getPlayerCards();
        if (initialCards.empty()) {
            std::cout << "Still no cards available. Make sure game has started properly." << std::endl;
            
            // Show error message on LCD
            char* noCardsMsg[] = {"No cards received", "Start game first!"};
            lcd_place_message(noCardsMsg, 2, lcd_center);
            std::this_thread::sleep_for(std::chrono::seconds(2));
        }
    }
    
    // If we have cards, display them
    if (!initialCards.empty()) {
        displayCardsOnLCD(initialCards);
        std::this_thread::sleep_for(std::chrono::seconds(2));
    }
    
    // Create hand positions for each game action
    handPosition basic_attack(1, true, false, true, false, false, false);  // 1 finger (index)
    handPosition basic_defend(5, true, true, true, true, true, true);      // 5 fingers
    handPosition basic_build(2, true, false, true, false, false, true);    // 2 fingers (index and pinky)
    
    // Variables for logging control
    int loopCounter = 0;
    std::vector<Card> lastPlayerCards;
    
    // Main detection loop
    while (detector->running) {
        loopCounter++;
        bool shouldLog = (loopCounter % 20 == 0); // Only log every 20th iteration
        
        // Get current cards and display them first
        std::vector<Card> playerCards = roomManager.getPlayerCards();
        
        // Debug card info
        if (shouldLog || playerCards.size() != lastPlayerCards.size()) {
            std::cout << "Current cards: " << playerCards.size() << std::endl;
            for (const auto& card : playerCards) {
                std::cout << "  Card: ID=" << card.id << ", Type=" << card.type << ", Name=" << card.name << std::endl;
            }
        }
        
        // Check if cards have changed without using direct vector comparison
        bool cardsChanged = false;
        if (playerCards.size() != lastPlayerCards.size()) {
            cardsChanged = true;
            std::cout << "Card count changed from " << lastPlayerCards.size() << " to " << playerCards.size() << std::endl;
        } else {
            // Check if any card IDs are different
            for (size_t i = 0; i < playerCards.size(); i++) {
                if (playerCards[i].id != lastPlayerCards[i].id) {
                    cardsChanged = true;
                    std::cout << "Card changed: " << lastPlayerCards[i].id << " -> " << playerCards[i].id << std::endl;
                    break;
                }
            }
        }
        
        if (!playerCards.empty() && cardsChanged) {
            // Display cards on LCD
            displayCardsOnLCD(playerCards);
            lastPlayerCards = playerCards;
            std::this_thread::sleep_for(std::chrono::milliseconds(1500));
        }
        
        // Simple prompt for gesture
        char* promptMsg[] = {"Show gesture", "to play card"};
        lcd_place_message(promptMsg, 2, lcd_center);
        
        bool gestureDetected = false;
        std::string detectedMove = "";
        std::string actionType = "";
        
        // Gesture detection phase
        while (detector->running && !gestureDetected) {
            // Capture frame and analyze hand position
            cv::Mat frame;
            if (shouldLog) std::cout << "Waiting for gesture..." << std::endl;
            
            if (!detector->camera.captureFrame(frame)) {
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
        if (gestureDetected && detector->running) {
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
            while (detector->running && getTimeInMs() - startTime < 5000) { // 5 second timeout
                if (startValue != rotary_press_statemachine_getValue()) {
                    gestureConfirmed = true;
                    break;
                }
                std::this_thread::sleep_for(std::chrono::milliseconds(50));
            }
            
            // If user confirmed, send the gesture data
            if (gestureConfirmed) {
                // Check if we're in a game and if it's our turn
                bool canTakeAction = !roomManager.isGameActive() || roomManager.isPlayerTurn();
                
                if (canTakeAction) {
                    // Find a matching card for the action
                    Card* matchingCard = nullptr;
                    if (actionType != "") {
                        matchingCard = roomManager.findCardByType(actionType);
                    }
                    
                    // Show sending message
                    char* sendingMsg[] = {"Sending..."};
                    lcd_place_message(sendingMsg, 1, lcd_center);
                    
                    if (matchingCard != nullptr) {
                        // Send the card action
                        std::cout << "Using card: " << matchingCard->name << " (" << matchingCard->id << ")" << std::endl;
                        roomManager.sendCardAction(matchingCard->id, actionType);
                    } else {
                        // No matching card, send basic gesture
                        std::cout << "Sending basic action: " << detectedMove << std::endl;
                        roomManager.sendGestureData(detectedMove);
                    }
                    
                    // Show brief confirmation
                    char* sentMsg[] = {"Card played!"};
                    lcd_place_message(sentMsg, 1, lcd_center);
                    std::this_thread::sleep_for(std::chrono::milliseconds(500));
                    
                    // Update display with new cards
                    std::vector<Card> updatedCards = roomManager.getPlayerCards();
                    
                    // Check if cards have changed
                    bool cardsUpdated = false;
                    if (updatedCards.size() != lastPlayerCards.size()) {
                        cardsUpdated = true;
                    } else {
                        // Check if any card IDs are different
                        for (size_t i = 0; i < updatedCards.size(); i++) {
                            if (updatedCards[i].id != lastPlayerCards[i].id) {
                                cardsUpdated = true;
                                break;
                            }
                        }
                    }
                    
                    if (!updatedCards.empty() && cardsUpdated) {
                        displayCardsOnLCD(updatedCards);
                        lastPlayerCards = updatedCards;
                    }
                } else {
                    // Not our turn
                    char* notTurnMsg[] = {"Not your turn"};
                    lcd_place_message(notTurnMsg, 1, lcd_center);
                    std::this_thread::sleep_for(std::chrono::milliseconds(800));
                }
            } else {
                // User didn't confirm, show brief message
                char* cancelledMsg[] = {"Cancelled"};
                lcd_place_message(cancelledMsg, 1, lcd_center);
                std::this_thread::sleep_for(std::chrono::milliseconds(500));
            }
        }
        
        // Short delay before next detection cycle
        std::this_thread::sleep_for(std::chrono::milliseconds(500));
    }
    
    // When stopping, leave the room if we're in one
    if (roomManager.isConnected()) {
        roomManager.leaveRoom();
    }
    
    // Cleanup
    detector->camera.closeCamera();
    
    // Show simple stopped message
    char* stoppedMsg[] = {"Detection stopped"};
    lcd_place_message(stoppedMsg, 1, lcd_center);
}

// New helper function to display cards on LCD
void displayCardsOnLCD(const std::vector<Card>& cards) {
    char** cardMessages = new char*[cards.size()];
    
    // Prepare card messages with simple numbered format
    for (size_t i = 0; i < cards.size(); i++) {
        std::string cardText = std::to_string(i+1) + ": " + cards[i].type;
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