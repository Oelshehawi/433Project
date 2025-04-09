import { motion } from "framer-motion";
import Image from "next/image";
import { useState, useEffect } from "react";

interface GameBackgroundProps {
  onAnimationComplete?: () => void;
}

export default function GameBackground({ onAnimationComplete }: GameBackgroundProps) {
  // Background options from the public/background folder
  const backgroundOptions = [
    "/background/bamboo bridge.png",
    "/background/castle bridge.png",
    "/background/forest bridge.png",
    "/background/sky bridge.png"
  ];
  
  // Randomly select one background on component mount
  const [selectedBackground, setSelectedBackground] = useState<string>("");
  
  useEffect(() => {
    // Select a random background on component mount
    const randomIndex = Math.floor(Math.random() * backgroundOptions.length);
    setSelectedBackground(backgroundOptions[randomIndex]);
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 z-0 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.5, ease: "easeOut" }}
      onAnimationComplete={onAnimationComplete}
    >
      {/* Main background image - randomly selected */}
      {selectedBackground && (
        <div className="absolute inset-0">
          <Image 
            src={selectedBackground}
            alt="Game Background"
            fill
            className="object-cover"
            priority
          />
        </div>
      )}
    </motion.div>
  );
} 