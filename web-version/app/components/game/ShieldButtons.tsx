import { motion } from "framer-motion";

interface ShieldButtonsProps {
  onPlayer1Shield: () => void;
  onPlayer2Shield: () => void;
  isPlayer1ShieldActive: boolean;
  isPlayer2ShieldActive: boolean;
  isVisible: boolean;
}

export default function ShieldButtons({
  onPlayer1Shield,
  onPlayer2Shield,
  isPlayer1ShieldActive,
  isPlayer2ShieldActive,
  isVisible
}: ShieldButtonsProps) {
  if (!isVisible) return null;

  return (
    <div className="absolute top-16 left-0 right-0 flex justify-between px-12 z-40">
      {/* Player 1 Shield Button */}
      <motion.button
        className={`px-4 py-2 rounded-lg font-bold shadow-lg flex items-center space-x-2 ${
          isPlayer1ShieldActive 
            ? "bg-purple-600 text-white" 
            : "bg-gray-700 text-white hover:bg-purple-500 transition-colors"
        }`}
        onClick={onPlayer1Shield}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-5 w-5" 
          viewBox="0 0 20 20" 
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M10 2a8 8 0 00-8 8 8 8 0 1016 0 8 8 0 00-8-8zm0 2a6 6 0 00-3.912 10.526A5.944 5.944 0 0010 16a5.944 5.944 0 003.912-1.474A6 6 0 0010 4z" clipRule="evenodd" />
        </svg>
        <span>Shield</span>
        {isPlayer1ShieldActive && (
          <motion.span 
            className="ml-1 inline-block w-2 h-2 bg-white rounded-full"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
          />
        )}
      </motion.button>

      {/* Player 2 Shield Button */}
      <motion.button
        className={`px-4 py-2 rounded-lg font-bold shadow-lg flex items-center space-x-2 ${
          isPlayer2ShieldActive 
            ? "bg-purple-600 text-white" 
            : "bg-gray-700 text-white hover:bg-purple-500 transition-colors"
        }`}
        onClick={onPlayer2Shield}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <span>Shield</span>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-5 w-5" 
          viewBox="0 0 20 20" 
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M10 2a8 8 0 00-8 8 8 8 0 1016 0 8 8 0 00-8-8zm0 2a6 6 0 00-3.912 10.526A5.944 5.944 0 0010 16a5.944 5.944 0 003.912-1.474A6 6 0 0010 4z" clipRule="evenodd" />
        </svg>
        {isPlayer2ShieldActive && (
          <motion.span 
            className="ml-1 inline-block w-2 h-2 bg-white rounded-full"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
          />
        )}
      </motion.button>
    </div>
  );
} 