"use client";

import React from "react";
import { motion } from "framer-motion";
import { RoomListItem } from "../lib/types/room";

interface RoomListProps {
  rooms: RoomListItem[];
  loading: boolean;
}

export const RoomList: React.FC<RoomListProps> = ({ rooms, loading }) => {
  // Animation variants
  const containerVariants = {
    initial: { opacity: 0, x: -30 },
    animate: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.3,
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    initial: { x: -20, opacity: 0 },
    animate: {
      x: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 20,
      },
    },
  };

  return (
    <motion.div
      className="absolute left-6 top-6 w-64 max-h-[calc(100vh-12rem)] z-10"
      variants={containerVariants}
      initial="initial"
      animate="animate"
    >
      <div className="mb-3">
        <h2 className="text-xl font-bold text-foreground/90 drop-shadow-lg">
          Available Rooms
        </h2>
      </div>

      {/* Room list */}
      <div className="bg-black/40 backdrop-blur-sm rounded-lg p-3 border border-white/10 shadow-xl overflow-y-auto scrollbar-hide">
        {loading ? (
          <p className="text-center py-3 text-foreground/70">
            Loading rooms...
          </p>
        ) : rooms.length === 0 ? (
          <p className="text-center py-3 text-foreground/70">
            No rooms available
          </p>
        ) : (
          <motion.div
            className="flex flex-col gap-2 max-h-[calc(100vh-16rem)]"
            variants={containerVariants}
          >
            {rooms.map((room) => (
              <motion.div
                key={room.id}
                className="bg-black/50 p-3 rounded-md border border-white/10 hover:border-white/20 transition-colors"
                variants={itemVariants}
              >
                <div>
                  <h3 className="font-medium text-foreground">{room.name}</h3>
                  <div className="flex items-center mt-1">
                    <span
                      className={`inline-block w-2 h-2 rounded-full mr-2 ${
                        room.playerCount >= room.maxPlayers
                          ? "bg-red-500"
                          : room.status === "playing"
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }`}
                    ></span>
                    <span className="text-sm text-foreground/80">
                      {room.playerCount}/{room.maxPlayers} players |{" "}
                      {room.playerCount >= room.maxPlayers
                        ? "Full"
                        : room.status === "playing"
                        ? "In Game"
                        : "Available"}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/50 mt-1">
                    ID: {room.id}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </motion.div>
  );
};
