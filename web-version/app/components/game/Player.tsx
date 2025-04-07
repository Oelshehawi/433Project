import { motion } from "framer-motion";

interface PlayerProps {
  playerId: string;
  name: string;
  isVisible: boolean;
}

export default function Player({ playerId, name, isVisible }: PlayerProps) {
  if (!isVisible) return null;

  const isPlayer1 = playerId === "player1";

  return (
    <motion.div
      className={`absolute bottom-5 ${
        isPlayer1 ? "left-[25%]" : "right-[25%]"
      } transform ${
        isPlayer1 ? "-translate-x-1/2" : "translate-x-1/2"
      } flex flex-col items-center`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      {/* Player Avatar */}
      <div
        className={`w-20 h-20 rounded-full bg-gradient-to-br ${
          isPlayer1 ? "from-blue-500 to-blue-700" : "from-red-500 to-red-700"
        } flex items-center justify-center shadow-lg`}
      >
        <span className="text-white text-3xl font-bold">
          {isPlayer1 ? "P1" : "P2"}
        </span>
      </div>

      {/* Player Name */}
      <div className="mt-2 bg-gray-900/70 px-3 py-1 rounded-md">
        <span
          className={`text-lg font-bold ${
            isPlayer1 ? "text-blue-300" : "text-red-300"
          }`}
        >
          {name}
        </span>
      </div>
    </motion.div>
  );
}
