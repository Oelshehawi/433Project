import React, { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../lib/game/store';
import { SoundEffect, SoundManager } from '../../lib/utils/SoundManager';

// Helper function to manage animation states - exported for reuse
export const createAnimationStateManager = () => {
  // Track animations in progress
  const animationsInProgress = new Map<string, boolean>();

  // Generate a unique key for each animation type and player
  const getAnimationKey = (
    type: 'attack' | 'shield' | 'build',
    player: 'player1' | 'player2'
  ): string => {
    return `${type}_${player}`;
  };

  // Check if an animation is already in progress
  const isAnimationInProgress = (
    type: 'attack' | 'shield' | 'build',
    player: 'player1' | 'player2'
  ): boolean => {
    const key = getAnimationKey(type, player);
    return !!animationsInProgress.get(key);
  };

  // Mark an animation as started
  const startAnimation = (
    type: 'attack' | 'shield' | 'build',
    player: 'player1' | 'player2'
  ): boolean => {
    const key = getAnimationKey(type, player);

    // If animation is already in progress, don't start a new one
    if (animationsInProgress.get(key)) {
      console.log(
        `[Debug] ${type} animation for ${player} already in progress, ignoring request`
      );
      return false;
    }

    // Mark animation as in progress
    animationsInProgress.set(key, true);
    console.log(`[Debug] Starting ${type} animation for ${player}`);
    return true;
  };

  // Mark an animation as completed
  const completeAnimation = (
    type: 'attack' | 'shield' | 'build',
    player: 'player1' | 'player2'
  ): void => {
    const key = getAnimationKey(type, player);
    animationsInProgress.set(key, false);
    console.log(`[Debug] Completed ${type} animation for ${player}`);
  };

  return {
    isAnimationInProgress,
    startAnimation,
    completeAnimation,
  };
};

// Hook to use the animation state manager within a component
const useAnimationStateManager = () => {
  // Create a ref to store the manager and ensure it's only created once
  const managerRef = useRef(createAnimationStateManager());
  return managerRef.current;
};

interface DebugControlsProps {
  isVisible: boolean;
  onToggleVisibility: () => void;
  onTriggerAnimation?: (
    type: 'attack' | 'shield' | 'build',
    player: 'player1' | 'player2'
  ) => void;
}

const DebugControls: React.FC<DebugControlsProps> = ({
  isVisible,
  onToggleVisibility,
  onTriggerAnimation,
}) => {
  const [expanded, setExpanded] = useState(false);
  const setPlayerAnimation = useGameStore((state) => state.setPlayerAnimation);
  const addEventLog = useGameStore((state) => state.addEventLog);
  // Add state to track button disabled status
  const [buttonsDisabled, setButtonsDisabled] = useState(false);

  // Use the animation state manager
  const animationManager = useAnimationStateManager();

  // Debounced trigger function to prevent multiple rapid clicks
  const debounceTrigger = useCallback(
    (type: 'attack' | 'shield' | 'build', player: 'player1' | 'player2') => {
      if (buttonsDisabled) return;

      // Check if this animation is already in progress
      if (animationManager.isAnimationInProgress(type, player)) {
        addEventLog(
          `Debug: ${type} animation for ${player} already in progress, ignoring`,
          'Debug'
        );
        return;
      }

      // Disable buttons temporarily
      setButtonsDisabled(true);

      // Re-enable after a delay
      setTimeout(() => {
        setButtonsDisabled(false);
      }, 3000); // Keep disabled for 3 seconds

      // Mark animation as started
      if (animationManager.startAnimation(type, player)) {
        // Now trigger the animation
        triggerAnimation(type, player);
      }
    },
    [buttonsDisabled, animationManager, addEventLog]
  );

  // Helper function to trigger animations
  const triggerAnimation = (
    type: 'attack' | 'shield' | 'build',
    player: 'player1' | 'player2'
  ) => {
    addEventLog(`Debug: Triggering ${type} animation for ${player}`, 'Debug');

    // Call the parent component's triggerAnimation if provided
    if (onTriggerAnimation) {
      onTriggerAnimation(type, player);

      // Set a timeout to mark the animation as complete
      // This is just a fallback in case onAnimationComplete isn't called
      setTimeout(() => {
        animationManager.completeAnimation(type, player);
      }, 3000);

      return; // Let the parent handle everything
    }

    // Otherwise, use the game store directly (legacy behavior)
    // Play the appropriate sound
    if (type === 'attack') {
      SoundManager.playSound(SoundEffect.ATTACK);
      setPlayerAnimation(player, 'jump');

      // Set a timeout to mark the animation as complete
      setTimeout(() => {
        animationManager.completeAnimation(type, player);
      }, 2500);
    } else if (type === 'shield') {
      SoundManager.playSound(SoundEffect.SHIELD);
      // Shield doesn't have a special animation
      // Just update the shield state in the UI
      useGameStore.setState({
        ...(player === 'player1'
          ? { player1ShieldActive: true }
          : { player2ShieldActive: true }),
      });

      // Turn off shield after a delay
      setTimeout(() => {
        useGameStore.setState({
          ...(player === 'player1'
            ? { player1ShieldActive: false }
            : { player2ShieldActive: false }),
        });

        // Mark animation as complete
        animationManager.completeAnimation(type, player);
      }, 2000);
    } else if (type === 'build') {
      SoundManager.playSound(SoundEffect.BUILD);
      setPlayerAnimation(player, 'jump');

      // Add jump effect for building
      useGameStore.setState({
        ...(player === 'player1'
          ? { player1JumpHeight: 20 }
          : { player2JumpHeight: 20 }),
      });

      // Reset jump height after a delay
      setTimeout(() => {
        useGameStore.setState({
          ...(player === 'player1'
            ? { player1JumpHeight: 0 }
            : { player2JumpHeight: 0 }),
        });

        // Mark animation as complete
        animationManager.completeAnimation(type, player);
      }, 500);
    }
  };

  return (
    <div className='absolute top-4 right-4 z-50 flex flex-col items-end'>
      {/* Main debug toggle button */}
      <motion.button
        className='bg-purple-700 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-lg shadow-lg mb-2'
        onClick={() => {
          onToggleVisibility();
          setExpanded(false); // Close animation controls if debug logs are toggled
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {isVisible ? 'Hide Debug' : 'Show Debug'}
      </motion.button>

      {/* Animation controls toggle */}
      <motion.button
        className='bg-indigo-700 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg shadow-lg'
        onClick={() => setExpanded(!expanded)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {expanded ? 'Hide Animations' : 'Debug Animations'}
      </motion.button>

      {/* Animation control buttons - only show when expanded */}
      {expanded && (
        <div className='mt-2 bg-gray-900/80 p-3 rounded-lg flex flex-col gap-2 w-56'>
          <div className='text-white text-xs font-bold mb-1 pb-1 border-b border-gray-700'>
            Player 1 Animations
          </div>
          <div className='flex gap-1'>
            <button
              onClick={() => debounceTrigger('attack', 'player1')}
              className={`flex-1 ${
                buttonsDisabled ||
                animationManager.isAnimationInProgress('attack', 'player1')
                  ? 'bg-gray-700 cursor-not-allowed'
                  : 'bg-red-700 hover:bg-red-600'
              } text-white text-xs py-1 px-2 rounded`}
              disabled={
                buttonsDisabled ||
                animationManager.isAnimationInProgress('attack', 'player1')
              }
            >
              Attack
            </button>
            <button
              onClick={() => debounceTrigger('shield', 'player1')}
              className={`flex-1 ${
                buttonsDisabled ||
                animationManager.isAnimationInProgress('shield', 'player1')
                  ? 'bg-gray-700 cursor-not-allowed'
                  : 'bg-blue-700 hover:bg-blue-600'
              } text-white text-xs py-1 px-2 rounded`}
              disabled={
                buttonsDisabled ||
                animationManager.isAnimationInProgress('shield', 'player1')
              }
            >
              Shield
            </button>
            <button
              onClick={() => debounceTrigger('build', 'player1')}
              className={`flex-1 ${
                buttonsDisabled ||
                animationManager.isAnimationInProgress('build', 'player1')
                  ? 'bg-gray-700 cursor-not-allowed'
                  : 'bg-green-700 hover:bg-green-600'
              } text-white text-xs py-1 px-2 rounded`}
              disabled={
                buttonsDisabled ||
                animationManager.isAnimationInProgress('build', 'player1')
              }
            >
              Build
            </button>
          </div>

          <div className='text-white text-xs font-bold mt-1 mb-1 pb-1 border-b border-gray-700'>
            Player 2 Animations
          </div>
          <div className='flex gap-1'>
            <button
              onClick={() => debounceTrigger('attack', 'player2')}
              className={`flex-1 ${
                buttonsDisabled ||
                animationManager.isAnimationInProgress('attack', 'player2')
                  ? 'bg-gray-700 cursor-not-allowed'
                  : 'bg-red-700 hover:bg-red-600'
              } text-white text-xs py-1 px-2 rounded`}
              disabled={
                buttonsDisabled ||
                animationManager.isAnimationInProgress('attack', 'player2')
              }
            >
              Attack
            </button>
            <button
              onClick={() => debounceTrigger('shield', 'player2')}
              className={`flex-1 ${
                buttonsDisabled ||
                animationManager.isAnimationInProgress('shield', 'player2')
                  ? 'bg-gray-700 cursor-not-allowed'
                  : 'bg-blue-700 hover:bg-blue-600'
              } text-white text-xs py-1 px-2 rounded`}
              disabled={
                buttonsDisabled ||
                animationManager.isAnimationInProgress('shield', 'player2')
              }
            >
              Shield
            </button>
            <button
              onClick={() => debounceTrigger('build', 'player2')}
              className={`flex-1 ${
                buttonsDisabled ||
                animationManager.isAnimationInProgress('build', 'player2')
                  ? 'bg-gray-700 cursor-not-allowed'
                  : 'bg-green-700 hover:bg-green-600'
              } text-white text-xs py-1 px-2 rounded`}
              disabled={
                buttonsDisabled ||
                animationManager.isAnimationInProgress('build', 'player2')
              }
            >
              Build
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DebugControls;
