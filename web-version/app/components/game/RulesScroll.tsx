import { motion } from "framer-motion";

interface RulesScrollProps {
  isVisible: boolean;
  onAnimationComplete: () => void;
}

export default function RulesScroll({ isVisible, onAnimationComplete }: RulesScrollProps) {
  if (!isVisible) return null;
  
  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center z-50 bg-black/70"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Scroll container */}
      <motion.div
        className="relative w-[80%] max-w-2xl"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ 
          duration: 0.8,
          ease: "easeOut",
        }}
      >
        {/* Scroll content */}
        <motion.div
          className="bg-amber-100 rounded-lg p-8 shadow-lg"
          style={{ 
            backgroundImage: `
              radial-gradient(circle, rgba(217,119,6,0.1) 2px, transparent 2px),
              linear-gradient(to right, rgba(180,83,9,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '15px 15px, 30px 30px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)'
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            duration: 1, 
            delay: 0.3,
          }}
          onAnimationComplete={() => {
            // Start the 10-second timer when the scroll is fully displayed
            setTimeout(onAnimationComplete, 10000);
          }}
        >
          <div className="space-y-5 text-amber-950 font-serif">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <h2 className="text-center text-2xl font-bold mb-1 text-amber-900">
                <strong>Game On!</strong>
              </h2>
              <p className="text-center">
                Build your tower to the target height FIRST to win! But watch out - your opponent is trying to knock it down!
              </p>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <h3 className="text-xl font-bold mb-1 text-amber-900">
                <strong>Quick Start!</strong>
              </h3>
              <ul className="space-y-1 list-inside">
                <li>Start with ZERO blocks!</li>
                <li>Race to build your tower to the TARGET NUMBER!</li>
                <li>Choose ONE action each turn:</li>
              </ul>
              
              <div className="ml-4 mt-2 space-y-1">
                <p className="font-semibold">ADD BLOCK! (Grow your tower!)</p>
                <p className="font-semibold">SHOOT! (Blast your opponent's tower down a level!)</p>
                <p className="font-semibold">BLOCK! (Defend against attacks!)</p>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
            >
              <h3 className="text-xl font-bold mb-1 text-amber-900">
                <strong>Watch Out!</strong>
              </h3>
              <ul className="space-y-1 list-inside">
                <li>Towers can't go below zero!</li>
                <li>Shooting at empty towers? Nothing happens!</li>
                <li>Blocking with no tower? Nice try, but no effect!</li>
              </ul>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
            >
              <h3 className="text-xl font-bold mb-1 text-amber-900">
                <strong>VICTORY!</strong>
              </h3>
              <p className="text-center font-semibold">
                First to reach the EXACT target height WINS THE GAME!
              </p>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
} 