#include <gpiod.h>
#include <stdio.h>
#include <unistd.h>
#include <pthread.h>
#include "joystick_press.h"
#include "periodTimer.h"

#define GPIO_CHIP "/dev/gpiochip2"
#define GPIO_BUTTON 15

static struct gpiod_chip *chip;
static struct gpiod_line *button_line;
static pthread_t joystickThread;
static int keepRunning = 1;

static int isDetectingGesture = 0;

void joystick_toggle_detection() {
    isDetectingGesture = !isDetectingGesture;
}

int joystick_is_detecting() {
    return isDetectingGesture;
}

void joystick_press_init() {
    chip = gpiod_chip_open(GPIO_CHIP);
    if (!chip) {
        perror("Failed to open GPIO chip");
        return;
    }

    button_line = gpiod_chip_get_line(chip, GPIO_BUTTON);
    if (!button_line) {
        perror("Failed to get GPIO line");
        gpiod_chip_close(chip);
        return;
    }

    if (gpiod_line_request_input(button_line, "joystick_btn") < 0) {
        perror("Failed to request button line as input");
        gpiod_chip_close(chip);
        return;
    }

    if (pthread_create(&joystickThread, NULL, joystick_listener_push, NULL) != 0) {
        perror("Failed to create joystick thread");
    }
    pthread_detach(joystickThread);
}

void *joystick_listener_push(void *arg) {
    (void)arg;
    static int lastState = 1;
    static long lastPressTime = 0;

    while (keepRunning) {
        if (!button_line) continue;

        int currentState = gpiod_line_get_value(button_line);
        long currentTime = periodTimer_getCurrentTimeMs();

        if (lastState == 1 && currentState == 0) {
            if (currentTime - lastPressTime > 200) {
                lastPressTime = currentTime;
                lastState = currentState;

                joystick_toggle_detection();
            }
        }

        lastState = currentState;
        usleep(100000);
    }
    return NULL;
}

void joystick_press_cleanup() {
    keepRunning = 0;
    if (button_line) {
        gpiod_line_release(button_line);
    }
    if (chip) {
        gpiod_chip_close(chip);
    }
}
