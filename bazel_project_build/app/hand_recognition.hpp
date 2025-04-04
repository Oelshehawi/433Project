#ifndef _HAND_RECOGNITION_HPP_
#define _HAND_RECOGNITION_HPP_
#include "absl/flags/flag.h"
#include "absl/flags/parse.h"
#include "absl/status/status.h"
//#include "absl/log/absl_log.h"
class handPosition{
    public:
        int num_fingers_held_up;
        bool hand_visible;
        bool thumb_raised;
        bool index_raised;
        bool middle_raised;
        bool ring_raised;
        bool pinky_raised;
        handPosition(): num_fingers_held_up(0), hand_visible(false) , thumb_raised(false), index_raised(false), middle_raised(false), ring_raised(false), pinky_raised(false) {}
    
};
absl::Status hand_analyze_image(cv::Mat image, handPosition* hand_pos);
#endif