#include "udp_sender.h"
#include <arpa/inet.h>
#include <sys/socket.h>
#include <unistd.h>
#include <fstream>
#include <iostream>
#include <vector>
#include <cstring>  

UDPSender::UDPSender(const std::string& ip, int port)
    : ipAddress(ip), portNumber(port) {}

void UDPSender::sendMessage(const std::string& message) {
    int sock = socket(AF_INET, SOCK_DGRAM, 0);
    struct sockaddr_in serverAddr;

    memset(&serverAddr, 0, sizeof(serverAddr));
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_port = htons(portNumber);
    inet_pton(AF_INET, ipAddress.c_str(), &serverAddr.sin_addr);

    sendto(sock, message.c_str(), message.size(), 0,
           (struct sockaddr*)&serverAddr, sizeof(serverAddr));

    close(sock);
}

void UDPSender::sendFileWithText(const std::string& filename, const std::string& text) {
    int sock = socket(AF_INET, SOCK_DGRAM, 0);
    struct sockaddr_in serverAddr;
    memset(&serverAddr, 0, sizeof(serverAddr));
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_port = htons(portNumber);
    inet_pton(AF_INET, ipAddress.c_str(), &serverAddr.sin_addr);

    sendto(sock, text.c_str(), text.size(), 0, (struct sockaddr*)&serverAddr, sizeof(serverAddr));

    std::ifstream file(filename, std::ios::binary);
    if (!file) {
        close(sock);
        return;
    }

    std::vector<char> buffer((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
    file.close();

    sendto(sock, buffer.data(), buffer.size(), 0, (struct sockaddr*)&serverAddr, sizeof(serverAddr));

    close(sock);
}

//Takes in a uchar vector, which contains the image
//which can be obtained via the cv::imencode function
//eg: cv::imencode(".jpg", frame, dest);, where ".jpg" is image format,
//frame is a cv::Mat variable (Likely taken from the cameraHAL's captureFrame function),
//and dest is a uchar vector that stores the jpg image
//Does not have any protection against lost/out of order packets
void UDPSender::sendImageFile(std::vector<uchar> image){
    int sockfd;
    struct sockaddr_in servaddr; 
    if ( (sockfd = socket(AF_INET, SOCK_DGRAM, 0)) < 0 ) { 
        perror("socket creation failed"); 
        exit(EXIT_FAILURE); 
    }
    memset(&servaddr, 0, sizeof(servaddr));
    servaddr.sin_family = AF_INET; 
    servaddr.sin_port = htons(portNumber); 
    //#define PORT 8088
    //servaddr.sin_port = htons(PORT); 
    //Change if IP address, port is different
    inet_pton(AF_INET, "192.168.7.1", &servaddr.sin_addr);
    //Alter packet size if needed
    int info_len = 4;
    int size = 4096;
    int usable_size = size - info_len;
    //Lets server know that we are sending an img, so it knows how to handle the request
    //To distinguish it from other information that may be sent, eg. string describing the action
    uchar buf[size] = "img";
    //Not necessary if server distinguishes players by alternate means, i.e. ip
    int client_id = 1;//Should be determined by the server hosting the game
    buf[3] = '0' + client_id;
    int n;
    socklen_t len;
    int iterator = 0;
    int bufsize = 0;
    while (iterator < image.size()){
        if (image.size() - iterator > usable_size){
            memcpy(&buf[4], &image[iterator], usable_size);
            bufsize = size;
            iterator += usable_size;
        }else{
            int diff = image.size() - iterator;
            memcpy(&buf[4], &image[iterator], diff);
            bufsize = diff+info_len;
            iterator += diff;
        }
        sendto(sockfd, &buf, bufsize, 
            MSG_CONFIRM, (const struct sockaddr *) &servaddr,  
                sizeof(servaddr)); 
        //delay to make sure udp packets are sent in order, probably not necessary if done online vs locally
        usleep(1000);
    }
    //Lets server know that we have finished sending the file
    char msg[8] = "img fin";
    msg[3] = '0' + client_id;
    
    sendto(sockfd, msg, 8, 
    MSG_CONFIRM, (const struct sockaddr *) &servaddr,  
        sizeof(servaddr));  
    close(sockfd);
}
/*
node.js receiver snippit code:
var full_data_client_0 = [];
var counter_client_0 = 0;
function buildimage(image, client){
    if (image.slice(0,3) != "fin"){
        full_data_client_0.push(...image);
    }else if (image.slice(0,3) == 'fin'){
        //Do something with the data, here we save it as img
        const imageBuffer = Buffer.from(full_data_client_0);

        const filePath = './images/' + client.toString() + 'output' + counter_client_0.toString() +'.jpg';
        counter_client_0++;

        fs.writeFile(filePath, imageBuffer, (err) => {
            if (err) {
                console.error('Error writing the image to the file:', err);
            } else {
                console.log('Image successfully saved to', filePath);
            }
        });
        full_data_client_0 = [];  
    }}
//Receive message adapted to take in 'img' requests
server.on('message',function(msg,info){
    console.log(typeof(msg));
    console.log('Received %d bytes from %s:%d\n',msg.length, info.address, info.port);
    //Handle img packets specifically
    if (msg.slice(0,3) == 'img'){
        buildimage(msg.slice(4), msg.slice(3,4));
    }
    else{
        //do something else
    }
});
Can be used for testing using a sample udp server such as here: https://gist.github.com/sid24rane/6e6698e93360f2694e310dd347a2e2eb (replace lines 15-29)
*/