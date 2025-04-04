import { motion, AnimatePresence } from "framer-motion";

interface GestureTowerTitleProps {
  isVisible: boolean;
  onAnimationComplete: () => void;
}

export default function GestureTowerTitle({ isVisible, onAnimationComplete }: GestureTowerTitleProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div 
          className="absolute inset-0 flex items-center justify-center z-50 bg-black/70"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.h1
            className="text-8xl font-extrabold text-red-600"
            style={{ 
              textShadow: "0 0 8px #ff0000, 0 0 15px #ff0000, 0 0 3px #ffffff",
              fontFamily: "Impact, fantasy",
              letterSpacing: "4px",
              WebkitTextStroke: "2px #000", 
              filter: "drop-shadow(0 4px 3px rgba(0, 0, 0, 0.7))" 
            }}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{
              scale: [0.5, 1.2, 1.1, 1.2, 1],
              opacity: [0, 1, 1, 1, 1],
              x: [0, -10, 10, -10, 0],
              y: [0, 10, -10, 5, 0],
              rotateZ: [0, -2, 2, -2, 0]
            }}
            transition={{ 
              duration: 2.5,
              times: [0, 0.2, 0.4, 0.6, 1],
            }}
            onAnimationComplete={onAnimationComplete}
          >
            GESTURE TOWER
          </motion.h1>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 