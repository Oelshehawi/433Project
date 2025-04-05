import { motion } from "framer-motion";
import Image from "next/image";

interface PlayerProps {
  playerNumber: 1 | 2;
  isVisible: boolean;
  blockCount: number;
  playerName?: string;
}

export default function Player({ playerNumber, isVisible, blockCount = 0, playerName }: PlayerProps) {
  // Different animation timing for visual interest between players
  const bounceDuration = playerNumber === 1 ? 1.5 : 1.8;
  
  // Calculate bottom position based on tower blocks
  const blockHeight = 40; // Same as in TowerBlock component
  const bottomPosition = blockCount * blockHeight;
  
  // Default player name if not provided
  const displayName = playerName || `Player ${playerNumber}`;
  
  return (
    <motion.div
       className={`absolute ${playerNumber === 1 ? 'left-[25%]' : 'right-[25%]'}`}
      initial={{ y: 500, opacity: 0 }}
      animate={isVisible ? { y: 0, opacity: 1 } : { y: 500, opacity: 0 }}
      style={{ 
        bottom: `${bottomPosition}px`,
        transform: 'translateX(-40%)'
      }}
      transition={{ 
        type: "spring", 
        damping: 12,
        stiffness: 100,
        delay: 1.3
      }}
    >
      {/* Player Name Label */}
      <motion.div 
        className="absolute left-1/2 -translate-x-1/2 -top-12 whitespace-nowrap"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5 }}
      >
        <div className="bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full border border-white/20 shadow-lg">
          <span className="text-white font-bold">{displayName}</span>
        </div>
      </motion.div>
      
      {/* Player Shadow */}
      <motion.div 
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-24 h-6 bg-black/30 rounded-full blur-sm z-0"
        animate={{ 
          scaleX: [1, 1.05, 1],
          scaleY: [1, 0.95, 1],
        }}
        transition={{
          repeat: Infinity,
          duration: bounceDuration,
          ease: "easeInOut"
        }}
      />
      
      {/* Player Sprite */}
      <motion.div
        className="z-20 flex justify-center"
        animate={{ 
          y: [0, -5, 0],
        }}
        transition={{
          repeat: Infinity,
          duration: bounceDuration,
          ease: "easeInOut"
        }}
      >
        <Image 
          src={`/p${playerNumber}.png`}
          alt={`Player ${playerNumber}`}
          width={180}
          height={180}
          className="z-10"
          priority
        />
      </motion.div>
    </motion.div>
  );
} 