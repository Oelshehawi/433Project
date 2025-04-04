import { motion } from "framer-motion";

export default function CenterDivider() {
  return (
    <motion.div 
      className="absolute h-full w-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-b from-red-700 via-red-600 to-red-700 z-20"
      style={{
        boxShadow: "0 0 20px #ff0000, 0 0 40px #ff0000, 0 0 60px #ff0000"
      }}
      animate={{
        opacity: [0.8, 1, 0.8],
        width: ["14px", "18px", "14px"]
      }}
      transition={{
        duration: 1.8,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      {/* Lightning flashes */}
      <motion.div 
        className="absolute inset-0 bg-yellow-300"
        animate={{
          opacity: [0, 0.7, 0],
        }}
        transition={{
          duration: 0.2,
          repeat: Infinity,
          repeatDelay: 3 + Math.random() * 5,
          ease: "easeOut"
        }}
      />
    </motion.div>
  );
} 