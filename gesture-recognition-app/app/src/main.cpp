#include "gesture.h"
#include <iostream>

int main() {
    GestureDetector detector;
    detector.startDetection();

    std::cout << "Press ENTER to stop detection..." << std::endl;
    std::cin.get();

    detector.stopDetection();
    return 0;
}
