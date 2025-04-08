import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface GameAnimationProps {
  showTitleAnimation: boolean;
  showRulesAnimation: boolean;
  onTitleAnimationComplete: () => void;
  onRulesAnimationComplete: () => void;
}

const GameAnimation: React.FC<GameAnimationProps> = ({
  showTitleAnimation,
  showRulesAnimation,
  onTitleAnimationComplete,
  onRulesAnimationComplete,
}) => {
  const [titleAnimationStep, setTitleAnimationStep] = useState(0);

  useEffect(() => {
    if (showTitleAnimation) {
      const timeout = setTimeout(() => {
        setTitleAnimationStep(1);
        setTimeout(() => {
          setTitleAnimationStep(2);
          setTimeout(() => {
            onTitleAnimationComplete();
          }, 2000);
        }, 1500);
      }, 1000);

      return () => clearTimeout(timeout);
    }
  }, [showTitleAnimation, onTitleAnimationComplete]);

  const titleVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, scale: 0.8 },
  };

  const rulesVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };

  return (
    <>
      <AnimatePresence>
        {showTitleAnimation && (
          <motion.div
            className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={titleVariants}
            transition={{ duration: 0.5 }}
          >
            {titleAnimationStep === 0 && (
              <motion.div
                className="text-4xl md:text-6xl font-bold text-primary mb-4"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                Get Ready
              </motion.div>
            )}

            {titleAnimationStep === 1 && (
              <motion.div
                className="text-5xl md:text-7xl font-bold text-white"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                Tower Tactics
              </motion.div>
            )}

            {titleAnimationStep === 2 && (
              <motion.div
                className="text-3xl md:text-5xl font-bold text-primary"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                Battle Begins!
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRulesAnimation && (
          <motion.div
            className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-4"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={rulesVariants}
            transition={{ duration: 0.5 }}
          >
            <div className="bg-card p-6 rounded-lg max-w-2xl w-full">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-6">
                Game Rules
              </h2>

              <div className="space-y-4 text-muted-foreground mb-6">
                <p>• Each player controls a tower with multiple blocks</p>
                <p>
                  • Take turns to attack your opponent's tower or defend your
                  own
                </p>
                <p>• Use gestures to perform different actions:</p>
                <ul className="list-disc pl-8 space-y-2">
                  <li>Punch gesture: Attack opponent's tower</li>
                  <li>Shield gesture: Defend your tower from attacks</li>
                  <li>Special gestures unlock powerful abilities</li>
                </ul>
                <p>• First player to destroy all opponent's blocks wins!</p>
              </div>

              <div className="flex justify-center">
                <motion.button
                  onClick={onRulesAnimationComplete}
                  className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Let's Play!
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default GameAnimation;
