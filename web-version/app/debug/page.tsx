'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  useSoundManager,
  SoundEffect,
  SoundManager,
} from '../lib/utils/SoundManager';
import Player from '../components/game/Player';
import GameBackground from '../components/game/GameBackground';
import CenterDivider from '../components/game/CenterDivider';
import TowerBlocks from '../components/game/TowerBlocks';
import PlayerGestureDisplay from '../components/game/PlayerGestureDisplay';
import ShieldEffect from '../components/game/ShieldEffect';
import DebugControls from '../components/game/DebugControls';
import EventLogger from '../components/game/EventLogger';
import AttackAnimation from '../components/game/AttackAnimation';
import ExplosionEffect from '../components/game/ExplosionEffect';
import { createAnimationStateManager } from '../components/game/DebugControls';

/**
 * Debug Test Page
 *
 * This page provides a sandbox environment for testing game animations
 * and audio without needing to connect to a server.
 */
export default function DebugPage() {
  // State for the debug page
  const [eventLogs, setEventLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const [player1TowerHeight, setPlayer1TowerHeight] = useState(0);
  const [player2TowerHeight, setPlayer2TowerHeight] = useState(0);
  const [player1Animation, setPlayer1Animation] = useState<
    'idle' | 'jump' | 'hurt' | 'die'
  >('idle');
  const [player2Animation, setPlayer2Animation] = useState<
    'idle' | 'jump' | 'hurt' | 'die'
  >('idle');
  const [player1JumpHeight, setPlayer1JumpHeight] = useState(0);
  const [player2JumpHeight, setPlayer2JumpHeight] = useState(0);
  const [player1ShieldActive, setPlayer1ShieldActive] = useState(false);
  const [player2ShieldActive, setPlayer2ShieldActive] = useState(false);
  const [player1Card, setPlayer1Card] = useState('');
  const [player2Card, setPlayer2Card] = useState('');
  // Add state for visual effects
  const [showAttackAnimation1, setShowAttackAnimation1] = useState(false);
  const [showAttackAnimation2, setShowAttackAnimation2] = useState(false);
  const [showExplosion1, setShowExplosion1] = useState(false);
  const [showExplosion2, setShowExplosion2] = useState(false);
  // Add state to track animation in progress to prevent multiple triggers
  const [animationInProgress, setAnimationInProgress] = useState(false);
  // Add state to track animation sequence
  const [animationSequence, setAnimationSequence] = useState(0);

  // Get sound manager hooks
  const { playSound, playBackgroundMusic, stopBackgroundMusic } =
    useSoundManager();

  // Add a ref to track initial mount
  const isInitialMount = React.useRef(true);

  // Create animation state manager instance
  const animationManagerRef = useRef(createAnimationStateManager());
  const animationManager = animationManagerRef.current;

  // Initialize sound on page load
  useEffect(() => {
    // Only run on initial mount
    if (isInitialMount.current) {
      // Force initialize SoundManager
      SoundManager.initialize();

      // Just play once, directly
      playBackgroundMusic();
      addLog('Playing background music');

      setEventLogs((prev) => [
        ...prev,
        `[Debug] Debug page loaded, starting background music`,
      ]);
      isInitialMount.current = false;
    }

    return () => {
      stopBackgroundMusic();
    };
  }, [playBackgroundMusic, stopBackgroundMusic]);

  // Helper to add a log message
  const addLog = (message: string, source: string = 'Debug') => {
    setEventLogs((prev) => [...prev, `[${source}] ${message}`]);
  };

  // Clear logs
  const clearLogs = () => {
    setEventLogs([]);
  };

  // Debug logs for animation states
  const debugLog = (message: string) => {
    console.log(`[Debug Page] ${message}`);
    addLog(message, 'Animation Debug');
  };

  // Modify the triggerAnimation function to use the animation manager
  const triggerAnimation = (
    type: 'attack' | 'shield' | 'build',
    player: 'player1' | 'player2'
  ) => {
    // Prevent multiple animations from running simultaneously
    if (animationInProgress) {
      debugLog(`Animation already in progress, please wait`);
      return;
    }

    // Check if this specific animation is already in progress
    if (animationManager.isAnimationInProgress(type, player)) {
      debugLog(
        `${type} animation for ${player} already in progress, ignoring request`
      );
      return;
    }

    debugLog(`Resetting animation states before starting new animation`);
    // First reset any existing animations to ensure clean state
    setShowAttackAnimation1(false);
    setShowAttackAnimation2(false);
    setShowExplosion1(false);
    setShowExplosion2(false);
    setPlayer1ShieldActive(false);
    setPlayer2ShieldActive(false);

    // Short delay to ensure reset takes effect
    setTimeout(() => {
      debugLog(`Reset complete, starting new ${type} animation for ${player}`);
      setAnimationInProgress(true);

      // Mark animation as started in the manager
      animationManager.startAnimation(type, player);

      // Increment animation sequence to force component remounting
      setAnimationSequence((prev) => prev + 1);
      addLog(`Triggering ${type} animation for ${player}`);

      if (type === 'attack') {
        playSound(SoundEffect.ATTACK);
        if (player === 'player1') {
          setPlayer1Animation('jump');
          setPlayer1Card('Attack');
          // Show attack animation
          debugLog(
            `Setting showAttackAnimation1 to true with sequence ${
              animationSequence + 1
            }`
          );
          setShowAttackAnimation1(true);

          // Show explosion after a delay
          setTimeout(() => {
            debugLog(
              `Attack animation timeouts: showing explosion, hiding attack`
            );
            setShowExplosion2(true);
            setShowAttackAnimation1(false);
          }, 1500);

          // Hide explosion after another delay
          setTimeout(() => {
            debugLog(`Attack animation timeouts: hiding explosion`);
            setShowExplosion2(false);
          }, 2000);

          // Reset animation after a delay
          setTimeout(() => {
            debugLog(
              `Attack animation timeouts: resetting player animation and in-progress flag`
            );
            setPlayer1Animation('idle');
            setAnimationInProgress(false);
            // Mark animation as completed in the manager
            animationManager.completeAnimation(type, player);
          }, 2500);
        } else {
          setPlayer2Animation('jump');
          setPlayer2Card('Attack');
          // Show attack animation
          debugLog(
            `Setting showAttackAnimation2 to true with sequence ${
              animationSequence + 1
            }`
          );
          setShowAttackAnimation2(true);

          // Show explosion after a delay
          setTimeout(() => {
            debugLog(
              `Attack animation timeouts: showing explosion, hiding attack`
            );
            setShowExplosion1(true);
            setShowAttackAnimation2(false);
          }, 1500);

          // Hide explosion after another delay
          setTimeout(() => {
            debugLog(`Attack animation timeouts: hiding explosion`);
            setShowExplosion1(false);
          }, 2000);

          // Reset animation after a delay
          setTimeout(() => {
            debugLog(
              `Attack animation timeouts: resetting player animation and in-progress flag`
            );
            setPlayer2Animation('idle');
            setAnimationInProgress(false);
            // Mark animation as completed in the manager
            animationManager.completeAnimation(type, player);
          }, 2500);
        }
      } else if (type === 'shield') {
        playSound(SoundEffect.SHIELD);
        if (player === 'player1') {
          setPlayer1ShieldActive(true);
          setPlayer1Card('Defend');
          // Turn off shield after a delay
          setTimeout(() => {
            setPlayer1ShieldActive(false);
            setAnimationInProgress(false);
            // Mark animation as completed in the manager
            animationManager.completeAnimation(type, player);
          }, 2000);
        } else {
          setPlayer2ShieldActive(true);
          setPlayer2Card('Defend');
          // Turn off shield after a delay
          setTimeout(() => {
            setPlayer2ShieldActive(false);
            setAnimationInProgress(false);
            // Mark animation as completed in the manager
            animationManager.completeAnimation(type, player);
          }, 2000);
        }
      } else if (type === 'build') {
        playSound(SoundEffect.BUILD);
        if (player === 'player1') {
          setPlayer1Animation('jump');
          setPlayer1Card('Build');
          setPlayer1JumpHeight(20);
          // Increase tower after animation
          setTimeout(() => {
            setPlayer1TowerHeight((prev) => prev + 1);
            setPlayer1JumpHeight(0);
            setPlayer1Animation('idle');
            setAnimationInProgress(false);
            // Mark animation as completed in the manager
            animationManager.completeAnimation(type, player);
          }, 500);
        } else {
          setPlayer2Animation('jump');
          setPlayer2Card('Build');
          setPlayer2JumpHeight(20);
          // Increase tower after animation
          setTimeout(() => {
            setPlayer2TowerHeight((prev) => prev + 1);
            setPlayer2JumpHeight(0);
            setPlayer2Animation('idle');
            setAnimationInProgress(false);
            // Mark animation as completed in the manager
            animationManager.completeAnimation(type, player);
          }, 500);
        }
      }

      // Clear the card display after a delay
      setTimeout(() => {
        debugLog(`Clearing player card`);
        if (player === 'player1') {
          setPlayer1Card('');
        } else {
          setPlayer2Card('');
        }
      }, 3000);
    }, 50); // Short delay before starting new animation
  };

  // Add debug panel to show animation state
  const renderDebugAnimationInfo = () => {
    return (
      <div className='absolute top-20 left-4 bg-black/60 p-4 rounded text-white text-xs font-mono w-64 z-50'>
        <h3 className='text-sm font-bold mb-2'>Animation Debug</h3>
        <div className='grid grid-cols-2 gap-x-2 gap-y-1'>
          <div>In Progress:</div>
          <div>{animationInProgress ? 'Yes' : 'No'}</div>

          <div>Sequence:</div>
          <div>{animationSequence}</div>

          <div>Attack P1:</div>
          <div>{showAttackAnimation1 ? 'Show' : 'Hide'}</div>

          <div>Attack P2:</div>
          <div>{showAttackAnimation2 ? 'Show' : 'Hide'}</div>

          <div>Explosion P1:</div>
          <div>{showExplosion1 ? 'Show' : 'Hide'}</div>

          <div>Explosion P2:</div>
          <div>{showExplosion2 ? 'Show' : 'Hide'}</div>

          <div>Shield P1:</div>
          <div>{player1ShieldActive ? 'Show' : 'Hide'}</div>

          <div>Shield P2:</div>
          <div>{player2ShieldActive ? 'Show' : 'Hide'}</div>
        </div>
        <button
          className='mt-2 w-full bg-red-700 hover:bg-red-800 text-white py-1 rounded'
          onClick={() => {
            // Force reset all animation states
            setShowAttackAnimation1(false);
            setShowAttackAnimation2(false);
            setShowExplosion1(false);
            setShowExplosion2(false);
            setPlayer1ShieldActive(false);
            setPlayer2ShieldActive(false);
            setAnimationInProgress(false);
            debugLog('Forced reset of all animation states');
          }}
        >
          Force Reset
        </button>
      </div>
    );
  };

  return (
    <main className='relative w-full h-screen flex flex-col items-center justify-center overflow-hidden bg-slate-800'>
      <h1 className='absolute top-4 left-0 right-0 text-center text-white text-2xl font-bold'>
        Animation Debug Page
      </h1>

      {/* Debug Animation Information */}
      {showLogs && renderDebugAnimationInfo()}

      {/* Game Background */}
      <GameBackground />

      {/* Center Divider */}
      <CenterDivider />

      {/* Players */}
      <Player
        playerId='player1'
        name='Player 1'
        isVisible={true}
        animationState={player1Animation}
        jumpHeight={player1JumpHeight}
        towerHeight={player1TowerHeight}
      />

      <Player
        playerId='player2'
        name='Player 2'
        isVisible={true}
        animationState={player2Animation}
        jumpHeight={player2JumpHeight}
        towerHeight={player2TowerHeight}
      />

      {/* Tower Blocks - Positioned below players */}
      <TowerBlocks
        player1Blocks={player1TowerHeight}
        player2Blocks={player2TowerHeight}
        player1Goal={5}
        player2Goal={5}
        isVisible={true}
      />

      {/* Shield Effect Components */}
      <ShieldEffect
        key={`shield-p1-${animationSequence}`}
        isActive={player1ShieldActive}
        position='left'
        towerHeight={player1TowerHeight}
        glowIntensity={0.7}
      />

      <ShieldEffect
        key={`shield-p2-${animationSequence}`}
        isActive={player2ShieldActive}
        position='right'
        towerHeight={player2TowerHeight}
        glowIntensity={0.7}
      />

      {/* Attack Animations */}
      <AttackAnimation
        key={`attack-p1-${animationSequence}`}
        player='player1'
        isVisible={showAttackAnimation1}
        onAnimationComplete={(player) => {
          debugLog(
            `AttackAnimation onAnimationComplete callback for ${player}`
          );
          setShowAttackAnimation1(false);
          // Mark animation as completed in the manager
          animationManager.completeAnimation('attack', player);
        }}
        targetTowerHeight={player2TowerHeight}
      />

      <AttackAnimation
        key={`attack-p2-${animationSequence}`}
        player='player2'
        isVisible={showAttackAnimation2}
        onAnimationComplete={(player) => {
          debugLog(
            `AttackAnimation onAnimationComplete callback for ${player}`
          );
          setShowAttackAnimation2(false);
          // Mark animation as completed in the manager
          animationManager.completeAnimation('attack', player);
        }}
        targetTowerHeight={player1TowerHeight}
      />

      {/* Explosion Effects */}
      <ExplosionEffect
        key={`explosion-p1-${animationSequence}`}
        isVisible={showExplosion1}
        position='left'
        towerHeight={player1TowerHeight}
        onAnimationComplete={() => setShowExplosion1(false)}
      />

      <ExplosionEffect
        key={`explosion-p2-${animationSequence}`}
        isVisible={showExplosion2}
        position='right'
        towerHeight={player2TowerHeight}
        onAnimationComplete={() => setShowExplosion2(false)}
      />

      {/* Player Gesture Display */}
      <PlayerGestureDisplay
        player1CardPlayed={player1Card}
        player2CardPlayed={player2Card}
        player1ShieldActive={player1ShieldActive}
        player2ShieldActive={player2ShieldActive}
        gameState='playing'
      />

      {/* Debug Controls */}
      <DebugControls
        isVisible={showLogs}
        onToggleVisibility={() => setShowLogs(!showLogs)}
        onTriggerAnimation={triggerAnimation}
      />

      {/* Debug Logs */}
      {showLogs && (
        <EventLogger eventLogs={eventLogs} onClearLogs={clearLogs} />
      )}

      {/* Additional debug controls */}
      <div className='absolute bottom-4 left-0 right-0 flex justify-center gap-4'>
        <button
          className='bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md'
          onClick={() => {
            // Reset the towers
            setPlayer1TowerHeight(0);
            setPlayer2TowerHeight(0);
            addLog('Towers reset to 0');
          }}
        >
          Reset Towers
        </button>

        <button
          className='bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md'
          onClick={() => {
            // Test sound effects
            playSound(SoundEffect.ATTACK);
            playSound(SoundEffect.SHIELD);
            playSound(SoundEffect.BUILD);
            addLog('Testing all sound effects');
          }}
        >
          Test All Sounds
        </button>

        <button
          className='bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md'
          onClick={() => {
            // Demo all animations in sequence
            addLog('Starting animation demo sequence');

            // Player 1 build
            setTimeout(() => triggerAnimation('build', 'player1'), 1000);

            // Player 2 shield
            setTimeout(() => triggerAnimation('shield', 'player2'), 3000);

            // Player 1 attack
            setTimeout(() => triggerAnimation('attack', 'player1'), 5000);

            // Player 2 build
            setTimeout(() => triggerAnimation('build', 'player2'), 7000);

            // Player 1 shield
            setTimeout(() => triggerAnimation('shield', 'player1'), 9000);

            // Player 2 attack
            setTimeout(() => triggerAnimation('attack', 'player2'), 11000);
          }}
        >
          Run Demo Sequence
        </button>
      </div>
    </main>
  );
}
