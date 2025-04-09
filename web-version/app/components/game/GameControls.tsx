import React from 'react';
import { useGameStore } from '../../lib/game/store';
import { motion } from 'framer-motion';

/**
 * GameControls component - Provides controls for game interaction
 * Uses the game store directly to control game state
 */
const GameControls: React.FC = () => {
  const {
    gameStatus,
    roundData,
    startGame,
    resetGame,
    pendingRoundNumber,
    readyForNextRound,
    isGameEnded,
  } = useGameStore();

  const isPlaying = gameStatus === 'playing';
  const isWaiting = gameStatus === 'waiting';
  const isTransitioning = roundData.isTransitioning;

  return (
    <div className='absolute bottom-24 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-3'>
      {/* Game Start Button - Only shown when waiting */}
      {isWaiting && (
        <motion.button
          onClick={() => startGame()}
          className='px-6 py-3 bg-primary text-white rounded-md shadow-lg hover:bg-primary/80 transition-colors'
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Start Game
        </motion.button>
      )}

      {/* Round Controls - Only shown during gameplay */}
      {isPlaying && !isGameEnded && (
        <div className='flex gap-3'>
          {/* Ready for Next Round - Only shown when there's a pending round */}
          {pendingRoundNumber && !isTransitioning && (
            <motion.button
              onClick={() => readyForNextRound(pendingRoundNumber)}
              className='px-4 py-2 bg-green-600 text-white rounded-md shadow-lg hover:bg-green-700 transition-colors'
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Ready for Round {pendingRoundNumber}
            </motion.button>
          )}
        </div>
      )}

      {/* Reset Game Button - Only shown when game is ended */}
      {isGameEnded && (
        <motion.button
          onClick={() => resetGame()}
          className='px-6 py-3 bg-primary text-white rounded-md shadow-lg hover:bg-primary/80 transition-colors'
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Reset Game
        </motion.button>
      )}
    </div>
  );
};

export default GameControls;
