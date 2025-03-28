licenses(["notice"])

package(default_visibility = ["//visibility:public"])


cc_binary(
    name = "hand_recognition",
    srcs = ["hand_recognition.cpp"],
    deps = [
    	"//mediapipe/graphs/hand_tracking:desktop_tflite_calculators",
        "//mediapipe/calculators/core:pass_through_calculator",
        "//mediapipe/framework:calculator_framework",
        "//mediapipe/framework/formats:image_frame",
        "//mediapipe/framework/formats:image_frame_opencv",

        "//mediapipe/framework/port:file_helpers",
        "//mediapipe/framework/port:opencv_highgui",
	"//mediapipe/framework/port:opencv_imgproc",
	"//mediapipe/framework/port:opencv_video",
	"//mediapipe/framework/port:parse_text_proto",

	"//mediapipe/framework/port:status",
	"//mediapipe/calculators/util:landmarks_to_render_data_calculator",
	"//mediapipe/util:resource_util",
        "@com_google_absl//absl/flags:parse",
        "@com_google_absl//absl/flags:flag",
    ],
)

