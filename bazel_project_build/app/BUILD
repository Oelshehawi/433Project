
package(default_visibility = ["//visibility:public"])
cc_library(
    name = "gesture",
    srcs = ["gesture.cpp"],
    hdrs = ["RoomManager.h", "WebSocketClient.h", "WebSocketReceiver.h", "gesture.h", "hand_recognition.hpp"],
    includes = ["."],
    deps = ["//bazel_project_build/hal:camera_hal",
        "@com_google_absl//absl/flags:parse",
        "@com_google_absl//absl/flags:flag",
        "@com_google_absl//absl/status:status",
        "//mediapipe/framework/port:opencv_highgui",
        "//mediapipe/framework/port:opencv_imgproc",
        "//mediapipe/framework/port:opencv_video",
        ":hand_recognition"],
    

)
cc_library(
    name = "hand_recognition",
    srcs = ["hand_recognition.cpp"],
    hdrs = ["hand_recognition.hpp"],
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
        "@com_google_absl//absl/status:status",
    ],
)

cc_library(
    name = "RoomManager",
    srcs = ["RoomManager.cpp"],
    hdrs = ["RoomManager.h", "WebSocketClient.h", "WebSocketReceiver.h", "gesture.h", "hand_recognition.hpp"],
    includes = ["."],
)

cc_library(
    name = "libwebsockets",
    linkopts = ["-lwebsockets"],
    visibility = ["//visibility:public"],
)

cc_library(
    name = "WebSocketClient",
    srcs = ["WebSocketClient.cpp"],
    hdrs = ["RoomManager.h", "WebSocketClient.h", "WebSocketReceiver.h", "gesture.h", "hand_recognition.hpp"],
    includes = ["."],
    deps = [":libwebsockets"],
)
cc_library(
    name = "WebSocketReceiver",
    srcs = ["WebSocketReceiver.cpp"],
    hdrs = ["RoomManager.h", "WebSocketClient.h", "WebSocketReceiver.h", "gesture.h", "hand_recognition.hpp"],
    includes = ["."],
)

