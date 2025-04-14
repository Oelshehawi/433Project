#ifndef SOUND_MANAGER_H
#define SOUND_MANAGER_H


#ifdef __cplusplus
extern "C" {
#endif

#include "audioMixer.h"

// Initializes all sounds
void SoundManager_init();

// Frees all allocated sound data
void SoundManager_cleanup();

// Play individual sounds
void SoundManager_playAttack();
void SoundManager_playBuild();
void SoundManager_playShield();


#ifdef __cplusplus
}
#endif

#endif
