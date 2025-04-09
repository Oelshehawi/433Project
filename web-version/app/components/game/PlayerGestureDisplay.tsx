import React, { useState, useEffect } from 'react';
import ShieldEffect from './ShieldEffect';
import AttackAnimation from './AttackAnimation';
import ExplosionEffect from './ExplosionEffect';
import { useGameStore } from '../../lib/game/store';

interface PlayerGestureDisplayProps {
  player1CardPlayed: string;
  player2CardPlayed: string;
  player1ShieldActive: boolean;
  player2ShieldActive: boolean;
  gameState: 'starting' | 'playing';
}

const PlayerGestureDisplay = ({
  player1CardPlayed,
  player2CardPlayed,
  player1ShieldActive,
  player2ShieldActive,
  gameState,
}: PlayerGestureDisplayProps) => {
  // Audio references
  const [shieldAudio, setShieldAudio] = useState<HTMLAudioElement | null>(null);
  const [attackAudio, setAttackAudio] = useState<HTMLAudioElement | null>(null);

  // Attack animation states
  const [player1AttackVisible, setPlayer1AttackVisible] = useState(false);
  const [player2AttackVisible, setPlayer2AttackVisible] = useState(false);

  // Explosion effect states
  const [player1Explosion, setPlayer1Explosion] = useState(false);
  const [player2Explosion, setPlayer2Explosion] = useState(false);

  // Shield glow states
  const [player1ShieldGlow, setPlayer1ShieldGlow] = useState(0);
  const [player2ShieldGlow, setPlayer2ShieldGlow] = useState(0);

  // Get tower heights from game store
  const {
    player1TowerHeight,
    player2TowerHeight,
    player1Animation,
    player2Animation,
  } = useGameStore();

  // Initialize audio on component mount
  useEffect(() => {
    // Initialize shield sound
    if (typeof Audio !== 'undefined') {
      const shieldSound = new Audio('/sounds/shield.mp3');
      shieldSound.preload = 'auto';
      setShieldAudio(shieldSound);

      // Initialize attack sound
      const attackSound = new Audio('/sounds/attack.mp3');
      attackSound.preload = 'auto';
      setAttackAudio(attackSound);
    }
  }, []);

  // Play shield sound when shield is activated
  useEffect(() => {
    if (shieldAudio && player1ShieldActive) {
      shieldAudio.currentTime = 0;
      shieldAudio.play().catch(() => {
        // Silently fail if audio doesn't play
      });
    }
  }, [player1ShieldActive, shieldAudio]);

  useEffect(() => {
    if (shieldAudio && player2ShieldActive) {
      shieldAudio.currentTime = 0;
      shieldAudio.play().catch(() => {
        // Silently fail if audio doesn't play
      });
    }
  }, [player2ShieldActive, shieldAudio]);

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
  };

  // Handle explosion animation completion
  const handleExplosionComplete = () => {
    setPlayer1Explosion(false);
    setPlayer2Explosion(false);
  };

  // Listen for player1 attack gestures
  useEffect(() => {
    // Attack detection for Player 1
    if (player1CardPlayed === 'Attack' && !player1AttackVisible) {
      // Play attack sound
      if (attackAudio) {
        attackAudio.currentTime = 0;
        attackAudio.play().catch(() => {
          // Silently fail if audio doesn't play
        });
      }

      // Show attack animation
      setPlayer1AttackVisible(true);

      // If player 2 has shield, gradually increase glow intensity
      if (player2ShieldActive) {
        const interval = setInterval(() => {
          setPlayer2ShieldGlow((prev) => {
            const newValue = prev + 0.1;
            return newValue > 1 ? 1 : newValue;
          });
        }, 100);

        // Cleanup interval
        setTimeout(() => clearInterval(interval), 1000);
      }
    }
  }, [
    player1CardPlayed,
    player1AttackVisible,
    attackAudio,
    player2ShieldActive,
    player1Animation,
  ]);

  // Listen for player2 attack gestures
  useEffect(() => {
    // Attack detection for Player 2
    if (player2CardPlayed === 'Attack' && !player2AttackVisible) {
      // Play attack sound
      if (attackAudio) {
        attackAudio.currentTime = 0;
        attackAudio.play().catch(() => {
          // Silently fail if audio doesn't play
        });
      }

      // Show attack animation
      setPlayer2AttackVisible(true);

      // If player 1 has shield, gradually increase glow intensity
      if (player1ShieldActive) {
        const interval = setInterval(() => {
          setPlayer1ShieldGlow((prev) => {
            const newValue = prev + 0.1;
            return newValue > 1 ? 1 : newValue;
          });
        }, 100);

        // Cleanup interval
        setTimeout(() => clearInterval(interval), 1000);
      }
    }
  }, [
    player2CardPlayed,
    player2AttackVisible,
    attackAudio,
    player1ShieldActive,
    player2Animation,
  ]);

  // Debug state to make sure component is rendering
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

      {/* Hidden audio elements for sounds - these are preloaded */}
      <audio
        style={{ display: 'none' }}
        preload='auto'
        src='/sounds/shield.mp3'
      />
      <audio
        style={{ display: 'none' }}
        preload='auto'
        src='/sounds/attack.mp3'
      />
    </>
  );
};

export default PlayerGestureDisplay;
