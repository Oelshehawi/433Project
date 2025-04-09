import { useEffect, useState } from 'react';

/**
 * Enum of available sound effects
 */
export enum SoundEffect {
  SHIELD = 'shield',
  ATTACK = 'attack',
  BUILD = 'build',
  BACKGROUND = 'background noise',
}

/**
 * Map of sound effect paths
 */
const SOUND_PATHS: Record<SoundEffect, string> = {
  [SoundEffect.SHIELD]: '/sounds/shield.mp3',
  [SoundEffect.ATTACK]: '/sounds/attack.mp3',
  [SoundEffect.BUILD]: '/sounds/build.mp3',
  [SoundEffect.BACKGROUND]: '/sounds/background noise.mp3',
};

// Keep track of when sounds were last played to prevent too many repeated plays
const soundLastPlayedTime: Record<SoundEffect, number> = {
  [SoundEffect.SHIELD]: 0,
  [SoundEffect.ATTACK]: 0,
  [SoundEffect.BUILD]: 0,
  [SoundEffect.BACKGROUND]: 0,
};

// Minimum time between playing the same sound (in ms)
const SOUND_COOLDOWN = 200;

/**
 * Class that manages sound effects for the game
 */
class SoundManagerInstance {
  private audioElements: Map<SoundEffect, HTMLAudioElement> = new Map();
  private volume: number = 1.0;
  private muted: boolean = false;
  private initialized: boolean = false;
  private backgroundMusic: HTMLAudioElement | null = null;
  private backgroundMusicPlaying: boolean = false;

  /**
   * Initialize sound effects by creating audio elements
   */
  public initialize(): void {
    if (typeof Audio === 'undefined' || this.initialized) return;

    this.initialized = true;

    // Create audio elements for each sound effect
    Object.values(SoundEffect).forEach((effect) => {
      const audio = new Audio(SOUND_PATHS[effect]);
      audio.preload = 'auto';

      // Configure the background music to loop
      if (effect === SoundEffect.BACKGROUND) {
        audio.loop = true;
        audio.volume = 0.3; // Lower volume for background music
        this.backgroundMusic = audio;
      }

      this.audioElements.set(effect, audio);
    });
  }

  /**
   * Play a sound effect
   * @param effect The sound effect to play
   */
  public playSound(effect: SoundEffect): void {
    if (this.muted) return;

    // Check cooldown to prevent rapid repeated plays of the same sound
    const now = Date.now();
    if (now - soundLastPlayedTime[effect] < SOUND_COOLDOWN) {
      return;
    }

    // Update last played time
    soundLastPlayedTime[effect] = now;

    const audio = this.audioElements.get(effect);
    if (!audio) return;

    // Don't try to restart background music if it's already playing
    if (effect === SoundEffect.BACKGROUND && this.backgroundMusicPlaying) {
      return;
    }

    // Reset to beginning and play
    try {
      // For background music, don't reset if already playing
      if (effect !== SoundEffect.BACKGROUND) {
        audio.currentTime = 0;
      }

      audio.volume =
        effect === SoundEffect.BACKGROUND
          ? this.volume * 0.3 // Lower volume for background music
          : this.volume;

      // Only call play() if audio is paused to prevent overlapping plays
      if (audio.paused) {
        audio
          .play()
          .then(() => {
            if (effect === SoundEffect.BACKGROUND) {
              this.backgroundMusicPlaying = true;
            }
          })
          .catch((error) => {
            console.warn('Failed to play sound:', effect, error);
          });
      }
    } catch (error) {
      console.warn('Error playing sound:', effect, error);
    }
  }

  /**
   * Play background music in a loop
   */
  public playBackgroundMusic(): void {
    if (this.muted) return;

    // If already playing, don't try to restart
    if (
      this.backgroundMusicPlaying &&
      this.backgroundMusic &&
      !this.backgroundMusic.paused
    ) {
      return;
    }

    // Set a lower volume for background music
    try {
      if (!this.backgroundMusic) {
        if (!this.initialized) {
          this.initialize();
        }
        // Recreate the background music element if it doesn't exist
        const audio = new Audio(SOUND_PATHS[SoundEffect.BACKGROUND]);
        audio.loop = true;
        audio.volume = this.volume * 0.3;
        this.backgroundMusic = audio;
        this.audioElements.set(SoundEffect.BACKGROUND, audio);
      }

      // Set volume explicitly before playing
      this.backgroundMusic.volume = this.volume * 0.3;

      // Ensure it's set to loop
      this.backgroundMusic.loop = true;

      // Reset to beginning if it was stopped
      if (this.backgroundMusic.paused) {
        this.backgroundMusic.currentTime = 0;
      }

      // Try to play with improved error handling
      const playPromise = this.backgroundMusic.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            this.backgroundMusicPlaying = true;
            console.log('Background music started playing successfully');
          })
          .catch((error) => {
            console.warn('Failed to play background music:', error);
            this.backgroundMusicPlaying = false;
          });
      } else {
        // For older browsers that don't return a promise
        this.backgroundMusicPlaying = true;
      }
    } catch (error) {
      console.warn('Error playing background music:', error);
      this.backgroundMusicPlaying = false;
    }
  }

  /**
   * Stop background music
   */
  public stopBackgroundMusic(): void {
    if (this.backgroundMusic) {
      try {
        this.backgroundMusic.pause();
        this.backgroundMusic.currentTime = 0;
        this.backgroundMusicPlaying = false;
      } catch (error) {
        console.warn('Error stopping background music:', error);
      }
    }
  }

  /**
   * Set the volume for all sound effects
   * @param volume Volume level (0.0 to 1.0)
   */
  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));

    // Update volume for all audio elements
    this.audioElements.forEach((audio, effect) => {
      try {
        // Background music has lower volume
        if (effect === SoundEffect.BACKGROUND) {
          audio.volume = this.volume * 0.3;
        } else {
          audio.volume = this.volume;
        }
      } catch (error) {
        console.warn('Error setting volume:', effect, error);
      }
    });
  }

  /**
   * Mute all sound effects
   */
  public mute(): void {
    this.muted = true;
    if (this.backgroundMusic && this.backgroundMusicPlaying) {
      try {
        this.backgroundMusic.pause();
        this.backgroundMusicPlaying = false;
      } catch (error) {
        console.warn('Error muting background music:', error);
      }
    }
  }

  /**
   * Unmute all sound effects
   */
  public unmute(): void {
    this.muted = false;
    if (this.backgroundMusic && !this.backgroundMusicPlaying) {
      try {
        this.backgroundMusic
          .play()
          .then(() => {
            this.backgroundMusicPlaying = true;
          })
          .catch(() => {
            // Silently fail if audio doesn't play
          });
      } catch (error) {
        console.warn('Error unmuting background music:', error);
      }
    }
  }

  /**
   * Toggle mute state
   * @returns The new mute state
   */
  public toggleMute(): boolean {
    this.muted = !this.muted;

    try {
      if (this.muted && this.backgroundMusic && this.backgroundMusicPlaying) {
        this.backgroundMusic.pause();
        this.backgroundMusicPlaying = false;
      } else if (
        !this.muted &&
        this.backgroundMusic &&
        !this.backgroundMusicPlaying
      ) {
        this.backgroundMusic
          .play()
          .then(() => {
            this.backgroundMusicPlaying = true;
          })
          .catch(() => {
            // Silently fail if audio doesn't play
          });
      }
    } catch (error) {
      console.warn('Error toggling mute state:', error);
    }

    return this.muted;
  }

  /**
   * Check if a sound is loaded
   * @param effect The sound effect to check
   * @returns True if the sound is loaded
   */
  public isSoundLoaded(effect: SoundEffect): boolean {
    return this.audioElements.has(effect);
  }

  /**
   * Check if background music is currently playing
   * @returns True if background music is playing
   */
  public isBackgroundMusicPlaying(): boolean {
    return this.backgroundMusicPlaying;
  }

  /**
   * Dispose of all audio elements
   */
  public dispose(): void {
    // Stop background music
    if (this.backgroundMusic) {
      try {
        this.backgroundMusic.pause();
        this.backgroundMusicPlaying = false;
        this.backgroundMusic = null;
      } catch (error) {
        console.warn('Error disposing background music:', error);
      }
    }

    this.audioElements.clear();
    this.initialized = false;
  }
}

// Create a singleton instance
export const SoundManager = new SoundManagerInstance();

/**
 * React hook for using the SoundManager in components
 */
export function useSoundManager() {
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1.0);

  useEffect(() => {
    // Initialize sound manager on component mount
    SoundManager.initialize();

    // Clean up on component unmount
    return () => {
      // No need to dispose since it's a singleton
      // But we should stop background music
      SoundManager.stopBackgroundMusic();
    };
  }, []);

  // Function to play a sound
  const playSound = (effect: SoundEffect) => {
    SoundManager.playSound(effect);
  };

  // Function to play background music
  const playBackgroundMusic = () => {
    console.log('Attempting to play background music');
    SoundManager.playBackgroundMusic();
  };

  // Function to stop background music
  const stopBackgroundMusic = () => {
    SoundManager.stopBackgroundMusic();
  };

  // Function to check if background music is playing
  const isBackgroundMusicPlaying = () => {
    return SoundManager.isBackgroundMusicPlaying();
  };

  // Function to change volume
  const changeVolume = (newVolume: number) => {
    SoundManager.setVolume(newVolume);
    setVolume(newVolume);
  };

  // Function to toggle mute
  const toggleMute = () => {
    const newMuteState = SoundManager.toggleMute();
    setIsMuted(newMuteState);
    return newMuteState;
  };

  return {
    playSound,
    playBackgroundMusic,
    stopBackgroundMusic,
    isBackgroundMusicPlaying,
    changeVolume,
    toggleMute,
    isMuted,
    volume,
  };
}
