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
  gameStarting: false,
  gameStartTimestamp: null,

  // Initialize WebSocket and setup
  initialize: async () => {
    try {
      console.log('[store] Initializing room store and WebSocket connection');

      // Initialize WebSocket connection
      initializeSocket();

      // Wait a bit for connection to establish before fetching rooms
      setTimeout(() => {
        // Fetch room list after initialization
        get().fetchRooms();
      }, 500);

      return true;
    } catch (error) {
      console.error('[store] Failed to initialize room store:', error);
      set({ error: (error as Error).message });
      return false;
    }
  },

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
      const roomId = generateShortRoomId();

      // Generate a special admin ID for the web client (not a player)
      const adminId = 'admin-' + crypto.randomUUID();

      // Send create room message
      await sendMessage('create_room', {
        room: {
          id: roomId,
          name: params.name,
          hostId: adminId, // Web client is the host but not a player
          maxPlayers: GAME_CONFIG.MAX_PLAYERS,
          players: [], // Empty players array - no web admin added as player
        },
      });

      // Save room info to localStorage - web client is the host but not a player
      storeRoomInfo(roomId, adminId, 'Web Viewer');

      console.log('Room created, saved to localStorage:', roomId);

      // No need to wait for response - we'll navigate directly
      // The room_updated event will set the room state later

      // Dispatch navigation event to go to the room page
      window.dispatchEvent(
        new CustomEvent('navigate_to_room', {
          detail: {
            roomId,
            playerId: adminId,
            playerName: 'Web Viewer',
          },
        })
      );

      console.log('Create room request sent, navigation event dispatched');
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

      // Generate a unique player ID if not provided
      // For webviewer, we'll use a special prefix
      const playerId =
        params.playerType === 'webviewer'
          ? `viewer-${crypto.randomUUID()}`
          : crypto.randomUUID();

      // For web viewers, we don't actually join the room as a player, we just watch
      if (params.playerType === 'webviewer') {
        console.log('Joining as web viewer - not sending join_room message');

        // Save room info to localStorage for tracking
        storeRoomInfo(params.roomId, playerId, params.playerName);

        // Request the current room state without joining
        await sendMessage('get_room', {
          roomId: params.roomId,
        });

        return;
      }

      // For actual players, send the join_room message
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
  // Handle room data from get_room request
  window.addEventListener('room_data', (event: CustomEventInit) => {
    const { room } = event.detail || {};

    if (room) {
      // Update store with the returned room data
      useRoomStore.setState({
        currentRoom: room,
        loading: false,
      });
    } else {
      console.warn('Received room_data event with no room data');
    }
  });

  // Room updated event
  window.addEventListener('room_updated', (event: CustomEventInit) => {
    const { room } = event.detail || {};
    console.log('Room updated event received in store:', room);

    if (room) {
      const savedInfo = getStoredRoomInfo();

      // If this is an update for a room we're viewing, update the store
      // OR if it's the room we're supposed to be in according to localStorage
      if (
        useRoomStore.getState().currentRoom?.id === room.id ||
        (savedInfo.roomId === room.id && !useRoomStore.getState().currentRoom)
      ) {
        console.log('Updating current room state with new data');

        // Update store state with the new room data
        useRoomStore.setState({
          currentRoom: room as Room,
          loading: false,
        });
      } else {
        // This is an update for a different room, just update the room list
        console.log('Received update for different room:', room.id);
        useRoomStore.getState().fetchRooms();
      }
    }
  });

  // Room list event
  window.addEventListener('room_list', (event: CustomEventInit) => {
    try {
      const { rooms } = event.detail || {};
      console.log('Room list event received in store:', rooms);

      if (!rooms || !Array.isArray(rooms)) {
        console.warn('Invalid room list data received:', event.detail);
        useRoomStore.setState({ loading: false });
        return;
      }

      useRoomStore.setState({
        availableRooms: rooms as RoomListItem[],
        loading: false,
      });
    } catch (error) {
      console.error('Error processing room list event:', error);
      useRoomStore.setState({
        loading: false,
        error: 'Failed to process room list',
      });
    }
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

    // No longer navigating, just update the game status in the current room
    if (roomId) {
      const currentRoom = useRoomStore.getState().currentRoom;
      if (currentRoom && currentRoom.id === roomId) {
        useRoomStore.setState({
          currentRoom: {
            ...currentRoom,
            status: 'playing',
          },
        });
      }
    }
  });

  // Game starting event
  window.addEventListener('game_starting', (event: CustomEventInit) => {
    const { roomId, timestamp } = event.detail || {};
    console.log('Game starting event received in store:', {
      roomId,
      timestamp,
    });

    // Update store with game starting status
    useRoomStore.setState({
      gameStarting: true,
      gameStartTimestamp: timestamp,
    });
  });

  // BeagleBoard command event
  window.addEventListener('beagle_board_command', (event: CustomEventInit) => {
    try {
      const { message, sender } = event.detail || {};
      console.log(
        'BeagleBoard command event received in store:',
        message,
        'from',
        sender
      );

      // If this was a JOIN_ROOM or LEAVE_ROOM command, we might want to refresh our room list
      if (
        message &&
        typeof message === 'string' &&
        (message.includes('CMD:JOIN_ROOM') ||
          message.includes('CMD:LEAVE_ROOM'))
      ) {
        console.log(
          'BeagleBoard joined or left a room - will refresh room list'
        );

        // Use setTimeout to allow server to process the join/leave first
        setTimeout(() => {
          useRoomStore.getState().fetchRooms();
        }, 500);
      }
    } catch (error) {
      console.error('Error handling BeagleBoard command event:', error);
    }
  });

  // Check for saved room on startup
  const savedInfo = getStoredRoomInfo();
  if (savedInfo.roomId) {
    console.log(
      'Found saved room info, will attempt to reconnect if socket is established'
    );
  }
}
