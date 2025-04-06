#include <cstdlib>


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
ABSL_FLAG(std::string, calculator_graph_config_file, "hand_tracking_custom.pbtxt",
          "Name of file containing text format CalculatorGraphConfig proto.");
ABSL_FLAG(std::string, input_video_path, "",
          "Full path of video to load. "
          "If not provided, attempt to use a webcam.");
ABSL_FLAG(std::string, output_video_path, "output_tracking.mp4",
          "Full path of where to save result (.mp4 only). "
          "If not provided, show result in a window.");


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

#define THUMB_Y_THRESHOLD 0.5


bool handPosition::compare(handPosition reference){
    if (this->index_raised == reference.index_raised && this->middle_raised == reference.middle_raised && this->ring_raised == reference.ring_raised && this->pinky_raised == reference.pinky_raised && this->thumb_raised == reference.thumb_raised){
        return true;
    }
    return false;
}


void ProcessHandLandmarks(const mediapipe::NormalizedLandmarkList& landmark_list, handPosition* ret) {
    ret->hand_visible = true;
    
    /*
    for (int i = 0; i < landmark_list.landmark_size(); ++i) {
        if (i == 4|| i == 3|| i == 2|| i == 1){
            const mediapipe::NormalizedLandmark& landmark = landmark_list.landmark(i);
            float x = landmark.x();
            float y = landmark.y();
            float z = landmark.z();
            std::cout << "Landmark " << i << ": x=" << x << ", y=" << y << ", z=" << z << std::endl;
        }
        
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
    bool is_left_hand = false;
    if (pinky_tip.x() > index_tip.x()){
        is_left_hand = false;
        std::cout << "Is right hand" << std::endl;
    }else{
        is_left_hand = true;
        std::cout << "Is left hand" << std::endl;
    }
    if (index_bot.y() > index_tip.y() || index_bot.y() > index_high.y()){
        ret->index_raised = true;
        ret->num_fingers_held_up++;
    }
    if (middle_bot.y() > middle_tip.y()|| middle_bot.y() > middle_high.y()){
        ret->middle_raised = true;
        ret->num_fingers_held_up++;
    }
    if (ring_bot.y() > ring_tip.y() || ring_bot.y() > ring_high.y()){
        ret->ring_raised = true;
        ret->num_fingers_held_up++;
    }
    if (pinky_bot.y() > pinky_tip.y() || pinky_bot.y() > pinky_high.y()){
        ret->pinky_raised = true;
        ret->num_fingers_held_up++;
    }
    /*
    if (thumb_tip.y() < THUMB_Y_THRESHOLD){
        ret->thumb_raised = true;
        ret->num_fingers_held_up++;
    }*/
   if (is_left_hand){
    if (thumb_high.x() < thumb_tip.x() || THUMB_Y_THRESHOLD > thumb_tip.y()){
        ret->thumb_raised = true;
        ret->num_fingers_held_up++;
    }
   }else{
    if (thumb_high.x() > thumb_tip.x() || THUMB_Y_THRESHOLD > thumb_tip.y()){
        ret->thumb_raised = true;
        ret->num_fingers_held_up++;
    }
   }
    
    return;
}





absl::Status hand_analyze_image(cv::Mat image, handPosition* hand_pos){
    std::string calculator_graph_config_contents;
  MP_RETURN_IF_ERROR(mediapipe::file::GetContents(
      absl::GetFlag(FLAGS_calculator_graph_config_file),
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
    
    if (!poller.QueueSize()) {
        std::cout << "No new landmarks available. Skipping...\n" << std::endl;
        hand_pos->hand_visible = false;
        return absl::OkStatus();
    }
    
    //std::cout << "Queue size: " << poller.QueueSize() << std::endl;
    if (!poller.Next(&detection_packet)) {
      std::cout << "Poller failed. Skipping...\n" << std::endl;
      hand_pos->hand_visible = false;
      return absl::OkStatus();
    } 

    auto &output_landmarks = detection_packet.Get<std::vector<::mediapipe::NormalizedLandmarkList>>();
    
    if (output_landmarks.empty()) {
        std::cout << "No hand detected. Skipping this frame.\n" << std::endl;
        hand_pos->hand_visible = false;
        return absl::OkStatus();
        //continue;  // Go to next countdown/frame if no fingers detected (no landmarks detected)
    }

    mediapipe::NormalizedLandmarkList landmarks = output_landmarks[0];
    
    if (landmarks.landmark_size() < 21) {
      std::cout << "Detected hand has insufficient landmarks. Skipping...\n" << std::endl;
      hand_pos->hand_visible = false;
      return absl::OkStatus();
      //continue;
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
        return absl::OkStatus();
        //continue;
    }
    ProcessHandLandmarks(landmarks, hand_pos);
    MP_RETURN_IF_ERROR(graph.CloseInputStream(kInputStream));
    return graph.WaitUntilDone();

}
