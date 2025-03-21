#include "gesture.h"
#include "udp_server.h"
#include <iostream>
#include <thread>

int main() {
    // Start UDP server in a separate thread
    std::thread udpThread(runUdpServer);
    udpThread.detach();  // Detach thread to run independently
    
    GestureDetector detector;
    detector.startDetection();

    std::cout << "Press ENTER to stop detection..." << std::endl;
    std::cin.get();

    detector.stopDetection();
    return 0;
}
