# CMPT 433 Project - Gesture Recognition

This C++ App uses Open CV for Gesture Recognition and communicates with a web application via UDP.

## Installation Requirements

### On Host (Development) System

1. **Cross-Compiler Toolchain**:

   ```
   sudo apt update
   sudo apt install crossbuild-essential-arm64
   ```

2. **OpenCV Development Libraries**:

   ```
   sudo apt update
   sudo apt install libopencv-dev
   ```

3. **CMake and Build Tools**:
   ```
   sudo apt install cmake g++ wget unzip
   ```

### On Target (BeagleBoard) System

1. **OpenCV Runtime Libraries**:

   ```
   sudo apt update
   sudo apt install libopencv-dev
   ```

2. **LGPIO for LCD Support (if needed)**:
   ```
   sudo apt install liblgpio-dev
   ```

## UDP Communication Setup

The application includes UDP communication to send gesture detection data to a web server:

1. The UDP sender in the C++ application sends messages to port 9090
2. Update the IP address in `app/src/udp_server.cpp` to match your server's IP
3. The web backend receives these messages and forwards them to the frontend via WebSockets

## Steps to test the webcam

When plugged into the bottom left USB port on the Beagle Board's USB Hub,
a USB Webcam can be accessed and tested as follows:

Step 1: Confirm Camera is Detected:

`(byai)$ ls /dev/video*`
or
`lsusb`

Step 2: Test the webcam by taking a screenshot and saving to a mounted folder
connected between the beagle board and the host VM.

`fswebcam -d /dev/video3 -r 640x480 --jpeg 85 /mnt/remote/pictures/test.jpg`

Step 3: Then check the mounted directory on host to see the image:

`ls -lh ~/cmpt433/public/pictures/`

## Web Application Setup

The project includes a web server and frontend application:

1. **Node.js Backend**:

   ```
   cd gesture-tower-server
   npm install
   npm run dev
   ```

2. **Next.js Frontend**:
   ```
   cd web-version
   npm install
   npm run dev
   ```

The web application displays UDP messages received from the C++ application in real-time.



