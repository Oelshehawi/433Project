#ifndef SOUND_MANAGER_H
#define SOUND_MANAGER_H

#include "audioMixer.h"

// Initializes all sounds
void SoundManager_init();

// Frees all allocated sound data
void SoundManager_cleanup();

// Play individual sounds
void SoundManager_playAttack();
void SoundManager_playBuild();
void SoundManager_playShield();

#endif
