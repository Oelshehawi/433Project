package(default_visibility = ["//visibility:public"])


cc_library(
    name = "Debug",
    srcs = [],
    hdrs = ["lib/Config/Debug.h"],
)



cc_library(
    name = "DEV_Config",
    srcs = ["lib/Config/DEV_Config.c"],
    hdrs = ["lib/Config/DEV_Config.h"],
    deps = [":Debug",
    "//bazel_project_build/lgpio:lgpio",
    "//bazel_project_build/lgpio:lgGpio",
    "//bazel_project_build/lgpio:lgCfg",
    "//bazel_project_build/lgpio:lgCmd",
    "//bazel_project_build/lgpio:lgCtx",
    "//bazel_project_build/lgpio:lgDbg",
    "//bazel_project_build/lgpio:lgErr",
    "//bazel_project_build/lgpio:lgExec",
    "//bazel_project_build/lgpio:lgFile",
    "//bazel_project_build/lgpio:lgHdl",
    "//bazel_project_build/lgpio:lgI2C",
    "//bazel_project_build/lgpio:lgMD5",
    "//bazel_project_build/lgpio:lgNotify",
    "//bazel_project_build/lgpio:lgPthAlerts",




    "//bazel_project_build/lgpio:lgPthTx",
    "//bazel_project_build/lgpio:lgScript",
    "//bazel_project_build/lgpio:lgSerial",
    "//bazel_project_build/lgpio:lgSPI",
    "//bazel_project_build/lgpio:lgThread",
    "//bazel_project_build/lgpio:lgUtil",
    "//bazel_project_build/lgpio:rgpio",
    "//bazel_project_build/lgpio:rgpiod",
    
    ],
    linkopts = 
         [
            "-lm",
        ],
        
    includes = ["."]
)

cc_library(
    name = "fonts",
    hdrs = ["lib/Fonts/fonts.h"],
)

cc_library(
    name = "LCD_1in54",
    srcs = ["lib/LCD/LCD_1in54.c"],
    hdrs = ["lib/LCD/LCD_1in54.h"],
    deps = [":DEV_Config",
    "//bazel_project_build/lgpio:lgpio",
    "//bazel_project_build/lgpio:lgGpio",
    "//bazel_project_build/lgpio:lgCfg",
    "//bazel_project_build/lgpio:lgCmd",
    "//bazel_project_build/lgpio:lgCtx",
    "//bazel_project_build/lgpio:lgDbg",
    "//bazel_project_build/lgpio:lgErr",
    "//bazel_project_build/lgpio:lgExec",
    "//bazel_project_build/lgpio:lgFile",
    "//bazel_project_build/lgpio:lgHdl",
    "//bazel_project_build/lgpio:lgI2C",
    "//bazel_project_build/lgpio:lgMD5",
    "//bazel_project_build/lgpio:lgNotify",
    "//bazel_project_build/lgpio:lgPthAlerts",




    "//bazel_project_build/lgpio:lgPthTx",
    "//bazel_project_build/lgpio:lgScript",
    "//bazel_project_build/lgpio:lgSerial",
    "//bazel_project_build/lgpio:lgSPI",
    "//bazel_project_build/lgpio:lgThread",
    "//bazel_project_build/lgpio:lgUtil",
    "//bazel_project_build/lgpio:rgpio",
    "//bazel_project_build/lgpio:rgpiod",
    
    ],
    includes = ["."],
)

cc_library(
    name = "font16",
    srcs = ["lib/Fonts/font16.c"],
    hdrs = ["lib/Fonts/fonts.h"],
    deps = [":fonts"],
)

cc_library(
    name = "GUI_BMP",
    srcs = ["lib/GUI/GUI_BMP.c"],
    hdrs = ["lib/GUI/GUI_BMP.h"],
    deps = [":GUI_Paint"]
)

cc_library(
    name = "GUI_Paint",
    srcs = ["lib/GUI/GUI_Paint.c"],
    hdrs = ["lib/GUI/GUI_Paint.h"],
    deps = [":fonts", ":Debug", "LCD_1in54"],
)


