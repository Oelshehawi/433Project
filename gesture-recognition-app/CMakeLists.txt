# CMake Build Configuration for root of project
cmake_minimum_required(VERSION 3.18)

project(gesture_recognition_project VERSION 1.0
    DESCRIPTION "Gesture Recognition Project CMPT 433"
    LANGUAGES CXX)

# Set C++ Standard
set(CMAKE_CXX_STANDARD 17)

# Enable warnings
add_compile_options(-Wall -Wpedantic -Wextra)

# Enable Address Sanitizer (for debugging)
add_compile_options(-fsanitize=address)
add_link_options(-fsanitize=address)

# Enable pthread library
add_compile_options(-pthread)
add_link_options(-pthread)

set(OpenCV_DIR "/usr/lib/aarch64-linux-gnu/cmake/opencv4/") 

# Find and Include OpenCV
find_package(OpenCV REQUIRED)
include_directories(${OpenCV_INCLUDE_DIRS})

set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR aarch64)
set(CMAKE_C_COMPILER /usr/bin/aarch64-linux-gnu-gcc)
set(CMAKE_CXX_COMPILER /usr/bin/aarch64-linux-gnu-g++)

# Add project subdirectories
add_subdirectory(hal)
add_subdirectory(app)

# Include HAL globally
include_directories(hal/include)
