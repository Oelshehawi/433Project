import { AnimatePresence } from "framer-motion";
import TowerBlock from "./TowerBlock";

interface TowerBlocksProps {
  count: number;
  playerSide: 'left' | 'right';
}

export default function TowerBlocks({ count, playerSide }: TowerBlocksProps) {
  // Create an array of indexes based on the count
  const blockIndexes = Array.from({ length: count }, (_, i) => i);
  
  return (
    <div className="absolute bottom-0 w-full h-full pointer-events-none">
      <AnimatePresence>
        {blockIndexes.map(index => (
          <TowerBlock 
            key={`${playerSide}-block-${index}`} 
            index={index} 
            playerSide={playerSide} 
          />
        ))}
      </AnimatePresence>
    </div>
  );
} 