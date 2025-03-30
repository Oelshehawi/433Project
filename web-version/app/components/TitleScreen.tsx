"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRoomStore } from "../lib/room/store";
import { CreateRoomForm } from "./CreateRoomForm";
import { ViewRoomForm } from "./ViewRoomForm";
import { RoomList } from "./RoomList";
import { useRouter } from "next/navigation";
import { initializeSocket } from "../lib/websocket";

interface TitleScreenProps {
  onStart?: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = () => {
  const router = useRouter();
  const {
    createRoom,
    joinRoom,
    currentRoom,
    error,
    fetchRooms,
    availableRooms,
    loading,
  } = useRoomStore();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);

  // Initialize WebSocket and fetch rooms
  useEffect(() => {
    // Initialize socket if not already done
    console.log("Initializing WebSocket connection from TitleScreen...");
    initializeSocket();

    // Fetch rooms when component mounts
    console.log("Fetching available rooms...");
    fetchRooms();

    // Add event listeners for room updates
    const handleRoomUpdated = (event: any) => {
      console.log("Room updated event received:", event.detail);
      // Refresh room list when a room is updated
      fetchRooms();
    };

    const handleRoomList = (event: any) => {
      console.log("Room list event received:", event.detail);
      // Update rooms state directly from the event payload
      if (event.detail && event.detail.rooms) {
        useRoomStore.setState({ availableRooms: event.detail.rooms });
      }
    };

    window.addEventListener("room_updated", handleRoomUpdated);
    window.addEventListener("room_list", handleRoomList);

    return () => {
      console.log("Cleaning up TitleScreen");
      window.removeEventListener("room_updated", handleRoomUpdated);
      window.removeEventListener("room_list", handleRoomList);
    };
  }, [fetchRooms]);

  // Check if we're in a room and navigate
  useEffect(() => {
    if (currentRoom) {
      console.log("Navigating to room:", currentRoom.id);
      // Navigate to the room page
      router.push(`/rooms/${currentRoom.id}`);
    }
  }, [currentRoom, router]);

  // Title animation variants
  const titleVariants = {
    initial: { y: -50, opacity: 0 },
    animate: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 120,
        damping: 10,
        delay: 0.2,
      },
    },
  };

  // Floating elements animation variants
  const floatingVariants = {
    animate: {
      y: [0, -20, 0],
      transition: {
        duration: 3,
        ease: "easeInOut",
        repeat: Infinity,
        repeatType: "reverse" as const,
      },
    },
  };

  // Container animation variants
  const containerVariants = {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        duration: 0.5,
        staggerChildren: 0.1,
      },
    },
    exit: {
      opacity: 0,
      transition: {
        duration: 0.3,
      },
    },
  };

  // Tower block animations
  const blockVariants = {
    initial: { opacity: 0, y: 20 },
    animate: (custom: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 10,
        delay: custom * 0.1,
      },
    }),
  };

  // Room management handlers
  const handleCreateRoom = () => {
    console.log("Opening create room form");
    setShowCreateForm(true);
    setShowJoinForm(false);
  };

  const handleCreateRoomSubmit = async (roomName: string) => {
    console.log("Attempting to create room:", { roomName });
    try {
      // No player name needed - we're creating an empty room
      await createRoom({ name: roomName });
      console.log("Room creation request sent");
      setShowCreateForm(false);
    } catch (err) {
      console.error("Failed to create room:", err);
    }
  };

  const handleJoinRoomClick = () => {
    console.log("Opening join room form");
    setShowJoinForm(true);
    setShowCreateForm(false);
  };

  const handleJoinRoomSubmit = async (joinRoomId: string) => {
    if (!joinRoomId) {
      console.error("No room ID provided");
      return;
    }

    console.log("Attempting to view room:", { joinRoomId });
    try {
      // Store room ID in localStorage and navigate
      localStorage.setItem("currentRoomId", joinRoomId);
      localStorage.setItem("currentPlayerId", "viewer-" + crypto.randomUUID());
      localStorage.setItem("currentPlayerName", "Web Viewer");

      // Navigate to the room
      router.push(`/rooms/${joinRoomId}`);
    } catch (err) {
      console.error("Failed to view room:", err);
    }
  };

  return (
    <>
      <div className="min-h-screen w-full flex flex-col items-center justify-center overflow-hidden">
        <motion.div
          className="relative flex flex-col items-center justify-center gap-8 p-8 max-w-4xl w-full"
          variants={containerVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {/* Game title */}
          <motion.h1
            className="game-title text-5xl sm:text-6xl md:text-7xl font-bold text-center text-white drop-shadow-[0_0_15px_rgba(124,58,237,0.5)]"
            variants={titleVariants}
          >
            <motion.span
              className="block"
              variants={floatingVariants}
              animate="animate"
            >
              Gesture Tower
            </motion.span>
          </motion.h1>
            <>
              {/* Animated tower graphic */}
              <div className="flex items-end justify-center mt-4 mb-8 h-64 relative">
                {/* Left player tower */}
                <div className="flex flex-col-reverse items-center mr-12">
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={`left-${i}`}
                      className="w-20 h-12 bg-gradient-to-r from-primary-dark to-primary rounded-md mb-1"
                      custom={i}
                      variants={blockVariants}
                      initial="initial"
                      animate="animate"
                      style={{ marginLeft: i % 2 === 0 ? "-10px" : "10px" }}
                    />
                  ))}
                </div>

                {/* Goal marker */}
                <motion.div
                  className="absolute top-0 w-16 h-16 bg-accent rounded-full flex items-center justify-center text-sm"
                  animate={{
                    y: [-10, 10],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    repeatType: "reverse",
                  }}
                >
                  <span className="text-background font-bold">GOAL</span>
                </motion.div>

                {/* Right player tower */}
                <div className="flex flex-col-reverse items-center ml-12">
                  {[...Array(4)].map((_, i) => (
                    <motion.div
                      key={`right-${i}`}
                      className="w-20 h-12 bg-gradient-to-r from-secondary-dark to-secondary rounded-md mb-1"
                      custom={i}
                      variants={blockVariants}
                      initial="initial"
                      animate="animate"
                      style={{ marginLeft: i % 2 === 0 ? "10px" : "-10px" }}
                    />
                  ))}
                </div>
              </div>

              {/* Game room buttons */}
              <div className="flex flex-col sm:flex-row gap-4 mt-6">
                <button
                  className="bg-secondary hover:bg-secondary-dark text-white font-bold py-3 px-6 rounded-lg shadow-lg"
                  onClick={handleCreateRoom}
                >
                  Create Room
                </button>

                <button
                  className="bg-accent hover:bg-accent-dark text-white font-bold py-3 px-6 rounded-lg shadow-lg"
                  onClick={handleJoinRoomClick}
                >
                  View Room
                </button>
              </div>
            </>

          {/* Create room form modal */}
          {showCreateForm && (
            <CreateRoomForm
              onSubmit={handleCreateRoomSubmit}
              onCancel={() => setShowCreateForm(false)}
            />
          )}

          {/* View room form modal */}
          {showJoinForm && (
            <ViewRoomForm
              onSubmit={handleJoinRoomSubmit}
              onCancel={() => setShowJoinForm(false)}
            />
          )}

          {error && (
            <div className="bg-danger/20 text-danger p-3 rounded-md mt-4 max-w-md">
              {error}
            </div>
          )}
        </motion.div>
      </div>

      <RoomList
        rooms={availableRooms}
        loading={loading}
        onCreateClick={handleCreateRoom}
      />
    </>
  );
};
