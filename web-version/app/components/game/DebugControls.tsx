import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../lib/game/store';
import { SoundEffect, SoundManager } from '../../lib/utils/SoundManager';

interface DebugControlsProps {
  isVisible: boolean;
  onToggleVisibility: () => void;
}

const DebugControls: React.FC<DebugControlsProps> = ({
  isVisible,
  onToggleVisibility,
}) => {
  const [expanded, setExpanded] = useState(false);
  const setPlayerAnimation = useGameStore((state) => state.setPlayerAnimation);
  const addEventLog = useGameStore((state) => state.addEventLog);

  // Helper function to trigger animations
  const triggerAnimation = (
    type: 'attack' | 'shield' | 'build',
    player: 'player1' | 'player2'
  ) => {
    addEventLog(`Debug: Triggering ${type} animation for ${player}`, 'Debug');

    // Play the appropriate sound
    if (type === 'attack') {
      SoundManager.playSound(SoundEffect.ATTACK);
      setPlayerAnimation(player, 'jump');
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
              onClick={() => triggerAnimation('attack', 'player1')}
              className='flex-1 bg-red-700 hover:bg-red-600 text-white text-xs py-1 px-2 rounded'
            >
              Attack
            </button>
            <button
              onClick={() => triggerAnimation('shield', 'player1')}
              className='flex-1 bg-blue-700 hover:bg-blue-600 text-white text-xs py-1 px-2 rounded'
            >
              Shield
            </button>
            <button
              onClick={() => triggerAnimation('build', 'player1')}
              className='flex-1 bg-green-700 hover:bg-green-600 text-white text-xs py-1 px-2 rounded'
            >
              Build
            </button>
          </div>

          <div className='text-white text-xs font-bold mt-1 mb-1 pb-1 border-b border-gray-700'>
            Player 2 Animations
          </div>
          <div className='flex gap-1'>
            <button
              onClick={() => triggerAnimation('attack', 'player2')}
              className='flex-1 bg-red-700 hover:bg-red-600 text-white text-xs py-1 px-2 rounded'
            >
              Attack
            </button>
            <button
              onClick={() => triggerAnimation('shield', 'player2')}
              className='flex-1 bg-blue-700 hover:bg-blue-600 text-white text-xs py-1 px-2 rounded'
            >
              Shield
            </button>
            <button
              onClick={() => triggerAnimation('build', 'player2')}
              className='flex-1 bg-green-700 hover:bg-green-600 text-white text-xs py-1 px-2 rounded'
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
