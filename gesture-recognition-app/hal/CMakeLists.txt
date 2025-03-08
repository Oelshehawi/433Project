# CMakeLists.txt for HAL
# Build a library (`hal`) which exposes the hardware abstraction layer

cmake_minimum_required(VERSION 3.18)

# Include necessary directories
include_directories(${CMAKE_SOURCE_DIR}/hal/include)

# Collect all HAL source files
file(GLOB MY_SOURCES "src/*.cpp")

# Define the HAL Library
add_library(hal STATIC ${MY_SOURCES})

# Ensure HAL headers are available
target_include_directories(hal PUBLIC include)
