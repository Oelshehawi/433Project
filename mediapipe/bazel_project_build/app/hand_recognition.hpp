#pragma once

#include <opencv2/opencv.hpp>
#include <opencv2/core/core.hpp>
#include "absl/status/status.h"

// Forward declarations for MediaPipe types
namespace mediapipe {
class NormalizedLandmarkList;
class NormalizedLandmark;
}

class handPosition {
public:
    bool hand_visible = false;
    int num_fingers_held_up = 0;
    bool index_held_up = false;
    bool middle_held_up = false;
    bool ring_held_up = false;
    bool pinky_held_up = false;
    bool thumb_held_up = false;
    
    // Default constructor for a hand with no fingers held up
    handPosition() : hand_visible(false), num_fingers_held_up(0), 
                     index_held_up(false), middle_held_up(false), 
                     ring_held_up(false), pinky_held_up(false), 
                     thumb_held_up(false) {}
    
    // Constructor for a hand with specific fingers held up
    handPosition(int fingers, bool thumb, bool index, bool middle, bool ring, bool pinky, bool visible=true) : 
                hand_visible(visible), num_fingers_held_up(fingers),
                index_held_up(index), middle_held_up(middle),
                ring_held_up(ring), pinky_held_up(pinky),
                thumb_held_up(thumb) {}
    
    // Compare with another handPosition
    bool compare(handPosition reference);
};

absl::Status hand_analyze_image(cv::Mat image, handPosition* hand_pos);

// Declaration for the hand landmarks processing function (implementation details hidden)
void ProcessHandLandmarks(const mediapipe::NormalizedLandmarkList& landmark_list, handPosition* ret);

