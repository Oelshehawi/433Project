//Module for displaying information to the LCD screen
//Allows the user to print multiple lines of sufficiently short messages

#ifndef _LCD_DISPLAY_H_
#define _LCD_DISPLAY_H_
#ifdef __cplusplus
extern "C" {
#endif
typedef enum {
    lcd_center,
    lcd_top_left,
    lcd_top_right,
    lcd_bottom_left,
    lcd_bottom_right
}lcd_location;

typedef enum{
    font_regular,
}font_size;
//Module must be initialized before use and cleaned up after use
void lcd_init(void);
void lcd_cleanup(void);
void lcd_clear_screen(void);
//Takes in an array of strings and the length of the array,
//And prints each message on a seperate row in order of the array
void lcd_place_message(char** messages, int length, lcd_location location);
#ifdef __cplusplus
}
#endif
#endif
