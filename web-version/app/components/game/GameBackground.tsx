import { motion } from "framer-motion";

interface GameBackgroundProps {
  onAnimationComplete?: () => void;
}

export default function GameBackground({ onAnimationComplete }: GameBackgroundProps) {
  return (
    <motion.div 
      className="absolute inset-0 z-0 bg-gradient-to-b from-sky-400 to-sky-300 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.5, ease: "easeOut" }}
      onAnimationComplete={onAnimationComplete}
    >
      {/* Grass texture */}
      <div className="absolute bottom-0 w-full h-1/3 bg-gradient-to-t from-green-600 to-green-500">
        {/* Subtle grass texture pattern */}
        <div className="absolute inset-0 opacity-30 bg-repeat-x" 
             style={{ backgroundImage: "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"50\" height=\"20\" viewBox=\"0 0 50 20\"><path d=\"M0,20 Q5,0 10,20 Q15,5 20,20 Q25,0 30,20 Q35,5 40,20 Q45,0 50,20 Z\" fill=\"%23166534\"/></svg>')" }}></div>
      </div>
    </motion.div>
  );
} 