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
          playerType: 'webadmin',
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

  // Listen for room updates from BeagleBoard joins
  useEffect(() => {
    const handleRoomUpdated = (event: CustomEvent) => {
      const { room } = event.detail || {};

      // If this is an update for our current room
      if (room && room.id === roomId) {
        console.log('Room update received for current room:', room);

        // Force refresh room data to ensure we see the latest state
        useRoomStore.getState().fetchRooms();

        // Directly update the current room in the store
        // This ensures immediate UI updates without waiting for the fetch to complete
        useRoomStore.setState({ currentRoom: room });

        // Trigger UI refresh
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('room_data_changed'));
        }
      }
    };

    // Add an immediate check for possible missed updates
    setTimeout(() => {
      // Force a refresh of room data after component mount
      useRoomStore.getState().fetchRooms();
    }, 500);

    window.addEventListener('room_updated', handleRoomUpdated as EventListener);

    return () => {
      window.removeEventListener(
        'room_updated',
        handleRoomUpdated as EventListener
      );
    };
  }, [roomId]);

  // Add this effect to listen for manual room updates
  useEffect(() => {
    const handleManualRoomUpdate = (event: CustomEvent) => {
      const { room } = event.detail || {};

      // If this update is for our room
      if (room && room.id === roomId) {
        console.log('Manual room update received:', room);

        // Force refresh room data
        useRoomStore.getState().fetchRooms();

        // If in a room component, we can directly update our local state
        if (typeof window !== 'undefined') {
          // This will trigger a full page refresh if needed
          window.dispatchEvent(new Event('room_data_changed'));
        }
      }
    };

    window.addEventListener(
      'manual_room_update',
      handleManualRoomUpdate as EventListener
    );

    return () => {
      window.removeEventListener(
        'manual_room_update',
        handleManualRoomUpdate as EventListener
      );
    };
  }, [roomId]);

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
    return (
      currentRoom.players.find((p: Player) => p.id === savedInfo.playerId) || {
        id: savedInfo.playerId,
        name: savedInfo.playerName || 'Web Admin',
        isReady: false,
        connected: true,
        playerType: 'webadmin', // Explicitly identify as web admin
        isAdmin: true, // Flag to identify web admin
      }
    );
  };

  const currentPlayer = getCurrentPlayer();
  const isHost = currentRoom?.hostId === currentPlayer?.id;
  const allPlayersReady = currentRoom?.players.every((p: Player) => p.isReady);
  const canStartGame = isHost && allPlayersReady;

  // Helper to check if the current user is an admin (web client)
  const isWebAdmin = () => {
    const savedInfo = getSavedRoomInfo();
    return savedInfo.playerId?.startsWith('admin-') || false;
  };

  // Helper to count BeagleBoard players
  const getBeagleBoardPlayerCount = () => {
    if (!currentRoom) return 0;
    return currentRoom.players.filter((p) => p.playerType === 'beagleboard')
      .length;
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
      <div className='bg-black/30 backdrop-blur-sm rounded-lg p-6 w-full max-w-4xl border border-white/10'>
        <motion.div
          className='flex flex-col gap-4'
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className='flex flex-col md:flex-row justify-between items-start md:items-center mb-4'>
            <div>
              <h1 className='game-title text-3xl font-bold'>
                {currentRoom.name}
              </h1>
              <p className='text-foreground/70'>
                Room ID: <span className='font-mono'>{currentRoom.id}</span>
              </p>
            </div>

            <motion.button
              className='mt-2 md:mt-0 px-4 py-2 bg-danger text-white rounded-md shadow-md'
              onClick={handleLeaveRoom}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Leave Room
            </motion.button>
          </div>

          <div className='bg-black/40 rounded-md p-4 mb-4'>
            <h2 className='text-lg font-semibold mb-2'>Players</h2>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
              {/* Filter to only show BeagleBoard players */}
              {currentRoom.players
                .filter((player) => player.playerType === 'beagleboard')
                .map((player) => (
                  <div
                    key={player.id}
                    className='flex items-center justify-between p-3 rounded-md border border-white/10 bg-black/20'
                  >
                    <div className='flex items-center gap-2'>
                      <div
                        className={`w-3 h-3 rounded-full ${
                          player.connected ? 'bg-green-500' : 'bg-gray-500'
                        }`}
                      />
                      <span>
                        {player.name}
                        {currentRoom.hostId === player.id && ' (Host)'}
                      </span>
                    </div>
                    <div
                      className={`px-2 py-1 text-sm rounded ${
                        player.isReady
                          ? 'bg-green-800/70 text-green-200'
                          : 'bg-gray-700/50 text-gray-300'
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
              {/* Only show Ready button for BeagleBoard players (not for web admin) */}
              {!isWebAdmin() && (
                <button
                  className='flex-1 bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-lg'
                  onClick={handleToggleReady}
                >
                  {currentPlayer?.isReady ? 'Not Ready' : 'Ready Up'}
                </button>
              )}

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
              Players: {getBeagleBoardPlayerCount()}/{currentRoom.maxPlayers}
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
    </div>
  );
}
