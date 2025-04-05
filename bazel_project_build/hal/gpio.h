// Low-level GPIO access using gpiod
//Taken from Dr Brian Fraser's State machine demo
//https://opencoursehub.cs.sfu.ca/bfraser/solutions/433/guide-code/rotary_encoder/
//Adapted to be able to read 2 lines simultaneously
#ifndef _GPIO_H_
#define _GPIO_H_
#define _POSIX_C_SOURCE 199309L
#include <time.h>
#include <sys/time.h>
#include <stdbool.h>

#include <gpiod.h>

// Opaque structure
struct GpioLine;

enum eGpioChips {
    GPIO_CHIP_0,
    GPIO_CHIP_1,
    GPIO_CHIP_2,
    GPIO_NUM_CHIPS      // Count of chips
};

// Must initialize before calling any other functions.
void Gpio_initialize(void);
void Gpio_cleanup(void);


// Opening a pin gives us a "line" that we later work with.
//  chip: such as GPIO_CHIP_0
//  pinNumber: such as 15
struct GpioLine* Gpio_openForEvents(enum eGpioChips chip, int pinNumber);
//Waits until it gets a reading/change from the I/O, returns the number of events
int Gpio_waitForLineChange(
    struct GpioLine* line1, 
    struct GpioLine* line2,
    struct gpiod_line_bulk *bulkEvents
);
//Cleans up the gpio system
void Gpio_close(struct GpioLine* line1, struct GpioLine* line2);

#endif