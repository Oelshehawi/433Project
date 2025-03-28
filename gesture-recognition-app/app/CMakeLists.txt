# CMakeLists.txt for App
# Build the application using the HAL

cmake_minimum_required(VERSION 3.18)

# Include necessary directories
include_directories(include)
include_directories(${CMAKE_SOURCE_DIR}/hal/include)

# 🔹 Find OpenCV
find_package(OpenCV REQUIRED)
include_directories(${OpenCV_INCLUDE_DIRS})

# Add nlohmann/json as a dependency
include(FetchContent)
FetchContent_Declare(
  json
  GIT_REPOSITORY https://github.com/nlohmann/json.git
  GIT_TAG v3.11.2
)
FetchContent_MakeAvailable(json)

# Collect all App source files
file(GLOB MY_SOURCES "src/*.cpp")

# Define the Executable
add_executable(gesture_recognition ${MY_SOURCES})

# Link Libraries
target_link_libraries(gesture_recognition LINK_PRIVATE hal)
target_link_libraries(gesture_recognition LINK_PRIVATE ${OpenCV_LIBS})
target_link_libraries(gesture_recognition LINK_PRIVATE pthread)
target_link_libraries(gesture_recognition LINK_PRIVATE nlohmann_json::nlohmann_json)

# Copy executable to NFS directory after build
add_custom_command(TARGET gesture_recognition POST_BUILD
    COMMAND "${CMAKE_COMMAND}" -E copy
        "$<TARGET_FILE:gesture_recognition>"
        "~/cmpt433/public/myApps/gesture_recognition"
    COMMENT "Copying ARM executable to public NFS directory"
)

