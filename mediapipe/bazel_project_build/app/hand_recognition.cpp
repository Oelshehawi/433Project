#include <cstdlib>
#include <cmath>


#include "mediapipe/framework/calculator_framework.h"
#include "mediapipe/framework/formats/image_frame.h"
#include "mediapipe/framework/formats/landmark.pb.h"
#include "mediapipe/framework/formats/image_frame_opencv.h"
#include "mediapipe/framework/port/file_helpers.h"
#include "mediapipe/framework/port/opencv_highgui_inc.h"
#include "mediapipe/framework/port/opencv_imgproc_inc.h"
#include "mediapipe/framework/port/opencv_video_inc.h"
#include "mediapipe/framework/port/parse_text_proto.h"
#include "mediapipe/framework/port/status.h"
#include "mediapipe/util/resource_util.h"
#include "hand_recognition.hpp"


constexpr char kInputStream[] = "input_video";
constexpr char kOutputStream[] = "landmarks";
constexpr char kWindowName[] = "MediaPipe";

// Define constants for configuration
static const char* const kCalculatorGraphConfigFile = "hand_tracking_custom.pbtxt";
static const char* const kInputVideoPath = "";
static const char* const kOutputVideoPath = "output_tracking.mp4";

bool initial = true;
#define INDEX_TIP 8
#define INDEX_BOT 5
#define MIDDLE_TIP 12
#define MIDDLE_BOT 9
#define RING_TIP 16
#define RING_BOT 13
#define PINKY_TIP 20
#define PINKY_BOT 17
#define THUMB_TIP 4
#define THUMB_BOT 1

#define INDEX_HIGH 7
#define MIDDLE_HIGH 11
#define RING_HIGH 15
#define PINKY_HIGH 19
#define THUMB_HIGH 3
#define INDEX_LOW 5
#define MIDDLE_LOW 10
#define RING_LOW 14
#define PINKY_LOW 18
#define THUMB_LOW 2
#define HAND_BASE 0
#define THUMB_Y_THRESHOLD 0.4


bool handPosition::compare(handPosition reference){
    if (this->index_held_up == reference.index_held_up && 
        this->middle_held_up == reference.middle_held_up && 
        this->ring_held_up == reference.ring_held_up && 
        this->pinky_held_up == reference.pinky_held_up && 
        this->thumb_held_up == reference.thumb_held_up){
        return true;
    }
    return false;
}


void ProcessHandLandmarks(const mediapipe::NormalizedLandmarkList& landmark_list, handPosition* ret) {
    ret->hand_visible = true;
    
    /*
    for (int i = 0; i < landmark_list.landmark_size(); ++i) {
        //if (i == 4|| i == 3|| i == 2|| i == 1){
            const mediapipe::NormalizedLandmark& landmark = landmark_list.landmark(i);
            float x = landmark.x();
            float y = landmark.y();
            float z = landmark.z();
            std::cout << "Landmark " << i << ": x=" << x << ", y=" << y << ", z=" << z << std::endl;
        //}
        
    }
        */
        

    const mediapipe::NormalizedLandmark& index_tip = landmark_list.landmark(INDEX_TIP);
    const mediapipe::NormalizedLandmark& index_bot = landmark_list.landmark(INDEX_BOT);
    const mediapipe::NormalizedLandmark& middle_tip = landmark_list.landmark(MIDDLE_TIP);
    const mediapipe::NormalizedLandmark& middle_bot = landmark_list.landmark(MIDDLE_BOT);
    const mediapipe::NormalizedLandmark& ring_tip = landmark_list.landmark(RING_TIP);
    const mediapipe::NormalizedLandmark& ring_bot = landmark_list.landmark(RING_BOT);
    const mediapipe::NormalizedLandmark& pinky_tip = landmark_list.landmark(PINKY_TIP);
    const mediapipe::NormalizedLandmark& pinky_bot = landmark_list.landmark(PINKY_BOT);
    const mediapipe::NormalizedLandmark& thumb_tip = landmark_list.landmark(THUMB_TIP);
    const mediapipe::NormalizedLandmark& thumb_bot = landmark_list.landmark(THUMB_BOT);
    const mediapipe::NormalizedLandmark& index_high = landmark_list.landmark(INDEX_HIGH);
    const mediapipe::NormalizedLandmark& middle_high = landmark_list.landmark(MIDDLE_HIGH);
    const mediapipe::NormalizedLandmark& ring_high = landmark_list.landmark(RING_HIGH);
    const mediapipe::NormalizedLandmark& pinky_high = landmark_list.landmark(PINKY_HIGH);
    const mediapipe::NormalizedLandmark& thumb_high = landmark_list.landmark(THUMB_HIGH);
    const mediapipe::NormalizedLandmark& index_low = landmark_list.landmark(INDEX_LOW);
    const mediapipe::NormalizedLandmark& middle_low = landmark_list.landmark(MIDDLE_LOW);
    const mediapipe::NormalizedLandmark& ring_low = landmark_list.landmark(RING_LOW);
    const mediapipe::NormalizedLandmark& pinky_low = landmark_list.landmark(PINKY_LOW);
    const mediapipe::NormalizedLandmark& thumb_low = landmark_list.landmark(THUMB_LOW);
    const mediapipe::NormalizedLandmark& hand_base = landmark_list.landmark(HAND_BASE);

    // Remove hand orientation detection since we don't need it
    // bool is_left_hand = false;
    // if (pinky_tip.x() > index_tip.x()){
    //     is_left_hand = false;
    //     //std::cout << "Is right hand" << std::endl;
    // }else{
    //     is_left_hand = true;
    //     //std::cout << "Is left hand" << std::endl;
    // }
    
    int index_agreements = 0;
    for (int i = INDEX_TIP; i >= INDEX_BOT; i--){
        for (int j = i-1; j >= INDEX_BOT ; j--){
            if (landmark_list.landmark(i).y() > landmark_list.landmark(j).y()){
                index_agreements++;
            }
        }
    }
    if (index_agreements < 2){
        ret->index_held_up = true;
        ret->num_fingers_held_up++;
    }
    int middle_agreements = 0;
    for (int i = MIDDLE_TIP; i >= MIDDLE_BOT; i--){
        for (int j = i-1; j >= MIDDLE_BOT ; j--){
            if (landmark_list.landmark(i).y() > landmark_list.landmark(j).y()){
                middle_agreements++;
            }
        }
    }
    if (middle_agreements < 2){
        ret->middle_held_up = true;
        ret->num_fingers_held_up++;
    }
    int ring_agreements = 0;
    for (int i = RING_TIP; i >= RING_BOT; i--){
        for (int j = i-1; j >= RING_BOT ; j--){
            if (landmark_list.landmark(i).y() > landmark_list.landmark(j).y()){
                ring_agreements++;
            }
        }
    }
    if (ring_agreements < 2){
        ret->ring_held_up = true;
        ret->num_fingers_held_up++;
    }
    int pinky_agreements = 0;
    for (int i = PINKY_TIP; i >= PINKY_BOT; i--){
        for (int j = i-1; j >= PINKY_BOT ; j--){
            if (landmark_list.landmark(i).y() > landmark_list.landmark(j).y()){
                pinky_agreements++;
            }
        }
    }
    if (pinky_agreements < 2){
        ret->pinky_held_up = true;
        ret->num_fingers_held_up++;
    }
    
    // Replace simple thumb detection with more sophisticated agreement-based approach
    // Create different detection method for thumb that's less prone to false positives
    int thumb_agreements = 0;
    for (int i = THUMB_TIP; i >= THUMB_BOT; i--){
        for (int j = i-1; j >= THUMB_BOT ; j--){
            // Check both horizontal and vertical positioning for thumb
            if (landmark_list.landmark(i).y() > landmark_list.landmark(j).y()){
                thumb_agreements++;
            }
        }
    }

    // Also check the angle of the thumb relative to the hand
    float thumb_angle = calculateThumbAngle(thumb_tip, thumb_high, thumb_low, thumb_bot, hand_base);

    // Additional check for thumb extension - measure horizontal distance from palm
    float horizontal_distance = fabs(thumb_tip.x() - hand_base.x());
    
    // Stricter threshold - require all three conditions:
    // 1. Few agreements in vertical positioning (thumb not pointing down)
    // 2. Distinct angle away from the palm direction
    // 3. Significant horizontal extension from palm
    if (thumb_agreements < 2 && thumb_angle > 0.8 && horizontal_distance > 0.15) {
        ret->thumb_held_up = true;
        ret->num_fingers_held_up++;
    }
    return;
}

// Helper function to calculate thumb angle relative to hand
float calculateThumbAngle(
    const mediapipe::NormalizedLandmark& thumb_tip,
    const mediapipe::NormalizedLandmark& thumb_high,
    const mediapipe::NormalizedLandmark& thumb_low,
    const mediapipe::NormalizedLandmark& thumb_bot,
    const mediapipe::NormalizedLandmark& hand_base) {
    
    // Calculate vectors representing the thumb and palm
    float thumb_x = thumb_tip.x() - thumb_bot.x();
    float thumb_y = thumb_tip.y() - thumb_bot.y();
    
    // Reference vector approximately aligned with palm (pointing down)
    float palm_x = 0.0f;
    float palm_y = 1.0f;
    
    // Calculate magnitude of vectors
    float thumb_mag = sqrt(thumb_x * thumb_x + thumb_y * thumb_y);
    float palm_mag = 1.0f; // Unit vector
    
    // Calculate dot product
    float dot_product = thumb_x * palm_x + thumb_y * palm_y;
    
    // Calculate angle (will be 0 when aligned with palm, higher when extended)
    float cos_angle = dot_product / (thumb_mag * palm_mag);
    
    // Return 1 - cos_angle so the value is higher when thumb is extended
    return 1.0f - cos_angle;
}





absl::Status hand_analyze_image(cv::Mat image, handPosition* hand_pos){
    std::string calculator_graph_config_contents;
    
    // Use the fixed path directly instead of GetFlag
    MP_RETURN_IF_ERROR(mediapipe::file::GetContents(
      kCalculatorGraphConfigFile,
      &calculator_graph_config_contents));

    mediapipe::CalculatorGraphConfig config =
      mediapipe::ParseTextProtoOrDie<mediapipe::CalculatorGraphConfig>(
          calculator_graph_config_contents);
          mediapipe::CalculatorGraph graph;
    MP_RETURN_IF_ERROR(graph.Initialize(config));

    MP_ASSIGN_OR_RETURN(mediapipe::OutputStreamPoller poller,
      graph.AddOutputStreamPoller(kOutputStream));
    graph.StartRun({});
    cv::Mat camera_frame;
    cv::cvtColor(image, camera_frame, cv::COLOR_BGR2RGB);

    cv::flip(camera_frame, camera_frame, /*flipcode=HORIZONTAL*/ 1);

    // Wrap Mat into an ImageFrame.
    auto input_frame = absl::make_unique<mediapipe::ImageFrame>(
        mediapipe::ImageFormat::SRGB, camera_frame.cols, camera_frame.rows,
        mediapipe::ImageFrame::kDefaultAlignmentBoundary);
    cv::Mat input_frame_mat = mediapipe::formats::MatView(input_frame.get());
    camera_frame.copyTo(input_frame_mat);
    

    size_t frame_timestamp_us =
        (double)cv::getTickCount() / (double)cv::getTickFrequency() * 1e6;
    graph.AddPacketToInputStream(
        kInputStream, mediapipe::Adopt(input_frame.release())
                          .At(mediapipe::Timestamp(frame_timestamp_us)));
    graph.WaitUntilIdle(); // prevents off-by-one error of .jpg processing during runtime

    mediapipe::Packet detection_packet;
    
    // Static counter to limit log messages for missing landmarks
    static int noLandmarksCounter = 0;
    
    if (!poller.QueueSize()) {
        // Only log every 30 frames (about once per second at 30fps)
        if (noLandmarksCounter++ % 30 == 0) {
            std::cout << "No new landmarks available. Skipping..." << std::endl;
        }
        hand_pos->hand_visible = false;
        // Clean up before returning
        graph.CloseInputStream(kInputStream);
        graph.WaitUntilDone();
        return absl::OkStatus();
    }
    
    // Reset counter when we have landmarks
    noLandmarksCounter = 0;
    
    //std::cout << "Queue size: " << poller.QueueSize() << std::endl;
    if (!poller.Next(&detection_packet)) {
      std::cout << "Poller failed. Skipping...\n" << std::endl;
      hand_pos->hand_visible = false;
      // Clean up before returning
      graph.CloseInputStream(kInputStream);
      graph.WaitUntilDone();
      return absl::OkStatus();
    } 
    
    auto &output_landmarks = detection_packet.Get<std::vector<::mediapipe::NormalizedLandmarkList>>();
    
    if (output_landmarks.empty()) {
        std::cout << "No hand detected. Skipping this frame.\n" << std::endl;
        hand_pos->hand_visible = false;
        // Clean up before returning
        graph.CloseInputStream(kInputStream);
        graph.WaitUntilDone();
        return absl::OkStatus();
    }

    mediapipe::NormalizedLandmarkList landmarks = output_landmarks[0];
    
    if (landmarks.landmark_size() < 21) {
      std::cout << "Detected hand has insufficient landmarks. Skipping...\n" << std::endl;
      hand_pos->hand_visible = false;
      // Clean up before returning
      graph.CloseInputStream(kInputStream);
      graph.WaitUntilDone();
      return absl::OkStatus();
    }
    
    // Skip processing if landmarks look invalid (likely no hand)
    bool all_landmarks_invalid = true;
    for (int i = 0; i < landmarks.landmark_size(); ++i) {
        const auto& lm = landmarks.landmark(i);
        if (lm.x() > 0.0f && lm.x() < 1.0f &&
            lm.y() > 0.0f && lm.y() < 1.0f) {
            all_landmarks_invalid = false;
            break;
        }
    }
    if (all_landmarks_invalid) {
        std::cout << "No valid hand landmarks detected. Skipping...\n" << std::endl;
        hand_pos->hand_visible = false;
        // Clean up before returning
        graph.CloseInputStream(kInputStream);
        graph.WaitUntilDone();
        return absl::OkStatus();
    }
    
    ProcessHandLandmarks(landmarks, hand_pos);
    MP_RETURN_IF_ERROR(graph.CloseInputStream(kInputStream));
    return graph.WaitUntilDone();
}
