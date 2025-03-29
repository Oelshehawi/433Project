"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TitleScreen } from "./components/TitleScreen";
import {
  initializeSocket,
  getSocketStatus,
  saveRoomInfo,
  logConnectionDetails,
} from "./lib/websocket";
import { NavigateToRoomEvent } from "./lib/types";

export default function Home() {
  const router = useRouter();
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "connecting" | "disconnected"
  >("connecting");

  // Clear any mock data on startup
  useEffect(() => {
    // Also clear any room data that might be stored incorrectly
    if (typeof window !== "undefined") {
      // Check if localStorage contains JSON array instead of proper room data
      const storedRooms = localStorage.getItem("currentRoomId");
      if (storedRooms && storedRooms.startsWith("[")) {
        console.log("Found invalid room data, clearing localStorage");
        localStorage.clear();
      }
    }
  }, []);

  // Update connection status
  useEffect(() => {
    const checkConnection = () => {
      setConnectionStatus(getSocketStatus());
    };

    // Check immediately
    checkConnection();

    // Then check periodically
    const intervalId = setInterval(checkConnection, 2000);

    return () => clearInterval(intervalId);
  }, []);

  // Handle navigation events
  useEffect(() => {
    // Skip if not in browser
    if (typeof window === "undefined") return;

    // Handle room navigation
    const handleNavigateToRoom = (event: Event) => {
      const { roomId, playerId, playerName } = (event as NavigateToRoomEvent)
        .detail;
      console.log("Navigation event received:", {
        roomId,
        playerId,
        playerName,
      });

      if (roomId) {
        // Save room info (redundant but ensures consistency)
        saveRoomInfo(roomId, playerId, playerName);

        // Navigate to the room page
        console.log(`Navigating to rooms/${roomId}`);
        router.push(`/rooms/${roomId}`);
      } else {
        console.warn("Navigation event received but no roomId provided");
      }
    };

    // Handle game navigation
    const handleNavigateToGame = (event: Event) => {
      const { roomId } = (event as CustomEvent).detail;
      console.log("Game navigation event received:", { roomId });

      if (roomId) {
        // Navigate to the game page
        console.log(`Navigating to game/${roomId}`);
        router.push(`/game/${roomId}`);
      }
    };

    // Add event listeners
    window.addEventListener("navigate_to_room", handleNavigateToRoom);
    window.addEventListener("navigate_to_game", handleNavigateToGame);

    // Clean up
    return () => {
      window.removeEventListener("navigate_to_room", handleNavigateToRoom);
      window.removeEventListener("navigate_to_game", handleNavigateToGame);
    };
  }, [router]);

  // Initialize WebSocket when component mounts
  useEffect(() => {
    // Initialize socket connection
    initializeSocket();

    // Log connection details after initialization
    setTimeout(() => {
      logConnectionDetails();
    }, 1000);

    // Check if user should be redirected to a saved room
    if (typeof window !== "undefined") {
      const roomId = localStorage.getItem("currentRoomId");
      const playerId = localStorage.getItem("currentPlayerId");
      const playerName = localStorage.getItem("currentPlayerName");

      // If we have all the room data and we're on the home page, redirect to the room
      if (roomId && playerId && playerName) {
        console.log("Found saved room info, redirecting to room:", roomId);
        setTimeout(() => {
          router.push(`/rooms/${roomId}`);
        }, 500);
      }
    }

    // Don't close WebSocket on component unmount as we need it for navigation
    return () => {
      console.log(
        "Home component unmounting, keeping WebSocket connection alive"
      );
    };
  }, [router]);

  return (
    <main className="min-h-screen">
      <TitleScreen />

      {connectionStatus !== "connected" && (
        <div
          className={`fixed bottom-4 right-4 px-3 py-1 rounded-lg text-sm ${
            connectionStatus === "connecting" ? "bg-yellow-600" : "bg-red-600"
          } text-white`}
        >
          {connectionStatus === "connecting"
            ? "Connecting to server..."
            : "Disconnected from server"}
        </div>
      )}
    </main>
  );
}
