import { useEffect, useState } from 'react';

/**
 * Enum of available sound effects
 */
export enum SoundEffect {
  SHIELD = 'shield',
  ATTACK = 'attack',
  BUILD = 'build',
}

/**
 * Map of sound effect paths
 */
const SOUND_PATHS: Record<SoundEffect, string> = {
  [SoundEffect.SHIELD]: '/sounds/shield.mp3',
  [SoundEffect.ATTACK]: '/sounds/attack.mp3',
  [SoundEffect.BUILD]: '/sounds/build.mp3',
};

/**
 * Class that manages sound effects for the game
 */
class SoundManagerInstance {
  private audioElements: Map<SoundEffect, HTMLAudioElement> = new Map();
  private volume: number = 1.0;
  private muted: boolean = false;
  private initialized: boolean = false;

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
   * Set the volume for all sound effects
   * @param volume Volume level (0.0 to 1.0)
   */
  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));

    // Update volume for all audio elements
    this.audioElements.forEach((audio) => {
      audio.volume = this.volume;
    });
  }

  /**
   * Mute all sound effects
   */
  public mute(): void {
    this.muted = true;
  }

  /**
   * Unmute all sound effects
   */
  public unmute(): void {
    this.muted = false;
  }

  /**
   * Toggle mute state
   * @returns The new mute state
   */
  public toggleMute(): boolean {
    this.muted = !this.muted;
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
    };
  }, []);

  // Function to play a sound
  const playSound = (effect: SoundEffect) => {
    SoundManager.playSound(effect);
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
    changeVolume,
    toggleMute,
    isMuted,
    volume,
  };
}
