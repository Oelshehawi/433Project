#include "camera_hal.h"
#include <iostream>

CameraHAL::CameraHAL(const std::string& device_path) : cameraDevice(device_path) {}

CameraHAL::~CameraHAL() {
    closeCamera();
}

bool CameraHAL::openCamera() {
    cap.open(cameraDevice, cv::CAP_V4L2); 
    if (!cap.isOpened()) {
        std::cerr << "Error: Could not open camera at " << cameraDevice << std::endl;
        return false;
    }
    cap.set(cv::CAP_PROP_BUFFERSIZE, 1);
    return true;
}

void CameraHAL::closeCamera() {
    if (cap.isOpened()) {
        cap.release();
    }
}

bool CameraHAL::captureFrame(cv::Mat &frame) {
    if (!cap.isOpened()) {
        return false;
    }
    return cap.read(frame);
}
