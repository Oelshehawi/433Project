package(default_visibility = ["//visibility:public"])

# Primary libraries - no internal dependencies 

cc_library(
    name = "lcd_display",
    srcs = ["lcd_display.c"],
    hdrs = ["lcd_display.h"],
    deps = ["//bazel_project_build/lcd:DEV_Config",
            "//bazel_project_build/lcd:GUI_BMP",
            "//bazel_project_build/lcd:GUI_Paint",
            "//bazel_project_build/lcd:LCD_1in54",
            "//bazel_project_build/lcd:font16", ]
)

cc_library(
    name = "libwebsockets",
    linkopts = ["-lwebsockets"],
    visibility = ["//visibility:public"],
)

cc_library(
    name = "WebSocketClient",
    srcs = ["WebSocketClient.cpp"],
    hdrs = ["WebSocketClient.h"],
    includes = ["."],
    deps = [":libwebsockets"],
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

# Secondary libraries - depend on primary libraries

cc_library(
    name = "WebSocketReceiver",
    srcs = ["WebSocketReceiver.cpp"],
    hdrs = ["WebSocketReceiver.h", "WebSocketClient.h"],
    includes = ["."],
    deps = [":WebSocketClient"],
)

# Core library headers - these have circular dependencies
# but we need the headers to be available

cc_library(
    name = "CoreHeaders",
    hdrs = [
        "RoomManager.h",
        "GameState.h",
        "DisplayManager.h",
        "MessageHandler.h",
    ],
    includes = ["."],
    deps = [":WebSocketClient", ":WebSocketReceiver"],
    visibility = ["//visibility:public"],
)

# Tertiary libraries - depend on primary and secondary libraries

cc_library(
    name = "DisplayManager",
    srcs = ["DisplayManager.cpp"],
    hdrs = ["DisplayManager.h"],
    includes = ["."],
    deps = [
        ":CoreHeaders",
        ":lcd_display",
    ],
    visibility = ["//visibility:public"],
)

cc_library(
    name = "GameState",
    srcs = ["GameState.cpp"],
    hdrs = ["GameState.h"],
    includes = ["."],
    deps = [
        ":CoreHeaders",
        ":GestureDetector",
        ":GestureEventSender"
    ],
)

cc_library(
    name = "MessageHandler",
    srcs = ["MessageHandler.cpp"],
    hdrs = ["MessageHandler.h"],
    includes = ["."],
    deps = [
        ":CoreHeaders", 
        ":WebSocketClient", 
        ":DisplayManager",
        ":GestureDetector"
    ],
    visibility = ["//visibility:public"],
)

cc_library(
    name = "RoomManager",
    srcs = ["RoomManager.cpp"],
    hdrs = ["RoomManager.h"],
    includes = ["."],
    deps = [
        ":CoreHeaders", 
        ":WebSocketClient", 
        ":WebSocketReceiver", 
        ":DisplayManager", 
        ":GameState", 
        ":MessageHandler",
        ":GestureEventSender"
    ],
)

cc_library(
    name = "GestureEventSender",
    srcs = ["GestureEventSender.cpp"],
    hdrs = ["GestureEventSender.h"],
    includes = ["."],
    deps = [":CoreHeaders", ":WebSocketClient"],
)

cc_library(
    name = "GestureDetector",
    srcs = ["GestureDetector.cpp"],
    hdrs = ["GestureDetector.h"],
    includes = ["."],
    deps = [
        ":CoreHeaders",
        ":hand_recognition",
        ":lcd_display",
        ":SoundManager",
        ":GestureEventSender",
        "//bazel_project_build/hal:camera_hal",
        "//bazel_project_build/hal:rotary_press_statemachine",
    ],
)

cc_library(
    name = "periodTimer",
    srcs = ["periodTimer.c"],
    hdrs = ["periodTimer.h"],
    includes = ["."],
)

cc_library(
    name = "audioMixer",
    srcs = ["audioMixer.c"],
    hdrs = ["audioMixer.h"],
    deps = [":periodTimer"],
    linkopts = [
        "-L/usr/aarch64-linux-gnu/lib",
        "-lasound"
        ],
    visibility = ["//visibility:public"],
)

cc_library(
    name = "SoundManager",
    srcs = ["SoundManager.c"],
    hdrs = ["SoundManager.h"],
    deps = [":audioMixer"],
    visibility = ["//visibility:public"],
)
