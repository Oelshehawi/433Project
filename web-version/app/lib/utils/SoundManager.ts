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

/**
 * Class that manages sound effects for the game
 */
class SoundManagerInstance {
  private audioElements: Map<SoundEffect, HTMLAudioElement> = new Map();
  private volume: number = 1.0;
  private muted: boolean = false;
  private initialized: boolean = false;
  private backgroundMusic: HTMLAudioElement | null = null;

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

    const audio = this.audioElements.get(effect);
    if (!audio) return;

    // Reset to beginning and play
    audio.currentTime = 0;
    audio.volume = this.volume;

    audio.play().catch(() => {
      // Silently fail if audio doesn't play
      // This can happen due to browser autoplay policies
    });
  }

  /**
   * Play background music in a loop
   */
  public playBackgroundMusic(): void {
    if (this.muted || !this.backgroundMusic) return;
    
    // Set a lower volume for background music
    this.backgroundMusic.volume = this.volume * 0.3;
    
    this.backgroundMusic.play().catch(() => {
      // Silently fail if audio doesn't play due to browser autoplay policies
      console.warn('Failed to play background music automatically due to browser policies');
    });
  }

  /**
   * Stop background music
   */
  public stopBackgroundMusic(): void {
    if (this.backgroundMusic) {
      this.backgroundMusic.pause();
      this.backgroundMusic.currentTime = 0;
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
      // Background music has lower volume
      if (effect === SoundEffect.BACKGROUND) {
        audio.volume = this.volume * 0.3;
      } else {
        audio.volume = this.volume;
      }
    });
  }

  /**
   * Mute all sound effects
   */
  public mute(): void {
    this.muted = true;
    if (this.backgroundMusic) {
      this.backgroundMusic.pause();
    }
  }

  /**
   * Unmute all sound effects
   */
  public unmute(): void {
    this.muted = false;
    if (this.backgroundMusic && this.backgroundMusic.paused) {
      this.backgroundMusic.play().catch(() => {
        // Silently fail if audio doesn't play
      });
    }
  }

  /**
   * Toggle mute state
   * @returns The new mute state
   */
  public toggleMute(): boolean {
    this.muted = !this.muted;
    
    if (this.muted && this.backgroundMusic) {
      this.backgroundMusic.pause();
    } else if (!this.muted && this.backgroundMusic) {
      this.backgroundMusic.play().catch(() => {
        // Silently fail if audio doesn't play
      });
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
   * Dispose of all audio elements
   */
  public dispose(): void {
    // Stop background music
    if (this.backgroundMusic) {
      this.backgroundMusic.pause();
      this.backgroundMusic = null;
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
    SoundManager.playBackgroundMusic();
  };

  // Function to stop background music
  const stopBackgroundMusic = () => {
    SoundManager.stopBackgroundMusic();
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
    changeVolume,
    toggleMute,
    isMuted,
    volume,
  };
}
