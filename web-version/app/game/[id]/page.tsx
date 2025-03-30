"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useRoomStore } from "../../lib/room/store";
import { initializeSocket, getSocketStatus } from "../../lib/websocket";
import { getSavedRoomInfo } from "../../components/room/RoomHelpers";

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;
  const { currentRoom, error } = useRoomStore();
  const [socketConnected, setSocketConnected] = useState(false);

  // Initialize WebSocket connection
  useEffect(() => {
    const socket = initializeSocket();
    console.log("WebSocket initializing in game page");

    // Check if socket is already connected
    if (getSocketStatus() === "connected") {
      setSocketConnected(true);
    } else {
      // Set up event listener for socket connection
      const handleSocketConnected = () => {
        console.log("WebSocket connected in game page");
        setSocketConnected(true);
      };

      window.addEventListener("ws_connected", handleSocketConnected);

      return () => {
        window.removeEventListener("ws_connected", handleSocketConnected);
      };
    }
  }, []);

  // Verify we have proper room data
  useEffect(() => {
    // If we're connected but have no room data, try to get it from localStorage
    if (socketConnected && !currentRoom) {
      const savedInfo = getSavedRoomInfo();

      if (!savedInfo.roomId || savedInfo.roomId !== roomId) {
        // No valid saved info, redirect to home
        console.log("No valid room info found, redirecting to home");
        router.push("/");
        return;
      }
    }
  }, [socketConnected, currentRoom, roomId, router]);

  if (!socketConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
        <p className="text-white/70">Connecting to server...</p>
      </div>
    );
  }

  if (!currentRoom) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
        <p className="text-white/70">Loading game data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <motion.div
        className="bg-black/30 backdrop-blur-sm rounded-lg p-8 w-full max-w-4xl border border-white/10 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="game-title text-5xl font-bold mb-6">Game in Progress</h1>
        <p className="text-xl mb-8">
          Room: <span className="text-accent">{currentRoom.name}</span>
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {currentRoom.players
            .filter((player) => player.playerType === "beagleboard")
            .map((player) => (
              <div
                key={player.id}
                className="bg-black/20 p-4 rounded-lg border border-white/10"
              >
                <h3 className="text-xl font-bold mb-2">{player.name}</h3>
                <p className="text-accent">Waiting for gameplay data...</p>
              </div>
            ))}
        </div>

        <div className="text-white/70 text-sm">
          <p>Game implementation coming soon!</p>
          <p className="mt-4">
            This page will display the game state once it's implemented.
          </p>
        </div>

        <button
          onClick={() => router.push("/")}
          className="mt-8 bg-primary hover:bg-primary-dark text-white font-bold py-2 px-6 rounded-lg"
        >
          Back to Home
        </button>

        {error && (
          <div className="bg-danger/20 text-danger p-3 rounded-md mt-4">
            {error}
          </div>
        )}
      </motion.div>
    </div>
  );
}
