#include "SoundManager.h"
#include <stdio.h>
#include <string.h>

static wavedata_t sound_attack;
static wavedata_t sound_build;
static wavedata_t sound_shield;

void SoundManager_init() {
    char path[256];

    strcpy(path, "/mnt/remote/mediapipe/sounds/attack_s16.wav");
    AudioMixer_readWaveFileIntoMemory(path, &sound_attack);

    strcpy(path, "/mnt/remote/mediapipe/sounds/build_s16.wav");
    AudioMixer_readWaveFileIntoMemory(path, &sound_build);

    strcpy(path, "/mnt/remote/mediapipe/sounds/shield_s16.wav");
    AudioMixer_readWaveFileIntoMemory(path, &sound_shield);

    printf("[SoundManager] Loaded all 3 sound files.\n");
}

void SoundManager_cleanup() {
    AudioMixer_freeWaveFileData(&sound_attack);
    AudioMixer_freeWaveFileData(&sound_build);
    AudioMixer_freeWaveFileData(&sound_shield);
    printf("[SoundManager] Freed all sound files.\n");
}

void SoundManager_playAttack() {
    AudioMixer_queueSound(&sound_attack);
}

void SoundManager_playBuild() {
    AudioMixer_queueSound(&sound_build);
}

void SoundManager_playShield() {
    AudioMixer_queueSound(&sound_shield);
}
