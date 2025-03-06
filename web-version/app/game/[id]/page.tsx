'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useRoomStore } from '../../lib/room/store';
import { useGameStore } from '../../lib/store';
import { initializeSocket } from '../../lib/websocket';

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;
  const { currentRoom, error, leaveRoom } = useRoomStore();
  const { gameState } = useGameStore();
  const [isLoading, setIsLoading] = useState(true);

  // Initialize WebSocket and check game state
  useEffect(() => {
    const socket = initializeSocket();
    console.log('WebSocket initialized in game page:', socket.id);

    // If we don't have a current room or the game isn't playing, redirect
    if (!currentRoom || currentRoom.status !== 'playing') {
      router.push('/');
      return;
    }

    setIsLoading(false);

    // Clean up WebSocket connection when component unmounts
    return () => {
      // Don't close the socket, just handle cleanup
    };
  }, [currentRoom, router]);

  // Handle game end
  useEffect(() => {
    if (currentRoom?.status === 'ended') {
      // Navigate back to the room page
      router.push(`/rooms/${roomId}`);
    }
  }, [currentRoom?.status, roomId, router]);

  const handleLeaveGame = async () => {
    await leaveRoom();
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary'></div>
      </div>
    );
  }

  if (!currentRoom) {
    return (
      <div className='min-h-screen flex flex-col items-center justify-center'>
        <h2 className='game-title text-3xl font-bold mb-4'>Game not found</h2>
        <button
          className='bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-lg'
          onClick={() => router.push('/')}
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className='min-h-screen flex flex-col items-center justify-center p-8'>
      <motion.div
        className='bg-background/20 backdrop-blur-md rounded-xl p-8 w-full max-w-4xl'
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className='game-title text-3xl font-bold mb-6 text-center'>
          Gesture Tower Game
        </h1>

        <div className='mb-8'>
          <h2 className='text-xl font-bold mb-4'>Players</h2>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            {currentRoom.players.map((player) => (
              <div key={player.id} className='bg-background/30 p-4 rounded-lg'>
                <div className='flex items-center justify-between mb-2'>
                  <div className='flex items-center'>
                    <div
                      className={`w-3 h-3 rounded-full mr-2 ${
                        player.connected ? 'bg-success' : 'bg-danger'
                      }`}
                    ></div>
                    <span className='font-bold'>{player.name}</span>
                  </div>
                  <div className='text-sm bg-primary/20 px-2 py-1 rounded'>
                    Score: {gameState.scores[player.id] || 0}
                  </div>
                </div>

                {/* Player tower visualization would go here */}
                <div className='h-32 bg-background/20 rounded-lg flex items-end justify-center'>
                  <div
                    className='w-20 bg-gradient-to-t from-primary to-primary-light rounded-t-lg'
                    style={{
                      height: `${Math.min(
                        100,
                        (gameState.scores[player.id] || 0) * 10
                      )}%`,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Game controls */}
        <div className='flex justify-between items-center'>
          <div className='text-sm'>
            <p>Room: {currentRoom.name}</p>
            <p>Game in progress</p>
          </div>

          <button
            className='bg-danger hover:bg-danger/80 text-white font-bold py-2 px-4 rounded-lg'
            onClick={handleLeaveGame}
          >
            Leave Game
          </button>
        </div>

        {/* Game instructions */}
        <div className='mt-8 p-4 bg-background/30 rounded-lg'>
          <h3 className='font-bold mb-2'>How to Play</h3>
          <p className='text-sm'>
            Use gestures to build your tower! The first player to reach the goal
            height wins. Make sure your camera can see your full body for best
            gesture recognition.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className='bg-danger/20 text-danger p-3 rounded-md mt-4'>
            {error}
          </div>
        )}
      </motion.div>
    </div>
  );
}
