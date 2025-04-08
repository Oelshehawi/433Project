#ifndef _JOYSTICK_PRESS_H_
#define _JOYSTICK_PRESS_H_

void joystick_press_init();
void* joystick_listener_push(void* arg);
void joystick_press_cleanup();

// track ON/OFF state for start/stop command
// For toggling gesture detection
void joystick_toggle_detection();
int joystick_is_detecting();

#endif
