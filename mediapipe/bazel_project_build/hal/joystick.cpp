#define DEBOUNCE_DELAY_MS 50  
#include "joystick.h"
#include <gpiod.h>
#include <stdlib.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/ioctl.h>
#include <linux/i2c-dev.h>
#include <stdio.h>
#include <string.h>
#include <time.h>
#include <cstdint>

#define I2C_BUS "/dev/i2c-1"
#define I2C_DEVICE_ADDRESS 0x48
#define REG_CONVERSION 0x00  
#define REG_CONFIG 0x01
#define MUX_CHANNEL_Y 0x83C2
#define MUX_CHANNEL_X 0x93C2  

static int i2c_file_desc;

void joystick_init(void) {
    i2c_file_desc = open(I2C_BUS, O_RDWR);
    if (i2c_file_desc == -1) {
        perror("Unable to open I2C bus");
        exit(EXIT_FAILURE);
    }

    if (ioctl(i2c_file_desc, I2C_SLAVE, I2C_DEVICE_ADDRESS) == -1) {
        perror("Unable to set I2C device to slave address");
        exit(EXIT_FAILURE);
    }
}

static void write_i2c_reg16(int i2c_file_desc, uint8_t reg_addr, uint16_t value) {
    uint8_t buffer[3] = {reg_addr, (value >> 8) & 0xFF, value & 0xFF};
    if (write(i2c_file_desc, buffer, 3) != 3) {
        perror("Unable to write I2C register");
        exit(EXIT_FAILURE);
    }
}

int16_t read_i2c_reg16(int fd, uint8_t reg_addr) {
    if (write(fd, &reg_addr, 1) != 1) {
        perror("I2C: Unable to write register address");
        exit(EXIT_FAILURE);
    }

    uint8_t data[2];
    if (read(fd, data, 2) != 2) {
        perror("I2C: Unable to read register");
        exit(EXIT_FAILURE);
    }

    uint16_t raw_value = (data[0] << 8) | data[1];
    return raw_value >> 4;  // Right-align 12-bit
}

uint16_t read_joystick_y() {
    write_i2c_reg16(i2c_file_desc, REG_CONFIG, MUX_CHANNEL_Y);
    return read_i2c_reg16(i2c_file_desc, REG_CONVERSION);
}

uint16_t read_joystick_x() {
    write_i2c_reg16(i2c_file_desc, REG_CONFIG, MUX_CHANNEL_X);
    return read_i2c_reg16(i2c_file_desc, REG_CONVERSION);
}

Joystick_dir joystick_get_dir(void) {
    int x = read_joystick_x();
    int y = read_joystick_y();

    if (x < 1000) return JOYSTICK_LEFT;
    if (x > 3000) return JOYSTICK_RIGHT;
    if (y < 1000) return JOYSTICK_UP;
    if (y > 3000) return JOYSTICK_DOWN;
    return JOYSTICK_NONE;
}

void joystick_cleanup(void) {
    close(i2c_file_desc);
}




