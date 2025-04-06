// Sample rotary_push_state machine for one GPIO pin.

#include "rotary_press_statemachine.h"
#include <time.h>
#include "gpio.h"

#include <assert.h>
#include <stdlib.h>
#include <stdio.h>
#include <stdatomic.h>
#include <pthread.h>

// Pin config info: GPIO 24 (Rotary Encoder PUSH)
//   $ gpiofind GPIO24
//   >> gpiochip0 10
#define GPIO_CHIP          GPIO_CHIP_0
#define GPIO_LINE_NUMBER   10

//gpio5 = joystick push = gpiochip 2 15
static bool isInitialized = false;

static pthread_t rotary_press_thread;

struct GpioLine* s_rotaryBtn = NULL;
static atomic_int counter = 0;
static bool isRunning = false;
/*
    Define the Statemachine Data Structures
*/
struct stateEvent {
    struct rotary_push_state* pNextState;
    void (*action)();
};
struct rotary_push_state {
    struct stateEvent rising;
    struct stateEvent falling;
};

static long long getTimeInMs(void)
{
    long long MS_PER_SEC = 1000;
    long long NS_PER_MS = 1000000;
    struct timespec spec;
    clock_gettime(CLOCK_REALTIME, &spec);
    long long seconds = spec.tv_sec;
    long long nanoSeconds = spec.tv_nsec;
    long long milliSeconds = seconds * MS_PER_SEC
    + nanoSeconds / NS_PER_MS;
    return milliSeconds;
}
static int delay = 0;
/*
    START STATEMACHINE
*/
#define COOLDOWN 300
#define NUM_OPTIONS 3
static void on_release(void)
{   
    long long curr_time = getTimeInMs();
    if (curr_time - delay > COOLDOWN){
        counter = (counter +1);
        delay = curr_time;
    }
    
}

struct rotary_push_state rotary_push_states[] = {
    { // Not pressed
        .rising = {&rotary_push_states[0], NULL},
        .falling = {&rotary_push_states[1], NULL},
    },

    { // Pressed
        .rising = {&rotary_push_states[0], on_release},
        .falling = {&rotary_push_states[1], NULL},
    },
};
/*
    END STATEMACHINE
*/

struct rotary_push_state* rotary_pCurrentState = &rotary_push_states[0];


static void join_thread(){
    pthread_join(rotary_press_thread, NULL);
}


void rotary_press_statemachine_setValue(int value){
    if (value >= 0 && value <= 3){
        counter = value;
    }
}

int rotary_press_statemachine_getValue()
{
    return counter;
}

// TODO: This should be on a background thread!
static void* rotary_press_statemachine_doState()
{
    assert(isInitialized);

    //printf("\n\nWaiting for an event...\n");
    while (true) {
        struct gpiod_line_bulk bulkEvents;
        int numEvents = Gpio_waitForLineChange(s_rotaryBtn, NULL, &bulkEvents);

        // Iterate over the event
        for (int i = 0; i < numEvents; i++)
        {
            // Get the line handle for this event
            struct gpiod_line *line_handle = gpiod_line_bulk_get_line(&bulkEvents, i);

            // Get the number of this line
            unsigned int this_line_number = gpiod_line_offset(line_handle);

            // Get the line event
            struct gpiod_line_event event;
            if (gpiod_line_event_read(line_handle,&event) == -1) {
                perror("Line Event");
                exit(EXIT_FAILURE);
            }


            // Run the rotary_push_state machine
            bool isRising = event.event_type == GPIOD_LINE_EVENT_RISING_EDGE;

            // Can check with line it is, if you have more than one...
            bool isBtn = this_line_number == GPIO_LINE_NUMBER;
            assert (isBtn);

            struct stateEvent* pStateEvent = NULL;
            if (isRising) {
                pStateEvent = &rotary_pCurrentState->rising;
            } else {
                pStateEvent = &rotary_pCurrentState->falling;
            } 

            // Do the action
            if (pStateEvent->action != NULL) {
                pStateEvent->action();
            }
            rotary_pCurrentState = pStateEvent->pNextState;

            // DEBUG INFO ABOUT STATEMACHINE
            #if 0
            int newState = (rotary_pCurrentState - &rotary_push_states[0]);
            double time = event.ts.tv_sec + event.ts.tv_nsec / 1000000000.0;
            printf("rotary_push_state machine Debug: i=%d/%d  line num/dir = %d %8s -> new rotary_push_state %d     [%f]\n", 
                i, 
                numEvents,
                this_line_number, 
                isRising ? "RISING": "falling", 
                newState,
                time);
            #endif
        }
    }
    join_thread();
    return NULL;
}

void rotary_press_statemachine_init()
{
    assert(!isInitialized);
    Gpio_initialize();
    s_rotaryBtn = Gpio_openForEvents(GPIO_CHIP, GPIO_LINE_NUMBER);
    isInitialized = true;
    isRunning = true;
    pthread_create(&rotary_press_thread, NULL, rotary_press_statemachine_doState, NULL);
}
void rotary_press_statemachine_cleanup()
{
    assert(isInitialized);
    isInitialized = false;
    isRunning = false;
    pthread_cancel(rotary_press_thread);
    join_thread();
    Gpio_close(s_rotaryBtn, NULL);
}