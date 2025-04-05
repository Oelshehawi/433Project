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
  const [allPlayersReady, setAllPlayersReady] = useState(false);

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

  // Check if all players are ready and room status is "playing"
  useEffect(() => {
    if (currentRoom) {
      // Check if all players are ready and there are at least 2 players
      const playersReady = currentRoom.players.every(player => player.isReady);
      const enoughPlayers = currentRoom.players.length >= 2;
      
      if (playersReady && enoughPlayers) {
        setAllPlayersReady(true);
        
        // If room status is "playing", redirect to play page
        if (currentRoom.status === "playing") {
          console.log("Game is starting, redirecting to play page");
          router.push(`/game/${roomId}/play`);
        }
      }
    }
  }, [currentRoom, roomId, router]);

  // Listen for game_starting event
  useEffect(() => {
    const handleGameStarting = (event) => {
      console.log("Game starting event received, redirecting to play page");
      router.push(`/game/${roomId}/play`);
    };
    
    window.addEventListener("game_starting", handleGameStarting);
    return () => window.removeEventListener("game_starting", handleGameStarting);
  }, [roomId, router]);

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
        <h1 className="game-title text-5xl font-bold mb-6">{currentRoom.name}</h1>
        <p className="text-xl mb-2">
          Room ID: <span className="text-accent">{currentRoom.id}</span>
        </p>
        <p className="text-lg mb-8">
          Status: <span className="text-accent">{currentRoom.status}</span>
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {currentRoom.players.map((player) => (
            <div
              key={player.id}
              className={`p-4 rounded-lg border ${
                player.isReady 
                  ? "bg-green-900/30 border-green-500/50" 
                  : "bg-black/20 border-white/10"
              }`}
            >
              <h3 className="text-xl font-bold mb-2">
                {player.name}
                {player.id === currentRoom.hostId && (
                  <span className="ml-2 text-xs bg-accent px-2 py-1 rounded-full">Host</span>
                )}
              </h3>
              <p className={`${player.isReady ? "text-green-400" : "text-white/70"}`}>
                {player.isReady ? "Ready" : "Not Ready"}
              </p>
              <p className="text-xs text-white/50 mt-1">
                {player.playerType === "beagleboard" ? "BeagleBoard Player" : "Web Player"}
              </p>
            </div>
          ))}
        </div>

        {allPlayersReady ? (
          <div className="text-accent text-lg animate-pulse mb-4">
            All players are ready! Waiting for game to start...
          </div>
        ) : (
          <div className="text-white/70 text-sm mb-4">
            <p>Waiting for all players to be ready...</p>
          </div>
        )}

        <button
          onClick={() => router.push("/")}
          className="mt-4 bg-primary hover:bg-primary-dark text-white font-bold py-2 px-6 rounded-lg"
        >
          Back to Home
        </button>

        {error && (
          <div className="bg-danger/20 text-danger p-3 rounded-md mt-4">
            {error}
          </div>
        )}
      </motion.div>

      {/* Battle divider - more intimidating */}
      <div className="absolute h-full left-1/2 transform -translate-x-1/2 z-20">
        {/* Main divider line */}
        <div className="absolute h-full w-3 bg-gradient-to-r from-red-700/70 via-red-500/80 to-red-700/70 shadow-[0_0_15px_rgba(220,38,38,0.7)]"></div>
        
        {/* Lightning/electricity effects */}
        <motion.div 
          className="absolute h-full w-1 bg-yellow-400/90 shadow-[0_0_10px_rgba(250,204,21,0.9)]"
          animate={{ 
            opacity: [0.2, 1, 0.5, 0.8, 0.3],
            scaleX: [0.5, 1.5, 0.8, 1.2, 0.7],
            x: [-1, 1, -2, 0, 2]
          }}
          transition={{
            repeat: Infinity,
            duration: 1.8,
            ease: "easeInOut"
          }}
        ></motion.div>
        
        {/* Battle zone markers */}
        {[...Array(8)].map((_, i) => (
          <motion.div 
            key={i}
            className="absolute w-5 h-5 rounded-full left-1/2 transform -translate-x-1/2"
            style={{
              top: `${12 + i * 10}%`,
              background: i % 2 === 0 ? 'rgba(239, 68, 68, 0.7)' : 'rgba(0, 0, 0, 0.5)',
              boxShadow: i % 2 === 0 ? '0 0 10px rgba(239, 68, 68, 0.9)' : 'none'
            }}
            animate={{ 
              scale: [1, 1.2, 1],
            }}
            transition={{
              repeat: Infinity,
              duration: 2,
              delay: i * 0.3,
              ease: "easeInOut"
            }}
          ></motion.div>
        ))}
      </div>
    </div>
  );
}
