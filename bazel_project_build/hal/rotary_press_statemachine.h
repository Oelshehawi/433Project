#ifndef _ROTARY_PRESS_STATEMACHINE_
#define _ROTARY_PRESS_STATEMACHINE_
#ifdef __cplusplus
extern "C" {
#endif
#define _POSIX_C_SOURCE 199309L
#include <time.h>
#include <stdbool.h>
//For recognizing the press feature of the rotary encoder
void rotary_press_statemachine_init(void);
void rotary_press_statemachine_cleanup(void);

//Get whether the rotary was pressed or not
int rotary_press_statemachine_getValue(void);
//Manually set the value of the rotary press encounter
void rotary_press_statemachine_setValue(int value);

#endif
#ifdef __cplusplus
}
#endif