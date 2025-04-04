import { motion } from "framer-motion";

interface TowerBlockProps {
  index: number;
  playerSide: 'left' | 'right';
}

export default function TowerBlock({ index, playerSide }: TowerBlockProps) {
  // The block height - each block is stacked beneath the player
  const blockHeight = 40;
  
  // Position index from bottom (0 is the lowest block)
  const bottomPosition = index * blockHeight;
  
  return (
    <motion.div
      className={`absolute ${playerSide === 'left' ? 'left-[25%]' : 'right-[25%]'} w-28 h-[40px] z-15`}
      style={{ 
        bottom: `${bottomPosition}px`,
        transform: 'translateX(-40%)',
      }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5, y: 10 }}
      transition={{ duration: 0.3 }}
    >
      {/* Main cube face (top) */}
      <div 
        className="w-full h-full bg-gray-600 rounded-sm border border-gray-500"
        style={{
          boxShadow: 'inset 1px 1px 3px rgba(255,255,255,0.3), inset -1px -1px 3px rgba(0,0,0,0.3)'
        }}
      >
        {/* Block detail lines */}
        <div className="w-full h-full flex flex-col justify-evenly items-center">
          <div className="w-[90%] h-[3px] bg-gray-700 rounded-md opacity-60" />
          <div className="w-[90%] h-[3px] bg-gray-700 rounded-md opacity-60" />
        </div>
      </div>
      
      {/* 3D cube effect with side and front faces */}
      <div className="absolute -left-3 top-0 bottom-0 w-[12px] h-full bg-gray-800 transform skew-y-[45deg] origin-bottom-left" />
      <div className="absolute -right-3 top-0 bottom-0 w-[12px] h-full bg-gray-700 transform skew-y-[-45deg] origin-bottom-right" />
      <div className="absolute left-0 right-0 -top-[10px] h-[10px] bg-gray-500 transform" 
           style={{ 
             clipPath: 'polygon(0 100%, 100% 100%, 90% 0, 10% 0)'
           }}
      />
    </motion.div>
  );
} 