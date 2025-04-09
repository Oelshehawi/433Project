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
}

const PlayerGestureDisplay = ({
  player1CardPlayed,
  player2CardPlayed,
  player1ShieldActive,
  player2ShieldActive,
  gameState,
}: PlayerGestureDisplayProps) => {
  // Using our sound manager hook instead of managing audio elements directly
  const { playSound } = useSoundManager();

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
    if (normalizedPlayer1Card === 'attack' && !player1AttackVisible) {
      // Play attack sound
      playSound(SoundEffect.ATTACK);

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
    normalizedPlayer1Card,
    player1AttackVisible,
    player2ShieldActive,
    player1Animation,
    playSound,
  ]);

  // Listen for player2 attack gestures
  useEffect(() => {
    // Attack detection for Player 2
    if (normalizedPlayer2Card === 'attack' && !player2AttackVisible) {
      // Play attack sound
      playSound(SoundEffect.ATTACK);

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
    normalizedPlayer2Card,
    player2AttackVisible,
    player1ShieldActive,
    player2Animation,
    playSound,
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
