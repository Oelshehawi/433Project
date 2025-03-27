// Copyright 2019 The MediaPipe Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// An example of sending OpenCV webcam frames into a MediaPipe graph.
#include <cstdlib>

#include "absl/flags/flag.h"
#include "absl/flags/parse.h"
#include "absl/log/absl_log.h"
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

constexpr char kInputStream[] = "input_video";
constexpr char kOutputStream[] = "landmarks";
constexpr char kWindowName[] = "MediaPipe";
int counter = 0;
ABSL_FLAG(std::string, calculator_graph_config_file, "hand_tracking_desktop_live.pbtxt",
          "Name of file containing text format CalculatorGraphConfig proto.");
ABSL_FLAG(std::string, input_video_path, "",
          "Full path of video to load. "
          "If not provided, attempt to use a webcam.");
ABSL_FLAG(std::string, output_video_path, "output_tracking.mp4",
          "Full path of where to save result (.mp4 only). "
          "If not provided, show result in a window.");
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


handPosition ProcessHandLandmarks(const mediapipe::NormalizedLandmarkList& landmark_list) {
// Iterate through each landmark in the list
    handPosition ret;
    for (int i = 0; i < landmark_list.landmark_size(); ++i) {
        const mediapipe::NormalizedLandmark& landmark = landmark_list.landmark(i);

        // Extract the x, y, and z coordinates
        float x = landmark.x();
        float y = landmark.y();
        float z = landmark.z();

        // Print the landmark information
        std::cout << "Landmark " << i << ": x=" << x << ", y=" << y << ", z=" << z << std::endl;
    }
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
    if (index_bot.y() > index_tip.y()){
        ret.index_raised = true;
        ret.num_fingers_held_up++;
    }
    if (middle_bot.y() > middle_tip.y()){
        ret.middle_raised = true;
        ret.num_fingers_held_up++;
    }
    if (ring_bot.y() > ring_tip.y()){
        ret.ring_raised = true;
        ret.num_fingers_held_up++;
    }
    if (pinky_bot.y() > pinky_tip.y()){
        ret.pinky_raised = true;
        ret.num_fingers_held_up++;
    }
    if (thumb_tip.y() < 0.3){
        ret.thumb_raised = true;
        ret.num_fingers_held_up++;
    }
    std::cout << "CURRENT HAND POSITION" << std::endl;
    std::cout << "NUM FINGERS RAISED : "<< ret.num_fingers_held_up << std::endl;
    std::cout << "THUMB" << ((ret.thumb_raised == true) ? " RAISED" : " NOT RAISED") << std::endl;
    std::cout << "INDEX" << ((ret.index_raised == true) ? " RAISED" : " NOT RAISED") << std::endl;
    std::cout << "MIDDLE" << ((ret.middle_raised == true) ? " RAISED" : " NOT RAISED") << std::endl;
    std::cout << "RING" << ((ret.ring_raised == true) ? " RAISED" : " NOT RAISED") << std::endl;
    std::cout << "PINKY" << ((ret.pinky_raised == true) ? " RAISED" : " NOT RAISED") << std::endl;
    return ret;
}
        
//Shamelessly stolen from the example code
//bazel build -c opt --crosstool_top=@crosstool//:toolchains --compiler=gcc --cpu=aarch64 --define MEDIAPIPE_DISABLE_GPU=1 --compile_one_dependency --copt -DMEDIAPIPE_EDGE_TPU --copt=-flax-vector-conversions hand_recognition.cpp

absl::Status RunMPPGraph() {
  std::string calculator_graph_config_contents;
  MP_RETURN_IF_ERROR(mediapipe::file::GetContents(
      absl::GetFlag(FLAGS_calculator_graph_config_file),
      &calculator_graph_config_contents));
  ABSL_LOG(INFO) << "Get calculator graph config contents: "
                 << calculator_graph_config_contents;
  mediapipe::CalculatorGraphConfig config =
      mediapipe::ParseTextProtoOrDie<mediapipe::CalculatorGraphConfig>(
          calculator_graph_config_contents);

  ABSL_LOG(INFO) << "Initialize the calculator graph.";
  mediapipe::CalculatorGraph graph;
  MP_RETURN_IF_ERROR(graph.Initialize(config));

  ABSL_LOG(INFO) << "Initialize the camera or load the video.";
  cv::VideoCapture capture;
  const bool load_video = !absl::GetFlag(FLAGS_input_video_path).empty();
  if (load_video) {
    capture.open(absl::GetFlag(FLAGS_input_video_path));
  } else {
    //capture.open(0);
    capture.open("/dev/video3",cv::CAP_V4L2);
  }
  RET_CHECK(capture.isOpened());

  cv::VideoWriter writer;
  const bool save_video = !absl::GetFlag(FLAGS_output_video_path).empty();
  if (!save_video) {
    cv::namedWindow(kWindowName, /*flags=WINDOW_AUTOSIZE*/ 1);
#if (CV_MAJOR_VERSION >= 3) && (CV_MINOR_VERSION >= 2)
    capture.set(cv::CAP_PROP_FRAME_WIDTH, 640);
    capture.set(cv::CAP_PROP_FRAME_HEIGHT, 480);
    capture.set(cv::CAP_PROP_FPS, 30);
#endif
  }


  ABSL_LOG(INFO) << "Start running the calculator graph.";
  MP_ASSIGN_OR_RETURN(mediapipe::OutputStreamPoller poller,
                      graph.AddOutputStreamPoller(kOutputStream));
  MP_RETURN_IF_ERROR(graph.StartRun({}));

  ABSL_LOG(INFO) << "Start grabbing and processing frames.";
  bool grab_frames = true;
  int iterator = 0;
  while (counter < 1) {
    // Capture opencv camera or video frame.
    cv::Mat camera_frame_raw;
    for (int i = 0; i < 40; i++){
        capture >> camera_frame_raw;
    }
    cv::imwrite("lanmdarkref.jpg", camera_frame_raw);
    if (camera_frame_raw.empty()) {
      if (!load_video) {
        ABSL_LOG(INFO) << "Ignore empty frames from camera.";
        continue;
      }
      ABSL_LOG(INFO) << "Empty frame, end of video reached.";
      break;
    }
    cv::Mat camera_frame;
    cv::cvtColor(camera_frame_raw, camera_frame, cv::COLOR_BGR2RGB);
    if (!load_video) {
      cv::flip(camera_frame, camera_frame, /*flipcode=HORIZONTAL*/ 1);
    }

    // Wrap Mat into an ImageFrame.
    
    auto input_frame = absl::make_unique<mediapipe::ImageFrame>(
        mediapipe::ImageFormat::SRGB, camera_frame.cols, camera_frame.rows,
        mediapipe::ImageFrame::kDefaultAlignmentBoundary);
    cv::Mat input_frame_mat = mediapipe::formats::MatView(input_frame.get());
    camera_frame.copyTo(input_frame_mat);
    
    // Send image packet into the graph.
    std::cout << "sending to graph" << std::endl;
    size_t frame_timestamp_us =
        (double)cv::getTickCount() / (double)cv::getTickFrequency() * 1e6;
    MP_RETURN_IF_ERROR(graph.AddPacketToInputStream(
        kInputStream, mediapipe::Adopt(input_frame.release())
                          .At(mediapipe::Timestamp(frame_timestamp_us))));
        std::cout << "getting from graph" << std::endl;
    // Get the graph result packet, or stop if that fails.
    //mediapipe::Packet packet;
    mediapipe::Packet detection_packet;
    if (!poller.Next(&detection_packet))
      break;
      std::cout << "parsing data" << std::endl;
    auto &output_landmarks = detection_packet.Get<std::vector<::mediapipe::NormalizedLandmarkList>>();
    for (const ::mediapipe::NormalizedLandmarkList &normalizedlandmarkList : output_landmarks)
    {
      std::cout << "HandLandmarks:";
      std::cout << normalizedlandmarkList.DebugString();
    }
    mediapipe::NormalizedLandmarkList landmarks = output_landmarks[0];
    ProcessHandLandmarks(landmarks);

    std::cout << "leaving" << std::endl;
    // Convert back to opencv for display or saving.
    /*
    cv::Mat output_frame_mat = mediapipe::formats::MatView(&output_frame);
    cv::cvtColor(output_frame_mat, output_frame_mat, cv::COLOR_RGB2BGR);
    if (save_video) {
      if (!writer.isOpened()) {
        ABSL_LOG(INFO) << "Prepare video writer.";
        writer.open(absl::GetFlag(FLAGS_output_video_path),
                    mediapipe::fourcc('a', 'v', 'c', '1'),  // .mp4
                    capture.get(cv::CAP_PROP_FPS), output_frame_mat.size());
        RET_CHECK(writer.isOpened());
        
      }
      writer.write(output_frame_mat);
      std::cout<<"press key to exit" << std::endl;

        //exit(0);
        const int pressed_key = cv::waitKey(5);
        
        if (pressed_key >= 0 && pressed_key != 255) grab_frames = false;
    } else {
      cv::imshow(kWindowName, output_frame_mat);
      // Press any key to exit.
      const int pressed_key = cv::waitKey(5);
      if (pressed_key >= 0 && pressed_key != 255) grab_frames = false;
    }
    std::cout << "gram frames is" << grab_frames << std::endl;
    iterator++;
    if (iterator == 50){
      grab_frames = false;
    }
  }
*/counter++;
  ABSL_LOG(INFO) << "Shutting down.";
  if (writer.isOpened()) writer.release();
  MP_RETURN_IF_ERROR(graph.CloseInputStream(kInputStream));
  return graph.WaitUntilDone();
}
}

int main(int argc, char** argv) {
  google::InitGoogleLogging(argv[0]);
  absl::ParseCommandLine(argc, argv);
  absl::Status run_status = RunMPPGraph();
  if (!run_status.ok()) {
    ABSL_LOG(ERROR) << "Failed to run the graph: " << run_status.message();
    return EXIT_FAILURE;
  } else {
    ABSL_LOG(INFO) << "Success!";
  }
  return EXIT_SUCCESS;
}
