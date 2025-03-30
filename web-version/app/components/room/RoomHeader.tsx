import React from "react";
import { motion } from "framer-motion";
import { Room } from "../../lib/types";

interface RoomHeaderProps {
  room: Room;
  onLeaveRoom: () => void;
}

export const RoomHeader: React.FC<RoomHeaderProps> = ({
  room,
  onLeaveRoom,
}) => {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
      <div>
        <h1 className="game-title text-3xl font-bold">{room.name}</h1>
        <p className="text-foreground/70">
          Room ID: <span className="font-mono">{room.id}</span>
        </p>
      </div>

      <motion.button
        className="mt-2 md:mt-0 px-4 py-2 bg-danger text-white rounded-md shadow-md"
        onClick={onLeaveRoom}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        Leave Room
      </motion.button>
    </div>
  );
};
