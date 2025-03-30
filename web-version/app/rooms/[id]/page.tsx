"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useRoomStore } from "../../lib/room/store";
import { initializeSocket, getSocketStatus } from "../../lib/websocket";
import { RoomHeader } from "../../components/room/RoomHeader";
import { PlayerList } from "../../components/room/PlayerList";
import { RoomActions } from "../../components/room/RoomActions";
import {
  getSavedRoomInfo,
  isWebViewer,
  getCurrentPlayer,
  getBeagleBoardPlayerCount,
} from "../../components/room/RoomHelpers";

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;
  const { currentRoom, error, leaveRoom, setPlayerReady, joinRoom } =
    useRoomStore();
  const [isLoading, setIsLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  // Initialize WebSocket and wait for connection
  useEffect(() => {
    initializeSocket();
    console.log("WebSocket initializing in room page");

    // Check if socket is already connected
    if (getSocketStatus() === "connected") {
      setSocketConnected(true);
    } else {
      // Set up event listener for socket connection
      const handleSocketConnected = () => {
        console.log("WebSocket connected, ready to fetch room data");
        setSocketConnected(true);
      };

      window.addEventListener("ws_connected", handleSocketConnected);

      return () => {
        window.removeEventListener("ws_connected", handleSocketConnected);
      };
    }
  }, []);

  // Fetch room data once socket is connected
  useEffect(() => {
    if (!socketConnected) return;

    // If we don't have a current room, try to recover from localStorage
    if (!currentRoom) {
      const savedInfo = getSavedRoomInfo();

      // If we have saved info and it matches the current URL roomId
      if (
        savedInfo.roomId &&
        savedInfo.roomId === roomId &&
        savedInfo.playerName
      ) {
        console.log("Rejoining room from saved session:", savedInfo.roomId);

        // Re-join the room as a web viewer
        joinRoom({
          roomId: savedInfo.roomId,
          playerName: savedInfo.playerName || "Web Viewer",
          playerType: "webviewer",
        });
      } else {
        // No saved info or different room, redirect to home
        router.push("/");
        return;
      }
    }

    setIsLoading(false);
  }, [currentRoom, router, roomId, joinRoom, socketConnected]);

  // Handle game start
  useEffect(() => {
    if (currentRoom?.status === "playing" && !transitioning) {
      setTransitioning(true);

      // Show transition animation before navigating
      setTimeout(() => {
        // Navigate to the game page
        router.push(`/game/${roomId}`);
      }, 2000); // 2 second delay for animation
    }
  }, [currentRoom?.status, roomId, router, transitioning]);

  // Handle browser back button
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // This prevents accidental navigation away but allows intentional navigation
      if (currentRoom) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
      return undefined;
    };

    const handlePopState = (e: PopStateEvent) => {
      // If user is navigating back/forward with browser buttons
      console.log("Navigation event detected", e);
      if (currentRoom) {
        // Attempt to leave the room cleanly
        leaveRoom().catch((err: Error) =>
          console.error("Error leaving room during navigation:", err)
        );
      }
    };

    // Add event listeners
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);

    // Cleanup on component unmount
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [currentRoom, leaveRoom]);

  // Set up a single unified event listener for all room updates
  useEffect(() => {
    // Unified room update handler that handles all room events
    const handleRoomUpdate = (event: CustomEvent) => {
      const { room } = event.detail || {};

      // If this is an update for our current room
      if (room && room.id === roomId) {
        console.log("Room update received:", room);

        // Update current room in the store
        useRoomStore.setState({ currentRoom: room });
      }
    };

    // Listen for room_updated events
    window.addEventListener("room_updated", handleRoomUpdate as EventListener);

    // Also listen for room list events to ensure consistent state
    const handleRoomList = (event: CustomEvent) => {
      console.log("Room list received, updating from event payload");
      // Instead of fetching rooms again, update directly from payload
      if (event.detail && event.detail.rooms) {
        useRoomStore.setState({ availableRooms: event.detail.rooms });
      }
    };

    window.addEventListener("room_list", handleRoomList as EventListener);

    return () => {
      window.removeEventListener(
        "room_updated",
        handleRoomUpdate as EventListener
      );
      window.removeEventListener("room_list", handleRoomList as EventListener);
    };
  }, [roomId]);

  const handleLeaveRoom = async () => {
    console.log("Leaving room...");

    // Clear localStorage data first for immediate UI feedback
    if (typeof window !== "undefined") {
      localStorage.removeItem("currentRoomId");
      localStorage.removeItem("currentPlayerId");
      localStorage.removeItem("currentPlayerName");
      console.log("Cleared room data from localStorage");
    }

    try {
      // Send leave room message to server
      await leaveRoom();
      console.log("Successfully left room");
    } catch (error) {
      console.error("Error leaving room:", error);
    } finally {
      // Navigate back to home page
      router.push("/");
    }
  };

  const handleToggleReady = async () => {
    if (!currentRoom) return;

    // Find the current player using localStorage ID
    const savedInfo = getSavedRoomInfo();
    const currentPlayerId = savedInfo.playerId;

    if (!currentPlayerId) {
      console.error("Cannot toggle ready: No player ID found in localStorage");
      return;
    }

    // Find the current player in the room
    const currentPlayer = currentRoom.players.find(
      (p) => p.id === currentPlayerId
    );

    if (currentPlayer) {
      console.log(
        `Toggling ready state for player ${currentPlayer.name} (${
          currentPlayer.id
        }): ${!currentPlayer.isReady}`
      );
      await setPlayerReady(!currentPlayer.isReady);
    } else {
      console.error("Current player not found in room");
    }
  };

  // Get derived state
  const currentPlayer = currentRoom
    ? getCurrentPlayer(currentRoom.players)
    : null;
  const isHost = currentRoom?.hostId === currentPlayer?.id;
  const allPlayersReady = currentRoom?.players.every((p) => p.isReady);
  const beagleBoardPlayerCount = currentRoom
    ? getBeagleBoardPlayerCount(currentRoom.players)
    : 0;

  // Loading or connecting state
  if (isLoading || !socketConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
        <p className="text-white/70">
          {!socketConnected
            ? "Connecting to server..."
            : "Loading room data..."}
        </p>
      </div>
    );
  }

  // Not found state
  if (!currentRoom) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h2 className="game-title text-3xl font-bold mb-4">Room not found</h2>
        <button
          className="bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-lg"
          onClick={() => router.push("/")}
        >
          Back to Home
        </button>
      </div>
    );
  }

  // Game starting transition
  if (transitioning) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h2 className="game-title text-5xl font-bold mb-6 text-accent">
            Game Starting!
          </h2>
          <p className="text-white/70 text-xl">Preparing the tower...</p>
          <div className="mt-8 flex justify-center">
            <div className="animate-bounce bg-accent p-4 rounded-full">
              <svg
                className="w-12 h-12 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                ></path>
              </svg>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="bg-black/30 backdrop-blur-sm rounded-lg p-6 w-full max-w-4xl border border-white/10">
        <motion.div
          className="flex flex-col gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <RoomHeader room={currentRoom} onLeaveRoom={handleLeaveRoom} />

          <PlayerList
            players={currentRoom.players}
            hostId={currentRoom.hostId}
          />

          <RoomActions
            isWebViewer={isWebViewer()}
            isHost={isHost}
            currentPlayer={currentPlayer}
            beagleBoardPlayerCount={beagleBoardPlayerCount}
            maxPlayers={currentRoom.maxPlayers}
            roomId={currentRoom.id}
            status={currentRoom.status}
            allPlayersReady={!!allPlayersReady}
            onToggleReady={handleToggleReady}
          />

          {/* Error message */}
          {error && (
            <div className="bg-danger/20 text-danger p-3 rounded-md mt-4">
              {error}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
