/*
#include "../lcd/lib/Config/DEV_Config.h"
#include "../lcd/lib/LCD/LCD_1in54.h"
#include "../lcd/lib/GUI/GUI_Paint.h"
#include "../lcd/lib/GUI/GUI_BMP.h"
*/
#include "../lcd/lib/Config/DEV_Config.h"
#include "../lcd/lib/LCD/LCD_1in54.h"
#include "../lcd/lib/GUI/GUI_Paint.h"
#include "../lcd/lib/GUI/GUI_BMP.h"
#include <stdio.h>		//printf()
#include <stdlib.h>		//exit()
#include <signal.h>     //signal()
#include <stdbool.h>
#include <assert.h>
#include <stdio.h>
#include <stdbool.h>
#include "lcd_display.h"
#include <string.h>
static UWORD *s_fb;
static bool lcd_initialized = false;

//Taken and (slightly) adapted from Dr Brian Frasers demo code
//https://opencoursehub.cs.sfu.ca/bfraser/solutions/433/04-BuildingSoftware/

#define TOP_LEFT_EDGE 5
#define RIGHT_EDGE 190
#define BOTTOM_EDGE 200
#define CENTER 100
#define FONT_SMALL_WIDTH 7
#define FONT_REGULAR_WIDTH 11
#define FONT_LARGE_WIDTH 17
#define FONT_SMALL_HEIGHT 12
#define FONT_REGULAR_HEIGHT  16
#define FONT_LARGE_HEIGHT  24
#define OFFSET_SMALL  17
#define OFFSET_REGULAR 21
#define OFFSET_LARGE 29

//From the example LCD code
void lcd_init(){
    assert(!lcd_initialized);
    // Exception handling:ctrl + c
    // signal(SIGINT, Handler_1IN54_LCD);
    
    // Module Init
	if(DEV_ModuleInit() != 0){
        DEV_ModuleExit();
        exit(0);
    }
	
    // LCD Init
    DEV_Delay_ms(2000);
    printf("t\n");
	LCD_1IN54_Init(HORIZONTAL);
	LCD_1IN54_Clear(WHITE);
	LCD_SetBacklight(1023);

    UDOUBLE Imagesize = LCD_1IN54_HEIGHT*LCD_1IN54_WIDTH*2;
    if((s_fb = (UWORD *)malloc(Imagesize)) == NULL) {
        perror("Failed to apply for black memory");
        exit(0);
    }
    lcd_initialized = true;
}

void lcd_clear_screen(){
    LCD_1IN54_Clear(WHITE);
}

void lcd_cleanup()
{
    assert(lcd_initialized);
    //LCD_1IN54_Clear(BLACK);
    // Module Exit
    free(s_fb);
    s_fb = NULL;
	DEV_ModuleExit();
    lcd_initialized = false;
}

typedef struct{
    int x;
    int y;
}message_size;

static int getCenter(char * message){
    int length = strlen(message);
    int width;

            width = FONT_REGULAR_WIDTH;

    return (LCD_1IN54_WIDTH - (length * width)) / 2;
}

static message_size get_message_size(char* message){
    int length = strlen(message);
    int width;
    int height;

    width = FONT_REGULAR_WIDTH;
    height = FONT_REGULAR_HEIGHT;

    message_size ret;
    ret.x = width * length;
    ret.y = height;
    return ret;
}

void lcd_place_message(char** messages, int length, lcd_location location){
    int x;
    int y;
    assert(lcd_initialized);
    // Initialize the RAM frame buffer to be blank (white)
    int DEFAULT_DEPTH = 16;
    Paint_NewImage(s_fb, LCD_1IN54_WIDTH, LCD_1IN54_HEIGHT, 0, WHITE, DEFAULT_DEPTH);
    Paint_Clear(WHITE);
    int offset;

    offset = OFFSET_REGULAR;

    int x_clear = TOP_LEFT_EDGE;
    for (int i = 0; i < length; i++){
        switch (location){
            case lcd_center://Center
                x = getCenter(messages[i]);
                y = CENTER + (offset*i);
                x_clear = x;
                break;
            case lcd_top_left://Top Left
                x = TOP_LEFT_EDGE;
                y = TOP_LEFT_EDGE + (offset*i);
                break;
            case lcd_top_right: //Top Right
                x = RIGHT_EDGE ;
                y = TOP_LEFT_EDGE + (offset*i);
                break;
            case lcd_bottom_left: //Bottom left
                x = TOP_LEFT_EDGE;
                y = BOTTOM_EDGE + (offset*i);
                break;
            case lcd_bottom_right: //Bottom right
                x = RIGHT_EDGE;
                y = BOTTOM_EDGE + (offset*i);
                break;
            default:    //Center
                x = getCenter(messages[i]);
                y = CENTER + (offset*i);
                break;
            }

        message_size curr_size = get_message_size(messages[i]);
        Paint_DrawString_EN(x, y, messages[i], &Font16, WHITE, BLACK);
        LCD_1IN54_DisplayWindows(x-x_clear, y, x+curr_size.x+30, y+curr_size.y, s_fb);
       
    }
    return;
}



