package(default_visibility = ["//visibility:public"])

cc_library(
    name = "camera_hal",
    srcs = ["camera_hal.cpp"],
    hdrs = ["camera_hal.h"],
    deps = ["//mediapipe/framework/port:opencv_highgui",
        "//mediapipe/framework/port:opencv_imgproc",
        "//mediapipe/framework/port:opencv_video",],
)

cc_library(
    name = "libgpiod",
    linkopts = ["-lgpiod"],
    visibility = ["//visibility:public"],
)

cc_library(
    name = "gpio",
    srcs = ["gpio.c"],
    hdrs = ["gpio.h"],
    deps = [":libgpiod"]
)

cc_library(
    name = "rotary_press_statemachine",
    srcs = ["rotary_press_statemachine.c"],
    hdrs = ["rotary_press_statemachine.h"],
    deps = [":gpio"],
)

