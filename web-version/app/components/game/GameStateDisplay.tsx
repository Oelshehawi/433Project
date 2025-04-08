import React from 'react';
import { useGameStore } from '../../lib/game/store';

/**
 * GameStateDisplay component - Shows the current game state information
 * Uses the game store directly to display game state information
 */
const GameStateDisplay: React.FC = () => {
  const {
    player1Name,
    player2Name,
    player1TowerHeight,
    player2TowerHeight,
    player1GoalHeight,
    player2GoalHeight,
    roundData,
    isGameEnded,
    winner,
  } = useGameStore();

  return (
    <div className='absolute top-16 right-4 bg-gray-900/70 p-3 rounded-md text-white text-sm w-64'>
      <h3 className='text-center font-bold mb-2 border-b border-gray-700 pb-1'>
        Game State
      </h3>

      <div className='space-y-1'>
        <div className='flex justify-between'>
          <span>Round:</span>
          <span className='font-mono'>{roundData.roundNumber}</span>
        </div>

        <div className='flex justify-between'>
          <span>Time Remaining:</span>
          <span className='font-mono'>{roundData.timeRemaining}s</span>
        </div>

        <div className='border-t border-gray-700 my-2'></div>

        <div className='flex justify-between'>
          <span className='text-blue-300'>{player1Name}</span>
          <span className='font-mono'>
            {player1TowerHeight} / {player1GoalHeight}
          </span>
        </div>

        <div className='flex justify-between'>
          <span className='text-red-300'>{player2Name}</span>
          <span className='font-mono'>
            {player2TowerHeight} / {player2GoalHeight}
          </span>
        </div>

        {isGameEnded && (
          <>
            <div className='border-t border-gray-700 my-2'></div>
            <div className='text-center text-yellow-400 font-bold'>
              {winner
                ? `Winner: ${winner === '1' ? player1Name : player2Name}`
                : 'Game Ended'}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GameStateDisplay;
