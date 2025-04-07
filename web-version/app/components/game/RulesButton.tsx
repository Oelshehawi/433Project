import { useState } from "react";
import { motion } from "framer-motion";
import RulesScroll from "./RulesScroll";

export default function RulesButton() {
  const [showRules, setShowRules] = useState(false);

  return (
    <>
      <motion.button
        className="absolute top-4 left-4 z-50 bg-amber-800 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg"
        onClick={() => setShowRules(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        Rules
      </motion.button>

      {/* Show rules modal when button is clicked */}
      <RulesScroll
        isVisible={showRules}
        onAnimationComplete={() => setShowRules(false)}
      />
    </>
  );
}
