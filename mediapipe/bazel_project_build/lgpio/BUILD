

package(default_visibility = ["//visibility:public"])
cc_library(
    name = "lgGpio",
    srcs = ["lgGpio.c"],
    hdrs = ["lgGpio.h", "lgpio.h","lgDbg.h","lgHdl.h", "lgPthAlerts.h","lgPthTx.h"],
    deps = [":lgPthTx"],
    strip_include_prefix = "/", 
)
cc_library(
    name = "lgCfg",
    srcs = ["lgCfg.c"],
    hdrs = ["lgCfg.h"],
    strip_include_prefix = "/", deps = [":lgpio", ":lgDbg"],
)
cc_library(
    name = "lgCmd",
    srcs = ["lgCmd.c"],
    hdrs = ["lgCmd.h"],
    strip_include_prefix = "/", deps = [":lgpio", ":lgDbg", ":rgpiod"],
)
cc_library(
    name = "lgCtx",
    srcs = ["lgCtx.c"],
    hdrs = ["lgCtx.h"],
    strip_include_prefix = "/", deps = [":lgpio", ":lgDbg"],
)
cc_library(
    name = "lgDbg",
    srcs = ["lgDbg.c"],
    hdrs = ["lgDbg.h"],
    strip_include_prefix = "/", deps = [":lgpio"],
)
cc_library(
    name = "lgErr",
    srcs = ["lgErr.c"],
    strip_include_prefix = "/", deps = [":lgpio", ":lgDbg"],
)

cc_library(
    name = "lgExec",
    srcs = ["lgExec.c"],
    strip_include_prefix = "/", deps = [":lgpio", ":lgDbg",":rgpiod", ":lgHdl" , ":lgCfg", ":lgCmd", ":lgCtx", ":lgMD5"],
)
cc_library(
    name = "lgFile",
    srcs = ["lgFile.c"],
    strip_include_prefix = "/", deps = [":lgpio", ":lgDbg",":rgpiod", ":lgHdl"],
)
cc_library(
    name = "lgHdl",
    srcs = ["lgHdl.c"],
    hdrs = ["lgHdl.h"],
    strip_include_prefix = "/", deps = [":lgpio", ":lgDbg", ":lgCtx"],
)
cc_library(
    name = "lgI2C",
    srcs = ["lgI2C.c"],
    strip_include_prefix = "/", deps = [":lgpio", ":lgDbg", ":lgHdl"],
)
cc_library(
    name = "lgMD5",
    srcs = ["lgMD5.c"],
    hdrs = ["lgMD5.h"],
    strip_include_prefix = "/", deps = [":lgpio", ":lgDbg", ":lgCfg"],
)
cc_library(
    name = "lgNotify",
    srcs = ["lgNotify.c"],
    strip_include_prefix = "/", deps = [":lgpio", ":lgDbg", ":lgHdl"],
    
)
cc_library(
    name = "lgpio",
    hdrs = ["lgpio.h"],
    includes = ["."],
    strip_include_prefix = "/", 
)
cc_library(
    name = "lgPthAlerts",
    srcs = ["lgPthAlerts.c"],
    hdrs = ["lgPthAlerts.h","lgGpio.h"],
    strip_include_prefix = "/", deps = [":lgpio", ":lgDbg", ":lgHdl"],
)
cc_library(
    name = "lgPthSocket",
    srcs = ["lgPthSocket.c"],
    strip_include_prefix = "/", deps = [":lgpio", ":lgDbg",":rgpiod", ":lgHdl", ":lgCtx"],
)

cc_library(
    name = "lgPthTx",
    srcs = ["lgPthTx.c"],
    hdrs = ["lgPthTx.h", "lgGpio.h"],
    strip_include_prefix = "/", deps = [":lgpio", ":lgDbg", ":lgHdl"],
)

cc_library(
    name = "lgScript",
    srcs = ["lgScript.c"],
    strip_include_prefix = "/", deps = [":lgpio", ":lgDbg",":rgpiod", ":lgHdl", ":lgCmd", ":lgCtx"],
)
cc_library(
    name = "lgSerial",
    srcs = ["lgSerial.c"],
    strip_include_prefix = "/", deps = [":lgpio", ":lgDbg", ":lgHdl"],
)
cc_library(
    name = "lgSPI",
    srcs = ["lgSPI.c"],
    strip_include_prefix = "/", deps = [":lgpio", ":lgDbg", ":lgHdl"],
)
cc_library(
    name = "lgThread",
    srcs = ["lgThread.c"],
    strip_include_prefix = "/", deps = [":lgpio", ":lgDbg"],
)
cc_library(
    name = "lgUtil",
    srcs = ["lgUtil.c"],
    strip_include_prefix = "/", deps = [":lgpio", ":lgDbg"],
)
cc_library(
    name = "rgpio",
    hdrs = ["rgpio.h"],
    strip_include_prefix = "/", deps = [":lgpio", ":lgDbg",":rgpiod", ":lgCfg"],
)
cc_library(
    name = "rgpiod",
    hdrs = ["rgpiod.h", "lgCmd.h"],
    strip_include_prefix = "/", deps = [":lgpio", ":lgDbg"],
)
