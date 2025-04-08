
#ifndef _JOYSTICK_H_
#define _JOYSTICK_H_

#include <cstdint>

typedef enum {
    JOYSTICK_UP,
    JOYSTICK_DOWN,
    JOYSTICK_LEFT,
    JOYSTICK_RIGHT,
    JOYSTICK_NONE
} Joystick_dir;

void joystick_init(void);
void joystick_cleanup(void);

Joystick_dir joystick_get_dir(void);
int joystick_pressed(void);
uint16_t read_joystick_y(void);
uint16_t read_joystick_x(void); 
#endif
