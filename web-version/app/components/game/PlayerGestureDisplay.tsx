import React, { useState, useEffect } from 'react';
import ShieldEffect from './ShieldEffect';
import AttackAnimation from './AttackAnimation';
import ExplosionEffect from './ExplosionEffect';
import { useGameStore } from '../../lib/game/store';
import { useSoundManager, SoundEffect } from '../../lib/utils/SoundManager';

interface PlayerGestureDisplayProps {
  player1CardPlayed: string;
  player2CardPlayed: string;
  player1ShieldActive: boolean;
  player2ShieldActive: boolean;
  gameState: 'starting' | 'playing';
  // New props for animation control from parent
  onPlayer1AttackComplete?: () => void;
  onPlayer2AttackComplete?: () => void;
  // Props for animation visibility control
  player1AttackVisible?: boolean;
  player2AttackVisible?: boolean;
  setPlayer1AttackVisible?: (visible: boolean) => void;
  setPlayer2AttackVisible?: (visible: boolean) => void;
  player1Explosion?: boolean;
  player2Explosion?: boolean;
  setPlayer1Explosion?: (visible: boolean) => void;
  setPlayer2Explosion?: (visible: boolean) => void;
}

const PlayerGestureDisplay = ({
  player1CardPlayed,
  player2CardPlayed,
  player1ShieldActive,
  player2ShieldActive,
  gameState,
  // New props with defaults
  onPlayer1AttackComplete,
  onPlayer2AttackComplete,
  player1AttackVisible: externalPlayer1AttackVisible,
  player2AttackVisible: externalPlayer2AttackVisible,
  setPlayer1AttackVisible: externalSetPlayer1AttackVisible,
  setPlayer2AttackVisible: externalSetPlayer2AttackVisible,
  player1Explosion: externalPlayer1Explosion,
  player2Explosion: externalPlayer2Explosion,
  setPlayer1Explosion: externalSetPlayer1Explosion,
  setPlayer2Explosion: externalSetPlayer2Explosion,
}: PlayerGestureDisplayProps) => {
  // Using our sound manager hook instead of managing audio elements directly
  const { playSound } = useSoundManager();

  // Attack animation states - use external state if provided, otherwise use local state
  const [localPlayer1AttackVisible, setLocalPlayer1AttackVisible] =
    useState(false);
  const [localPlayer2AttackVisible, setLocalPlayer2AttackVisible] =
    useState(false);
  const [localPlayer1Explosion, setLocalPlayer1Explosion] = useState(false);
  const [localPlayer2Explosion, setLocalPlayer2Explosion] = useState(false);

  // Use provided state from parent if available, otherwise use local state
  const player1AttackVisible =
    externalPlayer1AttackVisible !== undefined
      ? externalPlayer1AttackVisible
      : localPlayer1AttackVisible;
  const player2AttackVisible =
    externalPlayer2AttackVisible !== undefined
      ? externalPlayer2AttackVisible
      : localPlayer2AttackVisible;
  const player1Explosion =
    externalPlayer1Explosion !== undefined
      ? externalPlayer1Explosion
      : localPlayer1Explosion;
  const player2Explosion =
    externalPlayer2Explosion !== undefined
      ? externalPlayer2Explosion
      : localPlayer2Explosion;

  // Functions to set state, will use external setters if provided
  const setPlayer1AttackVisible = (visible: boolean) => {
    if (externalSetPlayer1AttackVisible) {
      externalSetPlayer1AttackVisible(visible);
    } else {
      setLocalPlayer1AttackVisible(visible);
    }
  };

  const setPlayer2AttackVisible = (visible: boolean) => {
    if (externalSetPlayer2AttackVisible) {
      externalSetPlayer2AttackVisible(visible);
    } else {
      setLocalPlayer2AttackVisible(visible);
    }
  };

  const setPlayer1Explosion = (visible: boolean) => {
    if (externalSetPlayer1Explosion) {
      externalSetPlayer1Explosion(visible);
    } else {
      setLocalPlayer1Explosion(visible);
    }
  };

  const setPlayer2Explosion = (visible: boolean) => {
    if (externalSetPlayer2Explosion) {
      externalSetPlayer2Explosion(visible);
    } else {
      setLocalPlayer2Explosion(visible);
    }
  };

  // Shield glow states
  const [player1ShieldGlow, setPlayer1ShieldGlow] = useState(0);
  const [player2ShieldGlow, setPlayer2ShieldGlow] = useState(0);

  // Get tower heights from game store
  const { player1TowerHeight, player2TowerHeight } = useGameStore();

  // Normalize card played strings for case-insensitive comparison
  const normalizedPlayer1Card = player1CardPlayed?.toLowerCase() || '';
  const normalizedPlayer2Card = player2CardPlayed?.toLowerCase() || '';

  // Play shield sound when shield is activated
  useEffect(() => {
    if (player1ShieldActive && normalizedPlayer1Card === 'defend') {
      playSound(SoundEffect.SHIELD);
    }
  }, [player1ShieldActive, normalizedPlayer1Card, playSound]);

  useEffect(() => {
    if (player2ShieldActive && normalizedPlayer2Card === 'defend') {
      playSound(SoundEffect.SHIELD);
    }
  }, [player2ShieldActive, normalizedPlayer2Card, playSound]);

  // Play build sound when build is played
  useEffect(() => {
    if (
      normalizedPlayer1Card === 'build' ||
      normalizedPlayer2Card === 'build'
    ) {
      playSound(SoundEffect.BUILD);
    }
  }, [normalizedPlayer1Card, normalizedPlayer2Card, playSound]);

  // Handle attack animation completion
  const handlePlayer1AttackComplete = () => {
    setPlayer1AttackVisible(false);

    // Only show explosion if shield is not active
    if (!player2ShieldActive) {
      setPlayer2Explosion(true);
    } else {
      // Reset shield glow with delay
      setTimeout(() => {
        setPlayer2ShieldGlow(0);
      }, 300);
    }

    // Call parent callback if provided
    if (onPlayer1AttackComplete) {
      onPlayer1AttackComplete();
    }
  };

  const handlePlayer2AttackComplete = () => {
    setPlayer2AttackVisible(false);

    // Only show explosion if shield is not active
    if (!player1ShieldActive) {
      setPlayer1Explosion(true);
    } else {
      // Reset shield glow with delay
      setTimeout(() => {
        setPlayer1ShieldGlow(0);
      }, 300);
    }

    // Call parent callback if provided
    if (onPlayer2AttackComplete) {
      onPlayer2AttackComplete();
    }
  };

  // Handle explosion animation completion
  const handleExplosionComplete = () => {
    setPlayer1Explosion(false);
    setPlayer2Explosion(false);
  };

  // Listen for player1 attack gestures - only use if not controlled by parent
  useEffect(() => {
    // Skip if parent is controlling animation state
    if (externalPlayer1AttackVisible !== undefined) return;

    let glowInterval: NodeJS.Timeout | null = null;

    // Attack detection for Player 1
    if (normalizedPlayer1Card === 'attack' && !player1AttackVisible) {
      // Play attack sound
      playSound(SoundEffect.ATTACK);

      // Show attack animation
      setPlayer1AttackVisible(true);

      // If player 2 has shield, gradually increase glow intensity
      if (player2ShieldActive) {
        // Store interval reference for cleanup
        glowInterval = setInterval(() => {
          setPlayer2ShieldGlow((prev) => {
            const newValue = prev + 0.1;
            return newValue > 1 ? 1 : newValue;
          });
        }, 100);
      }
    }

    // Cleanup function to clear interval
    return () => {
      if (glowInterval) {
        clearInterval(glowInterval);
      }
    };
  }, [
    normalizedPlayer1Card,
    player1AttackVisible,
    player2ShieldActive,
    playSound,
    externalPlayer1AttackVisible,
  ]);

  // Listen for player2 attack gestures - only use if not controlled by parent
  useEffect(() => {
    // Skip if parent is controlling animation state
    if (externalPlayer2AttackVisible !== undefined) return;

    let glowInterval: NodeJS.Timeout | null = null;

    // Attack detection for Player 2
    if (normalizedPlayer2Card === 'attack' && !player2AttackVisible) {
      // Play attack sound
      playSound(SoundEffect.ATTACK);

      // Show attack animation
      setPlayer2AttackVisible(true);

      // If player 1 has shield, gradually increase glow intensity
      if (player1ShieldActive) {
        // Store interval reference for cleanup
        glowInterval = setInterval(() => {
          setPlayer1ShieldGlow((prev) => {
            const newValue = prev + 0.1;
            return newValue > 1 ? 1 : newValue;
          });
        }, 100);
      }
    }

    // Cleanup function to clear interval
    return () => {
      if (glowInterval) {
        clearInterval(glowInterval);
      }
    };
  }, [
    normalizedPlayer2Card,
    player2AttackVisible,
    player1ShieldActive,
    playSound,
    externalPlayer2AttackVisible,
  ]);

  // Debug state to make sure component is rendering
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [componentMounted, setComponentMounted] = useState(false);
  useEffect(() => {
    setComponentMounted(true);
    return () => setComponentMounted(false);
  }, []);

  if (gameState !== 'playing') return null;

  return (
    <>
      {/* Card played messages */}
      {player1CardPlayed && (
        <div className='absolute bottom-20 left-[25%] transform -translate-x-1/2 bg-blue-600/80 text-white px-3 py-1 rounded-md z-20'>
          {player1CardPlayed}
        </div>
      )}

      {player2CardPlayed && (
        <div className='absolute bottom-20 right-[25%] transform translate-x-1/2 bg-red-600/80 text-white px-3 py-1 rounded-md z-20'>
          {player2CardPlayed}
        </div>
      )}

      {/* Enhanced shield effects */}
      <ShieldEffect
        isActive={player1ShieldActive}
        position='left'
        towerHeight={player1TowerHeight}
        glowIntensity={player1ShieldGlow}
      />

      <ShieldEffect
        isActive={player2ShieldActive}
        position='right'
        towerHeight={player2TowerHeight}
        glowIntensity={player2ShieldGlow}
      />

      {/* Attack animations */}
      <AttackAnimation
        player='player1'
        isVisible={player1AttackVisible}
        onAnimationComplete={handlePlayer1AttackComplete}
        targetTowerHeight={player2TowerHeight}
      />

      <AttackAnimation
        player='player2'
        isVisible={player2AttackVisible}
        onAnimationComplete={handlePlayer2AttackComplete}
        targetTowerHeight={player1TowerHeight}
      />

      {/* Explosion effects */}
      <ExplosionEffect
        isVisible={player1Explosion}
        position='left'
        towerHeight={player1TowerHeight}
        onAnimationComplete={handleExplosionComplete}
      />

      <ExplosionEffect
        isVisible={player2Explosion}
        position='right'
        towerHeight={player2TowerHeight}
        onAnimationComplete={handleExplosionComplete}
      />
    </>
  );
};

export default PlayerGestureDisplay;
