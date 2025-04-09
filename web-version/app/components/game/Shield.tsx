import { motion } from "framer-motion";

interface ShieldProps {
  playerId: string;
  isVisible: boolean;
}

export default function Shield({ playerId, isVisible }: ShieldProps) {
  if (!isVisible) return null;

  const isPlayer1 = playerId === "player1";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{ type: "spring", damping: 12 }}
    >
      {/* Shield Glow Effect */}
      <div className="absolute inset-0 bg-purple-500 rounded-full filter blur-xl opacity-50 scale-125 animate-pulse"></div>

      {/* Shield Circle */}
      <motion.div
        className={`w-24 h-24 rounded-full bg-gradient-to-br ${
          isPlayer1
            ? "from-blue-400 to-purple-600"
            : "from-red-400 to-purple-600"
        } flex items-center justify-center border-4 border-white/30 shadow-lg z-10`}
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      >
        <motion.div
          className="w-16 h-16 rounded-full bg-purple-500/30 backdrop-blur-sm flex items-center justify-center border border-white/50"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <svg
            className="w-10 h-10 text-white"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
          </svg>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
