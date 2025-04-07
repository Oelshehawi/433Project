#!/bin/bash

# Navigate to the mediapipe directory (if not already there)
cd "$(dirname "$0")/.." || exit

# Make sure destination directory exists
mkdir -p ~/cmpt433/public/mediapipe

echo "Building project with Bazel..."
# Build the project using bazel
bazel build -c opt --crosstool_top=@crosstool//:toolchains --compiler=gcc --cpu=aarch64 --define MEDIAPIPE_DISABLE_GPU=1 //bazel_project_build:gesture_game

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "Build successful! Copying to ~/cmpt433/public/mediapipe..."
    
    # Copy the executable to the destination
    cp -f bazel-bin/bazel_project_build/gesture_game ~/cmpt433/public/mediapipe/
    
    # Make it executable
    chmod +x ~/cmpt433/public/mediapipe/gesture_game
    
    echo "Executable copied successfully!"
    echo "You can find it at: ~/cmpt433/public/mediapipe/gesture_game"
    echo "To run on your BeagleBoard, use: sudo ./gesture_game"
else
    echo "Build failed. No files were copied."
fi 