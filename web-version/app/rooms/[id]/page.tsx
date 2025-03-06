'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useRoomStore } from '../../lib/room/store';
import { initializeSocket } from '../../lib/websocket';
import { Player } from '../../lib/types/index';
// Helper function to get saved room info
const getSavedRoomInfo = () => {
  if (typeof window !== 'undefined') {
    return {
      roomId: localStorage.getItem('currentRoomId'),
      playerId: localStorage.getItem('currentPlayerId'),
      playerName: localStorage.getItem('currentPlayerName'),
    };
  }
  return { roomId: null, playerId: null, playerName: null };
};

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;
  const { currentRoom, error, leaveRoom, setPlayerReady, startGame, joinRoom } =
    useRoomStore();
  const [isLoading, setIsLoading] = useState(true);

  // Initialize WebSocket and fetch room data
  useEffect(() => {
    const socket = initializeSocket();
    console.log('WebSocket initialized in room page', socket);

    // If we don't have a current room, try to recover from localStorage
    if (!currentRoom) {
      const savedInfo = getSavedRoomInfo();

      // If we have saved info and it matches the current URL roomId
      if (
        savedInfo.roomId &&
        savedInfo.roomId === roomId &&
        savedInfo.playerName
      ) {
        console.log('Rejoining room from saved session:', savedInfo.roomId);

        // Re-join the room
        joinRoom({
          roomId: savedInfo.roomId,
          playerName: savedInfo.playerName || 'Player',
        });
      } else {
        // No saved info or different room, redirect to home
        router.push('/');
        return;
      }
    }

    setIsLoading(false);

    // No cleanup needed as socket is managed globally
  }, [currentRoom, router, roomId, joinRoom]);

  // Handle game start
  useEffect(() => {
    if (currentRoom?.status === 'playing') {
      // Navigate to the game page
      router.push(`/game/${roomId}`);
    }
  }, [currentRoom?.status, roomId, router]);

  // Handle browser back button
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // This prevents accidental navigation away but allows intentional navigation
      if (currentRoom) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
      return undefined;
    };

    const handlePopState = (e: PopStateEvent) => {
      // If user is navigating back/forward with browser buttons
      console.log('Navigation event detected', e);
      if (currentRoom) {
        // Attempt to leave the room cleanly
        leaveRoom().catch((err: Error) =>
          console.error('Error leaving room during navigation:', err)
        );
      }
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    // Cleanup on component unmount
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [currentRoom, leaveRoom]);

  const handleLeaveRoom = async () => {
    console.log('Leaving room...');

    // Clear localStorage data first for immediate UI feedback
    if (typeof window !== 'undefined') {
      localStorage.removeItem('currentRoomId');
      localStorage.removeItem('currentPlayerId');
      localStorage.removeItem('currentPlayerName');
      console.log('Cleared room data from localStorage');
    }

    try {
      // Send leave room message to server
      await leaveRoom();
      console.log('Successfully left room');
    } catch (error) {
      console.error('Error leaving room:', error);
    } finally {
      // Navigate back to home page
      router.push('/');
    }
  };

  const handleToggleReady = async () => {
    if (!currentRoom) return;

    // Find the current player using localStorage ID
    const savedInfo = getSavedRoomInfo();
    const currentPlayerId = savedInfo.playerId;

    if (!currentPlayerId) {
      console.error('Cannot toggle ready: No player ID found in localStorage');
      return;
    }

    // Find the current player in the room
    const currentPlayer = currentRoom.players.find(
      (p: Player) => p.id === currentPlayerId
    );

    if (currentPlayer) {
      console.log(
        `Toggling ready state for player ${currentPlayer.name} (${
          currentPlayer.id
        }): ${!currentPlayer.isReady}`
      );
      await setPlayerReady(!currentPlayer.isReady);
    } else {
      console.error('Current player not found in room');
    }
  };

  const handleStartGame = async () => {
    if (!currentRoom) return;

    // Check if all players are ready
    const allPlayersReady = currentRoom.players.every((p: Player) => p.isReady);

    if (allPlayersReady) {
      await startGame();
    }
  };

  // Helper function to get the current player
  const getCurrentPlayer = () => {
    const savedInfo = getSavedRoomInfo();
    if (!currentRoom || !savedInfo.playerId) return null;
    return currentRoom.players.find((p: Player) => p.id === savedInfo.playerId);
  };

  const currentPlayer = getCurrentPlayer();
  const isHost = currentRoom?.hostId === currentPlayer?.id;
  const allPlayersReady = currentRoom?.players.every((p: Player) => p.isReady);
  const canStartGame = isHost && allPlayersReady;

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
        <h2 className='game-title text-3xl font-bold mb-4'>Room not found</h2>
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
        className='bg-background/20 backdrop-blur-md rounded-xl p-8 w-full max-w-2xl'
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className='game-title text-3xl font-bold mb-6 text-center'>
          Room: {currentRoom.name}
        </h1>

        <div className='mb-8'>
          <h2 className='text-xl font-bold mb-2'>Players</h2>
          <div className='space-y-2'>
            {currentRoom.players.map((player: Player) => (
              <div
                key={player.id}
                className='flex items-center justify-between bg-background/30 p-3 rounded-lg'
              >
                <div className='flex items-center'>
                  <div
                    className={`w-3 h-3 rounded-full mr-2 ${
                      player.connected ? 'bg-success' : 'bg-danger'
                    }`}
                  ></div>
                  <span>{player.name}</span>
                  {currentRoom.hostId === player.id && (
                    <span className='ml-2 text-xs bg-accent text-white px-2 py-0.5 rounded'>
                      Host
                    </span>
                  )}
                </div>
                <div
                  className={`px-3 py-1 rounded text-sm ${
                    player.isReady
                      ? 'bg-success/20 text-success'
                      : 'bg-danger/20 text-danger'
                  }`}
                >
                  {player.isReady ? 'Ready' : 'Not Ready'}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className='flex flex-col space-y-3'>
          {/* Current player actions */}
          <div className='flex space-x-3'>
            <button
              className='flex-1 bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-lg'
              onClick={handleToggleReady}
            >
              {currentPlayer?.isReady ? 'Not Ready' : 'Ready Up'}
            </button>

            <button
              className='flex-1 bg-danger hover:bg-danger/80 text-white font-bold py-2 px-4 rounded-lg'
              onClick={handleLeaveRoom}
            >
              Leave Room
            </button>
          </div>

          {/* Host-only actions */}
          {isHost && (
            <button
              className={`w-full font-bold py-2 px-4 rounded-lg ${
                canStartGame
                  ? 'bg-success hover:bg-success/80 text-white'
                  : 'bg-gray-500 cursor-not-allowed text-white/50'
              }`}
              onClick={handleStartGame}
              disabled={!canStartGame}
            >
              Start Game
            </button>
          )}
        </div>

        {/* Room info */}
        <div className='mt-6 text-sm text-white/70'>
          <p>Room ID: {currentRoom.id}</p>
          <p>Status: {currentRoom.status}</p>
          <p>
            Players: {currentRoom.players.length}/{currentRoom.maxPlayers}
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
