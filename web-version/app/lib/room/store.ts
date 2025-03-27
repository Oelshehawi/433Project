import { create } from 'zustand';
import {
  CreateRoomParams,
  JoinRoomParams,
  Room,
  RoomListItem,
  GAME_CONFIG,
  RoomStore,
} from '../types/index';
import {
  initializeSocket,
  sendMessage,
  getSocketStatus,
  getSavedRoomInfo as getStoredRoomInfo,
  saveRoomInfo as storeRoomInfo,
} from '../websocket';

function generateShortRoomId(length = 5): string {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar looking characters
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Function to create a RoomStore
export const useRoomStore = create<RoomStore>((set, get) => ({
  // Initial state
  currentRoom: null,
  availableRooms: [],
  loading: false,
  error: null,

  // Room actions
  createRoom: async (params: CreateRoomParams) => {
    try {
      console.log('Creating room with params:', params);
      set({ loading: true, error: null });

      // Initialize WebSocket if needed
      initializeSocket();

      if (getSocketStatus() !== 'connected') {
        throw new Error('WebSocket is not connected');
      }

      // Generate room ID
      const roomId = generateShortRoomId(); // Generate short room ID

      // Send create room message - no player is created, just a room with a host
      await sendMessage('create_room', {
        room: {
          id: roomId,
          name: params.name,
          hostId: 'system', // Use a special ID for system-created rooms
          maxPlayers: GAME_CONFIG.MAX_PLAYERS,
          players: [], // Empty players array - no initial players
        },
      });

      // No need to save room info to localStorage since we're not joining as a player

      console.log('Create room request sent, waiting for server response');
    } catch (error) {
      console.error('Failed to create room:', error);
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  joinRoom: async (params: JoinRoomParams) => {
    try {
      console.log('Joining room with params:', params);
      set({ loading: true, error: null });

      // Initialize WebSocket if needed
      initializeSocket();

      if (getSocketStatus() !== 'connected') {
        throw new Error('WebSocket is not connected');
      }

      // Generate a unique player ID
      const playerId = crypto.randomUUID();

      // Send join room message
      await sendMessage('join_room', {
        roomId: params.roomId,
        playerId: playerId,
        playerName: params.playerName,
      });

      // Save room info to localStorage for reconnection
      storeRoomInfo(params.roomId, playerId, params.playerName);

      console.log('Join room request sent, waiting for server response');
    } catch (error) {
      console.error('Failed to join room:', error);
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  leaveRoom: async () => {
    try {
      const { currentRoom } = get();
      if (!currentRoom) return;

      console.log('Leaving room:', currentRoom.id);
      set({ loading: true, error: null });

      // Send leave room message
      await sendMessage('leave_room', { roomId: currentRoom.id });

      // Clear localStorage data
      if (typeof window !== 'undefined') {
        localStorage.removeItem('currentRoomId');
        localStorage.removeItem('currentPlayerId');
        localStorage.removeItem('currentPlayerName');
        console.log('Cleared room data from localStorage after leaving room');
      }

      set({ currentRoom: null, loading: false });
    } catch (error) {
      console.error('Failed to leave room:', error);
      set({ error: (error as Error).message, loading: false });

      // Still clear localStorage even if there was an error
      if (typeof window !== 'undefined') {
        localStorage.removeItem('currentRoomId');
        localStorage.removeItem('currentPlayerId');
        localStorage.removeItem('currentPlayerName');
        console.log(
          'Cleared room data from localStorage after failed leave attempt'
        );
      }
    }
  },

  setPlayerReady: async (isReady: boolean) => {
    try {
      const { currentRoom } = get();
      if (!currentRoom) {
        throw new Error('Not in a room');
      }

      console.log('Setting player ready state:', isReady);
      set({ loading: true, error: null });

      // Send player ready message
      await sendMessage('player_ready', {
        roomId: currentRoom.id,
        isReady,
      });

      // Room state will be updated via events
    } catch (error) {
      console.error('Failed to set player ready state:', error);
      set({ error: (error as Error).message, loading: false });
    }
  },

  startGame: async () => {
    try {
      const { currentRoom } = get();
      if (!currentRoom) {
        throw new Error('Not in a room');
      }

      console.log('Starting game in room:', currentRoom.id);
      set({ loading: true, error: null });

      // Send game start message
      await sendMessage('game_started', {
        roomId: currentRoom.id,
      });

      // Game state will be updated via events
    } catch (error) {
      console.error('Failed to start game:', error);
      set({ error: (error as Error).message, loading: false });
    }
  },

  fetchRooms: async () => {
    try {
      console.log('Fetching available rooms');
      set({ loading: true, error: null });

      // Initialize WebSocket if needed
      initializeSocket();

      if (getSocketStatus() !== 'connected') {
        console.warn('WebSocket is not connected, cannot fetch rooms');
        set({ loading: false });
        return;
      }

      // Request room list
      await sendMessage('room_list', {});
      console.log('Room list request sent, waiting for server response');
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
      set({ error: (error as Error).message, loading: false });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));

// Set up event listeners for room events
if (typeof window !== 'undefined') {
  // Room updated event
  window.addEventListener('room_updated', (event: CustomEventInit) => {
    const { room } = event.detail || {};
    console.log('Room updated event received in store:', room);

    if (room) {
      // Update store state with the new room data
      useRoomStore.setState({
        currentRoom: room as Room,
        loading: false,
      });

      // When joining a room successfully, save room info
      if (room.id) {
        const savedInfo = getStoredRoomInfo();
        const currentPlayerId = savedInfo.playerId || '';

        // Find the current player in the room
        const currentPlayer = (room as Room).players.find(
          (p) => p.id === currentPlayerId
        );

        if (currentPlayer) {
          storeRoomInfo(room.id, currentPlayer.id, currentPlayer.name);

          // Dispatch a navigation event for components to handle
          window.dispatchEvent(
            new CustomEvent('navigate_to_room', {
              detail: {
                roomId: room.id,
                playerId: currentPlayer.id,
                playerName: currentPlayer.name,
              },
            })
          );
        }
      }
    }
  });

  // Room list event
  window.addEventListener('room_list', (event: CustomEventInit) => {
    const { rooms } = event.detail || {};
    console.log('Room list event received in store:', rooms);

    useRoomStore.setState({
      availableRooms: (rooms || []) as RoomListItem[],
      loading: false,
    });
  });

  // WebSocket error event
  window.addEventListener('ws_error', (event: CustomEventInit) => {
    const { error, code, details } = event.detail || {};
    console.error('WebSocket error event received in store:', {
      error,
      code,
      details,
    });

    let errorMessage = error as string;
    if (code === 'room_not_found') {
      errorMessage = 'Room not found. It may have been closed or expired.';
    } else if (code === 'room_full') {
      errorMessage = 'This room is already full.';
    }

    useRoomStore.setState({
      error: errorMessage,
      loading: false,
    });
  });

  // Game started event
  window.addEventListener('game_started', (event: CustomEventInit) => {
    const { roomId } = event.detail || {};
    console.log('Game started event received in store:', roomId);

    // Dispatch a navigation event to the game page
    window.dispatchEvent(
      new CustomEvent('navigate_to_game', {
        detail: { roomId },
      })
    );
  });

  // Check for saved room on startup
  const savedInfo = getStoredRoomInfo();
  if (savedInfo.roomId) {
    console.log(
      'Found saved room info, will attempt to reconnect if socket is established'
    );
  }
}
