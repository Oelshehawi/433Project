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
        
    const mediapipe::NormalizedLandmark& thumb_tip = landmark_list.landmark(THUMB_TIP);
    const mediapipe::NormalizedLandmark& hand_base = landmark_list.landmark(HAND_BASE);
    
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

   if (fabs(hand_base.x() - thumb_tip.x()) > 0.1 || fabs(thumb_tip.y() - hand_base.y()) > THUMB_Y_THRESHOLD){
        ret->thumb_held_up = true;
        ret->num_fingers_held_up++;
   }
    return;
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
