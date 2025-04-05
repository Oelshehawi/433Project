#ifndef CAMERA_HAL_H
#define CAMERA_HAL_H

#include <opencv2/opencv.hpp>

class CameraHAL {
public:
    explicit CameraHAL(const std::string& device_path = "/dev/video3");
    ~CameraHAL();

    bool openCamera();
    void closeCamera();
    bool captureFrame(cv::Mat &frame);

private:
    std::string cameraDevice;
    cv::VideoCapture cap;
};

#endif
