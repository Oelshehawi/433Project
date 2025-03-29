"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRoomStore } from "../lib/room/store";
import { CreateRoomForm } from "./CreateRoomForm";
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

  // Initialize WebSocket and fetch rooms
  useEffect(() => {
    // Initialize socket if not already done
    console.log("Initializing WebSocket connection from TitleScreen...");
    initializeSocket();

    // Fetch rooms when component mounts and periodically
    console.log("Fetching available rooms...");
    fetchRooms();

    const intervalId = setInterval(() => {
      console.log("Periodic room refresh...");
      fetchRooms();
    }, 5000);

    return () => {
      console.log("Cleaning up TitleScreen, clearing interval");
      clearInterval(intervalId);
      // No need to remove socket event listeners
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

  // const buttonVariants = {
  //   initial: { scale: 0.9, opacity: 0 },
  //   animate: {
  //     scale: 1,
  //     opacity: 1,
  //     transition: {
  //       type: 'spring',
  //       stiffness: 200,
  //       damping: 15,
  //     },
  //   },
  //   hover: {
  //     scale: 1.05,
  //     transition: {
  //       type: 'spring',
  //       stiffness: 400,
  //       damping: 10,
  //     },
  //   },
  //   tap: { scale: 0.95 },
  // };

  // Room management handlers
  const handleCreateRoom = () => {
    console.log("Opening create room form");
    setShowCreateForm(true);
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

  // // No longer needed - joining is only done from Beagle Boards
  // const handleJoinRoomClick = () => {
  //   console.log('Opening join room form');
  //   setShowJoinForm(true);
  //   setShowCreateForm(false);
  // };

  // No longer needed - joining is only done from Beagle Boards
  // const handleJoinRoomSubmit = async (roomId: string, playerName: string) => {
  //   console.log('Attempting to join room:', { roomId, playerName });
  //   try {
  //     await joinRoom({ roomId, playerName });
  //     console.log('Room join request sent');
  //     setShowJoinForm(false);
  //   } catch (err) {
  //     console.error('Failed to join room:', err);
  //   }
  // };

  // No longer needed - joining is only done from Beagle Boards
  // const handleJoinRoomFromList = (roomId: string) => {
  //   console.log('Selected room from list:', roomId);
  //   setShowJoinForm(true);
  // };

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

          {/* Only show tower graphic and main buttons when no forms are visible */}
          {!showCreateForm && (
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
              {/* <div className='flex flex-col sm:flex-row gap-4 mt-6'>
                <motion.button
                  className='bg-secondary hover:bg-secondary-dark text-white font-bold py-3 px-6 rounded-lg shadow-lg'
                  onClick={handleCreateRoom}
                  variants={buttonVariants}
                  initial='initial'
                  animate='animate'
                  whileHover='hover'
                  whileTap='tap'
                >
                  Create Room
                </motion.button>

                <motion.button
                  className='bg-accent hover:bg-accent-dark text-white font-bold py-3 px-6 rounded-lg shadow-lg'
                  onClick={handleJoinRoomClick}
                  variants={buttonVariants}
                  initial='initial'
                  animate='animate'
                  whileHover='hover'
                  whileTap='tap'
                >
                  Join Room
                </motion.button>
              </div> */}
            </>
          )}

          {/* Create room form modal */}
          {showCreateForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              <div className="w-full max-w-md bg-background rounded-lg shadow-xl relative z-60">
                <h2 className="text-2xl text-white text-center py-4 border-b border-white/10">
                  Create a Room
                </h2>
                <CreateRoomForm
                  onSubmit={handleCreateRoomSubmit}
                  onCancel={() => setShowCreateForm(false)}
                />
              </div>
            </div>
          )}

          {/* Join room form modal */}
          {/* {showJoinForm && (
            <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4'>
              <div className='w-full max-w-md bg-background rounded-lg shadow-xl relative z-60'>
                <h2 className='text-2xl text-white text-center py-4 border-b border-white/10'>
                  Join a Room
                </h2>
                <JoinRoomForm
                  onSubmit={handleJoinRoomSubmit}
                  onCancel={() => setShowJoinForm(false)}
                />
              </div>
            </div>
          )} */}

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
