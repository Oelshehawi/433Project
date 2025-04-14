licenses(["notice"])

package(default_visibility = ["//visibility:public"])

# Main application binary
cc_binary(
    name = "gesture_game",
    srcs = ["main.cpp"],
    deps = [
        "//bazel_project_build/app:RoomManager",
        "//bazel_project_build/app:WebSocketClient",
        "//bazel_project_build/app:WebSocketReceiver", 
        "//bazel_project_build/app:DisplayManager",
        "//bazel_project_build/app:GestureDetector",
        "//bazel_project_build/app:GameState",
        "//bazel_project_build/app:MessageHandler",
        "//bazel_project_build/app:GestureEventSender",
        "//bazel_project_build/app:lcd_display",
        "//bazel_project_build/hal:rotary_press_statemachine",
        "//bazel_project_build/hal:joystick_press",
        "//bazel_project_build/app:SoundManager",
        "//bazel_project_build/app:audioMixer",
        "//bazel_project_build/app:periodTimer",
    ],
    linkopts = [
        "-L/usr/aarch64-linux-gnu/lib",
        "-lasound"
        ],
    visibility = ["//visibility:public"],
)

