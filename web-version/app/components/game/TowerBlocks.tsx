import { motion } from "framer-motion";
import { useEffect, useState } from "react";

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

  // Animate tower height changes
  useEffect(() => {
    if (player1Rendered !== player1Blocks) {
      const timeout = setTimeout(() => {
        setPlayer1Rendered((prev) =>
          prev < player1Blocks ? prev + 1 : prev - 1
        );
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [player1Rendered, player1Blocks]);

  useEffect(() => {
    if (player2Rendered !== player2Blocks) {
      const timeout = setTimeout(() => {
        setPlayer2Rendered((prev) =>
          prev < player2Blocks ? prev + 1 : prev - 1
        );
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [player2Rendered, player2Blocks]);

  if (!isVisible) return null;

  // Maximum tower height for scaling (use the larger of the two goals)
  const maxTowerHeight = Math.max(player1Goal, player2Goal) + 1;

  // Calculate block height based on max tower height
  const blockHeight = 40; // pixels per block
  const towerHeight = maxTowerHeight * blockHeight;

  return (
    <div className="absolute bottom-12 left-0 right-0 flex justify-between px-24">
      {/* Player 1 Tower */}
      <div className="flex flex-col items-center">
        <div className="mb-2 text-sm font-bold text-blue-300">
          Player 1 Tower
        </div>

        {/* Goal Line */}
        <div
          className="w-40 border-t-2 border-dashed border-yellow-400 absolute z-10"
          style={{
            bottom: `${player1Goal * blockHeight + 20}px`,
            left: "15%",
          }}
        >
          <span className="text-yellow-400 text-xs absolute -top-4 right-0">
            GOAL
          </span>
        </div>

        {/* Tower Container */}
        <div
          className="relative w-32 bg-gray-800/30 rounded-t-md border-l-2 border-r-2 border-t-2 border-gray-700/50 overflow-hidden"
          style={{ height: `${towerHeight}px` }}
        >
          {/* Tower Blocks */}
          <div className="absolute bottom-0 w-full flex flex-col-reverse">
            {Array.from({ length: player1Rendered }).map((_, index) => (
              <motion.div
                key={`p1-block-${index}`}
                initial={{ opacity: 0, scaleX: 0.8 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ duration: 0.2 }}
                className="w-full h-10 bg-blue-600 border-t-2 border-blue-400"
              />
            ))}
          </div>
        </div>

        {/* Block Counter */}
        <div className="mt-2 text-lg font-bold text-white bg-blue-900/50 px-3 py-1 rounded-md">
          {player1Rendered} / {player1Goal}
        </div>
      </div>

      {/* Player 2 Tower */}
      <div className="flex flex-col items-center">
        <div className="mb-2 text-sm font-bold text-red-300">
          Player 2 Tower
        </div>

        {/* Goal Line */}
        <div
          className="w-40 border-t-2 border-dashed border-yellow-400 absolute z-10"
          style={{
            bottom: `${player2Goal * blockHeight + 20}px`,
            right: "15%",
          }}
        >
          <span className="text-yellow-400 text-xs absolute -top-4 left-0">
            GOAL
          </span>
        </div>

        {/* Tower Container */}
        <div
          className="relative w-32 bg-gray-800/30 rounded-t-md border-l-2 border-r-2 border-t-2 border-gray-700/50 overflow-hidden"
          style={{ height: `${towerHeight}px` }}
        >
          {/* Tower Blocks */}
          <div className="absolute bottom-0 w-full flex flex-col-reverse">
            {Array.from({ length: player2Rendered }).map((_, index) => (
              <motion.div
                key={`p2-block-${index}`}
                initial={{ opacity: 0, scaleX: 0.8 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ duration: 0.2 }}
                className="w-full h-10 bg-red-600 border-t-2 border-red-400"
              />
            ))}
          </div>
        </div>

        {/* Block Counter */}
        <div className="mt-2 text-lg font-bold text-white bg-red-900/50 px-3 py-1 rounded-md">
          {player2Rendered} / {player2Goal}
        </div>
      </div>
    </div>
  );
}
