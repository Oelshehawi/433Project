import { motion } from "framer-motion";
import Image from "next/image";

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
      <div className="w-20 h-20 relative">
        <Image
          src={isPlayer1 ? "/p1.png" : "/p2.png"}
          alt={isPlayer1 ? "Player 1" : "Player 2"}
          width={80}
          height={80}
          className="rounded-full shadow-lg"
        />
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
