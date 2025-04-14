import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface TowerBlocksProps {
  player1Blocks: number;
  player2Blocks: number;
  player1Goal: number;
  player2Goal: number;
  isVisible: boolean;
}

export default function TowerBlocks({
  player1Blocks,
  player2Blocks,
  player1Goal,
  player2Goal,
  isVisible,
}: TowerBlocksProps) {
  // Use state to track animation
  const [player1Rendered, setPlayer1Rendered] = useState(0);
  const [player2Rendered, setPlayer2Rendered] = useState(0);
  const [recentlyAdded1, setRecentlyAdded1] = useState<number | null>(null);
  const [recentlyAdded2, setRecentlyAdded2] = useState<number | null>(null);

  // Animate tower height changes
  useEffect(() => {
    if (player1Rendered !== player1Blocks) {
      if (player1Rendered < player1Blocks) {
        // Block added
        setRecentlyAdded1(player1Rendered);
      }

      const timeout = setTimeout(() => {
        setPlayer1Rendered((prev) =>
          prev < player1Blocks ? prev + 1 : prev - 1
        );

        // Clear the recently added marker after animation
        if (recentlyAdded1 !== null) {
          setTimeout(() => setRecentlyAdded1(null), 800);
        }
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [player1Rendered, player1Blocks, recentlyAdded1]);

  useEffect(() => {
    if (player2Rendered !== player2Blocks) {
      if (player2Rendered < player2Blocks) {
        setRecentlyAdded2(player2Rendered);
      }

      const timeout = setTimeout(() => {
        setPlayer2Rendered((prev) =>
          prev < player2Blocks ? prev + 1 : prev - 1
        );

        // Clear the recently added marker after animation
        if (recentlyAdded2 !== null) {
          setTimeout(() => setRecentlyAdded2(null), 800);
        }
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [player2Rendered, player2Blocks, recentlyAdded2]);

  if (!isVisible) return null;

  // Constants for tower and player dimensions
  const BLOCK_HEIGHT = 40; 

  return (
    <div className='absolute bottom-25 left-0 right-0 flex justify-around'>
      {/* Player 1 Tower - fixed position left side */}
      <div className='absolute bottom-16 left-[25%] -translate-x-1/2 w-40'>
        <div className='flex flex-col items-center'>
          {/* Tower Structure */}
          <div className='flex flex-col items-center'>
            {/* Tower blocks */}
            <div className='flex flex-col relative'>
              <AnimatePresence>
                {Array.from({ length: player1Rendered }).map((_, i) => {
                  // Calculate offset based on index - more extreme
                  const offsetX = i % 3 === 0 ? -8 : i % 3 === 1 ? 10 : 0;
                  // Add slight rotation for more Jenga-like appearance
                  const rotation = i % 3 === 0 ? -1 : i % 3 === 1 ? 1 : 0;
                  const isNewBlock = i === recentlyAdded1;

                  return (
                    <motion.div
                      key={`p1-block-${i}`}
                      className={`w-30 h-[40px] border-b border-blue-700 ${
                        isNewBlock ? 'bg-blue-400' : 'bg-blue-500'
                      }`}
                      initial={{ opacity: 0, scale: 0.9, y: -20 }}
                      animate={{
                        opacity: 1,
                        scale: isNewBlock ? [0.9, 1.1, 1] : 1,
                        y: 0,
                        backgroundColor: isNewBlock
                          ? ['#60a5fa', '#3b82f6']
                          : '#3b82f6',
                      }}
                      exit={{ opacity: 0, scale: 0.9, y: 10 }}
                      transition={{
                        duration: isNewBlock ? 0.5 : 0.2,
                        backgroundColor: { duration: 0.8 },
                      }}
                      style={{
                        borderTopLeftRadius: i === 0 ? '4px' : '0',
                        borderTopRightRadius: i === 0 ? '4px' : '0',
                        transform: `translateX(${offsetX}px) rotate(${rotation}deg)`,
                        marginTop: '-1px',
                        zIndex: player1Rendered - i,
                      }}
                    />
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Removed the base platform to allow players to appear to stand directly on blocks */}
          </div>
        </div>
      </div>

      {/* Goal indicators - Player 1 */}
      <div
        className='absolute left-24 z-20'
        style={{
          bottom: `${player1Goal * BLOCK_HEIGHT + 120 + 64}px`,
        }}
      >
        <div className='flex items-center'>
          <div className='h-1 w-12 bg-yellow-400'></div>
          <span className='text-yellow-400 text-xs font-bold ml-1'>GOAL</span>
        </div>
      </div>

      {/* Player 2 Tower - fixed position right side */}
      <div className='absolute bottom-16 right-[25%] translate-x-1/2 w-40'>
        <div className='flex flex-col items-center'>
          {/* Tower Structure */}
          <div className='flex flex-col items-center'>
            {/* Tower blocks */}
            <div className='flex flex-col relative'>
              <AnimatePresence>
                {Array.from({ length: player2Rendered }).map((_, i) => {
                  // Calculate offset based on index (opposite of player 1) - more extreme
                  const offsetX = i % 3 === 0 ? 8 : i % 3 === 1 ? -10 : 0;
                  // Add slight rotation for more Jenga-like appearance (opposite direction)
                  const rotation = i % 3 === 0 ? 1 : i % 3 === 1 ? -1 : 0;
                  const isNewBlock = i === recentlyAdded2;

                  return (
                    <motion.div
                      key={`p2-block-${i}`}
                      className={`w-30 h-[40px] border-b border-red-700 ${
                        isNewBlock ? 'bg-red-400' : 'bg-red-500'
                      }`}
                      initial={{ opacity: 0, scale: 0.9, y: -20 }}
                      animate={{
                        opacity: 1,
                        scale: isNewBlock ? [0.9, 1.1, 1] : 1,
                        y: 0,
                        backgroundColor: isNewBlock
                          ? ['#f87171', '#ef4444']
                          : '#ef4444',
                      }}
                      exit={{ opacity: 0, scale: 0.9, y: 10 }}
                      transition={{
                        duration: isNewBlock ? 0.5 : 0.2,
                        backgroundColor: { duration: 0.8 },
                      }}
                      style={{
                        borderTopLeftRadius: i === 0 ? '4px' : '0',
                        borderTopRightRadius: i === 0 ? '4px' : '0',
                        transform: `translateX(${offsetX}px) rotate(${rotation}deg)`,
                        marginTop: '-1px',
                        zIndex: player2Rendered - i,
                      }}
                    />
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Goal indicators - Player 2 */}
      <div
        className='absolute right-24 z-20'
        style={{
          bottom: `${player2Goal * BLOCK_HEIGHT + 120 + 64}px`,
        }}
      >
        <div className='flex items-center'>
          <span className='text-yellow-400 text-xs font-bold mr-1'>GOAL</span>
          <div className='h-1 w-12 bg-yellow-400'></div>
        </div>
      </div>
    </div>
  );
}
