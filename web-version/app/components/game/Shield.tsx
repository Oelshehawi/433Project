import { motion } from "framer-motion";

interface ShieldProps {
  isActive: boolean;
  playerSide: 'left' | 'right';
  blockCount: number;
}

export default function Shield({ isActive, playerSide, blockCount = 0 }: ShieldProps) {
  if (!isActive) return null;
  
  // Calculate position based on tower blocks
  const blockHeight = 40; // Same as in TowerBlock component
  const bottomOffset = blockCount * blockHeight;
  
  // Position adjustments to place shield in front of player
  const positionStyles = {
    left: playerSide === 'left' ? 'calc(25% - 20px)' : 'auto',
    right: playerSide === 'right' ? 'calc(25% - 20px)' : 'auto',
    bottom: `${bottomOffset + 20}px`
  };
  
  return (
    <motion.div
      className="absolute z-50"
      style={positionStyles}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ 
        opacity: 1, 
        scale: [0.9, 1.1, 1],
      }}
      transition={{
        duration: 0.5,
        scale: {
          repeat: Infinity,
          repeatType: "reverse",
          duration: 2
        }
      }}
    >
      {/* Shield circle */}
      <div 
        className="w-36 h-36 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(147, 51, 234, 0.7) 0%, rgba(168, 85, 247, 0.5) 40%, rgba(192, 132, 252, 0.3) 80%, rgba(216, 180, 254, 0) 100%)",
          boxShadow: "0 0 15px #a855f7, 0 0 30px #a855f7",
          filter: "blur(1px)"
        }}
      />
      
      {/* Shield inner glow/pulsing effect */}
      <motion.div 
        className="absolute inset-0 w-36 h-36 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(168, 85, 247, 0.4) 0%, rgba(192, 132, 252, 0.1) 50%, transparent 70%)",
        }}
        animate={{
          opacity: [0.3, 0.8, 0.3]
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      {/* Shield hexagon pattern */}
      <div 
        className="absolute inset-0 w-36 h-36 rounded-full overflow-hidden opacity-20"
        style={{
          backgroundImage: "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"50\" height=\"50\" viewBox=\"0 0 50 50\"><path d=\"M25,2 L48,13 L48,37 L25,48 L2,37 L2,13 Z\" fill=\"none\" stroke=\"%23d8b4fe\" stroke-width=\"1\"/></svg>')",
          backgroundSize: "15px 15px"
        }}
      />
    </motion.div>
  );
} 