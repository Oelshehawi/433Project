import {
  ExtendedWebSocket,
  Room,
  RoomListItem,
  Player,
  ErrorPayload,
  CreateRoomPayload,
  JoinRoomPayload,
  LeaveRoomPayload,
  PlayerReadyPayload,
  GameStartedPayload,
  GestureEventPayload,
  GameActionType,
  BeagleBoard,
  GameState,
  MoveStatusPayload,
  RoundEndAckPayload,
} from './types';
import {
  broadcastToAll,
  sendToClient,
  sendToRoom,
  clients,
  beagleBoards,
} from './messaging';
import { broadcastToAllClients } from './server';
import { initializeCardsForRoom } from './cardManager';
import {
  initializeGameState,
  processAction,
  endRound,
  MIN_REQUIRED_PLAYERS, // Import the constant
  startRound,
  checkWinCondition,
  endGame,
} from './gameManager';
import { v4 as uuidv4 } from 'uuid';

// Store active rooms
export const rooms: Map<string, Room> = new Map();

// Generate room list for clients
export const getRoomList = (): RoomListItem[] => {
  const roomList = Array.from(rooms.values()).map((room) => ({
    id: room.id,
    name: room.name,
    // Only count BeagleBoard players, not web admin clients
    playerCount: room.players.filter(
      (player) => player.playerType === 'beagleboard'
    ).length,
    maxPlayers: room.maxPlayers,
    status: room.status,
  }));

  return roomList;
};

// Track which rooms have received the game_ready signal from web clients
const webClientReadyRooms = new Set<string>();

// Track rooms waiting for web client confirmation to start next round
export const webClientNextRoundReadyRooms = new Map<string, number>(); // roomId -> roundNumber

// Add a function to check and set if a room is in its first round
export function isFirstRound(roomId: string): boolean {
  if (!rooms.has(roomId)) return false;
  const room = rooms.get(roomId)!;
  return room.gameState?.roundNumber === 1;
}

// Add function to handle game_ready event from web client
export function handleGameReady(client: ExtendedWebSocket, payload: any) {
  const { roomId } = payload;

  console.log(`Received game_ready signal from web client for room ${roomId}`);

  // Verify the room exists
  if (!rooms.has(roomId)) {
    console.error(`Room ${roomId} not found for game_ready signal`);
    return;
  }

  const room = rooms.get(roomId)!;

  // Mark this room as having received the game_ready signal
  webClientReadyRooms.add(roomId);
  console.log(`Room ${roomId} marked as ready to start first round`);

  // Check if the game is in its first round and we're waiting to start
  if (
    room.status === 'playing' &&
    room.gameState &&
    room.gameState.roundNumber === 1
  ) {
    // Check if we have initialized cards but haven't sent the first round_start yet
    if (room.playerCards && room.playerCards.size > 0) {
      console.log(
        `Web client is ready for room ${roomId}. Waiting for round_start event from client.`
      );

      // Send game state update to notify clients the server is ready
      sendToRoom(roomId, 'game_state_update', {
        roomId,
        gameState: {
          towerHeights: Object.fromEntries(room.gameState.towerHeights),
          goalHeights: Object.fromEntries(room.gameState.goalHeights),
          roundNumber: room.gameState.roundNumber,
        },
        message: 'Server ready and waiting for client to initiate round_start',
        serverReady: true,
      });

      // REMOVED: No longer automatically calling startRound here
    } else {
      console.error(
        `Cannot start first round: cards not initialized for room ${roomId}`
      );
    }
  } else {
    console.log(`Game in room ${roomId} already started or not in first round`);
  }
}

// New function to handle round_start event from client
export function handleRoundStartEvent(client: ExtendedWebSocket, payload: any) {
  const { roomId, roundNumber } = payload;

  console.log(
    `Received round_start event from client for room ${roomId}, requesting round ${
      roundNumber || 'unspecified'
    }`
  );

  // Verify the room exists
  if (!rooms.has(roomId)) {
    console.error(`Room ${roomId} not found for round_start event`);
    return;
  }

  const room = rooms.get(roomId)!;

  // Verify the game state exists
  if (!room.gameState) {
    console.error(`Game state not found for room ${roomId}`);
    return;
  }

  // Check if web client has sent game_ready
  if (!webClientReadyRooms.has(roomId)) {
    console.error(`Web client has not sent game_ready for room ${roomId}`);
    return;
  }

  // Check if the requested round number matches the current round
  const currentRound = room.gameState.roundNumber;
  if (roundNumber && roundNumber !== currentRound) {
    console.warn(
      `Round number mismatch: client requested ${roundNumber}, server is at ${currentRound}`
    );
    // Still proceed with the current round
  }

  console.log(
    `Starting round ${currentRound} in room ${roomId} at client request`
  );

  // Now we can start the round
  startRound(roomId);
}

// Handle creating a new room
export const handleCreateRoom = (
  client: ExtendedWebSocket,
  payload: CreateRoomPayload
) => {
  try {
    console.log(
      'handleCreateRoom called with payload:',
      JSON.stringify(payload)
    );
    const { room } = payload;

    // Validate data
    if (!room) {
      console.error('Missing room data in create_room payload');
      return sendToClient(client, 'error', {
        error: 'Missing required data',
      } as ErrorPayload);
    }

    // Validate room data
    if (!room || !room.id || !room.name) {
      console.error('Invalid room data in create_room payload', room);
      return sendToClient(client, 'error', {
        error: 'Invalid room data',
      } as ErrorPayload);
    }

    // Check if room already exists
    if (rooms.has(room.id)) {
      return sendToClient(client, 'error', {
        error: 'Room already exists',
      } as ErrorPayload);
    }

    // Create the room (with empty players array if not provided)
    const newRoom: Room = {
      ...room,
      createdAt: Date.now(),
      status: 'waiting',
      players: room.players || [], // Use empty array if no players provided
    };

    // Make sure all players have the playerType field set
    newRoom.players.forEach((player) => {
      if (!player.playerType) {
        player.playerType = 'webviewer'; // Assume any existing players are web viewers
      }
    });

    // Add room to storage
    rooms.set(newRoom.id, newRoom);

    console.log(`Room created: ${newRoom.id} - ${newRoom.name}`);

    // Check if this client is a BeagleBoard client creating the room
    const hostPlayer = newRoom.players.find(
      (player) => player.id === newRoom.hostId
    );
    if (
      hostPlayer &&
      (hostPlayer.id === client.playerId ||
        hostPlayer.playerType === 'beagleboard')
    ) {
      console.log(`\n=========== BEAGLEBOARD CLIENT CREATING ROOM ===========`);
      console.log(`Room ID: ${newRoom.id}`);
      console.log(`Host ID: ${newRoom.hostId}`);

      // Update client properties to ensure it's properly registered
      client.roomId = newRoom.id;
      client.playerId = hostPlayer.id;
      client.playerName = hostPlayer.name;
      client.playerType = 'beagleboard';

      console.log(
        `Set client properties: roomId=${client.roomId}, playerId=${client.playerId}, playerType=${client.playerType}`
      );

      // Register this client in the beagleBoards map
      const beagleBoard: BeagleBoard = {
        deviceId: hostPlayer.id,
        roomId: newRoom.id,
        client: client,
      };

      beagleBoards.set(client.id, beagleBoard);
      console.log(
        `Added BeagleBoard client to beagleBoards map with key ${client.id}`
      );
      console.log(`BeagleBoard map now has ${beagleBoards.size} entries`);

      // Log all BeagleBoard entries for debugging
      beagleBoards.forEach((bb, key) => {
        console.log(
          `  Entry ${key}: deviceId=${bb.deviceId}, roomId=${bb.roomId}`
        );
      });

      console.log(`============================================\n`);
    }

    // Notify the client
    sendToClient(client, 'room_updated', { room: newRoom });

    // Update room list for all clients
    broadcastToAll('room_list', {
      rooms: getRoomList(),
    });
  } catch (error) {
    console.error('Error creating room:', error);
    sendToClient(client, 'error', {
      error: 'Failed to create room',
    } as ErrorPayload);
  }
};

// Handle joining an existing room
export const handleJoinRoom = (
  client: ExtendedWebSocket,
  payload: JoinRoomPayload
) => {
  try {
    console.log('handleJoinRoom called with payload:', JSON.stringify(payload));
    const { roomId, playerId, playerName } = payload;

    // Validate data
    if (!roomId || !playerId || !playerName) {
      console.error('Missing required data in join_room payload', {
        roomId,
        playerId,
        playerName,
      });
      return sendToClient(client, 'error', {
        error: 'Missing required data',
      } as ErrorPayload);
    }

    // Explicitly check for BeagleBoard client based on ID
    const isBeagleBoard =
      playerId.startsWith('bb_') ||
      (!playerId.startsWith('admin-') && !playerId.startsWith('viewer-'));

    if (isBeagleBoard) {
      console.log(`\n=========== BEAGLEBOARD JOIN REQUEST ===========`);
      console.log(`BeagleBoard client joining room: ${roomId}`);
      console.log(`Player ID: ${playerId}`);
      console.log(`Current client.id: ${client.id}`);
      console.log(`Current readyState: ${client.readyState}`);

      // Check if client is already in beagleBoards map
      let beagleBoardExists = false;
      beagleBoards.forEach((bb, key) => {
        if (bb.deviceId === playerId) {
          beagleBoardExists = true;
          console.log(`BeagleBoard already exists in map with key ${key}`);
          // Update the existing entry
          bb.roomId = roomId;
          bb.client = client;
          console.log(
            `Updated existing BeagleBoard entry with new roomId: ${roomId}`
          );
        }
      });

      if (!beagleBoardExists) {
        // Add to beagleBoards map
        const beagleBoard: BeagleBoard = {
          deviceId: playerId,
          roomId: roomId,
          client: client,
        };
        beagleBoards.set(client.id, beagleBoard);
        console.log(`Added NEW BeagleBoard to map with key ${client.id}`);
      }

      console.log(`BeagleBoard map now has ${beagleBoards.size} entries`);

      // Debug output for all BeagleBoard entries
      beagleBoards.forEach((bb, key) => {
        console.log(
          `  Entry ${key}: deviceId=${bb.deviceId}, roomId=${bb.roomId}`
        );
      });
    }

    // Store the room ID and player ID in the client object
    client.roomId = roomId;
    client.playerId = playerId;
    client.playerName = playerName;

    // Set playerType based on ID format
    if (isBeagleBoard) {
      client.playerType = 'beagleboard';
      console.log(`Set client.playerType = "beagleboard" for ${playerId}`);
    } else {
      client.playerType = 'webviewer';
    }

    console.log(
      `Client ${client.id} updated with roomId=${client.roomId}, playerId=${client.playerId}, playerType=${client.playerType}`
    );

    // Check if room exists
    if (!rooms.has(roomId)) {
      return sendToClient(client, 'error', {
        error: 'Room not found',
      } as ErrorPayload);
    }

    const room = rooms.get(roomId)!;

    // Check if room is full - only count actual BeagleBoard players
    const beagleboardPlayerCount = room.players.filter(
      (p) => p.playerType === 'beagleboard'
    ).length;
    if (beagleboardPlayerCount >= room.maxPlayers) {
      return sendToClient(client, 'error', {
        error: 'Room is full',
      } as ErrorPayload);
    }

    // Check if room is already playing
    if (room.status === 'playing') {
      return sendToClient(client, 'error', {
        error: 'Game is already in progress',
      } as ErrorPayload);
    }

    // Add player to room - identify BeagleBoard players by ID format
    // BeagleBoard device IDs typically start with "bb_" or similar prefix
    // Use our previously declared isBeagleBoard variable
    const newPlayer: Player = {
      id: playerId,
      name: playerName,
      isReady: false,
      connected: true,
      playerType: isBeagleBoard ? 'beagleboard' : 'webviewer',
    };

    room.players.push(newPlayer);

    console.log(`Player ${playerName} joined room ${room.name} (${roomId})`);

    // Notify all clients in the room
    sendToRoom(roomId, 'room_updated', { room });

    // Also broadcast to ALL clients to ensure web clients see the update
    broadcastToAll('room_updated', { room });

    // Update room list for all clients
    broadcastToAll('room_list', {
      rooms: getRoomList(),
    });
  } catch (error) {
    console.error('Error joining room:', error);
    sendToClient(client, 'error', {
      error: 'Failed to join room',
    } as ErrorPayload);
  }
};

// Handle leaving a room
export const handleLeaveRoom = (
  client: ExtendedWebSocket,
  payload: LeaveRoomPayload
) => {
  try {
    const { roomId, playerId: payloadPlayerId } = payload;
    // Use payload's playerId if available, otherwise fall back to client.playerId
    const playerId = payloadPlayerId || client.playerId;

    // Validate data
    if (!roomId) {
      return sendToClient(client, 'error', {
        error: 'Missing room ID',
      } as ErrorPayload);
    }

    // Check if room exists
    if (!rooms.has(roomId)) {
      return;
    }

    const room = rooms.get(roomId)!;

    // Remove player from room
    const playerIndex = room.players.findIndex((p) => p.id === playerId);

    if (playerIndex !== -1) {
      // Get player name before removing for logging
      const playerName = room.players[playerIndex].name || playerId;

      // Remove the player
      room.players.splice(playerIndex, 1);

      console.log(`Player ${playerName} left room ${room.name} (${roomId})`);

      // Clear client properties
      client.roomId = undefined;
      client.playerId = undefined;
      client.playerName = undefined;

      // Notify remaining clients in the room if it still exists
      if (rooms.has(roomId)) {
        // Send updates to all clients in the room
        sendToRoom(roomId, 'room_updated', { room });
      } else {
        // If the room was deleted, send room_list update to refresh UI for all clients
        broadcastToAll('room_list', {
          rooms: getRoomList(),
        });
      }

      // Update room list for all clients
      broadcastToAll('room_list', {
        rooms: getRoomList(),
      });
    }
  } catch (error) {
    console.error('Error leaving room:', error);
  }
};

// Handle player ready status
export const handlePlayerReady = (
  client: ExtendedWebSocket,
  payload: PlayerReadyPayload
) => {
  try {
    const { roomId, playerId, isReady } = payload;
    const effectiveRoomId = roomId || client.roomId;
    const effectivePlayerId = playerId || client.playerId;

    console.log(
      `Player ready event: Room ${effectiveRoomId}, Player ${effectivePlayerId}, Ready: ${isReady}`
    );

    // Validate data
    if (!effectiveRoomId || !effectivePlayerId) {
      console.error('Missing roomId or playerId in player ready event', {
        payloadRoomId: roomId,
        payloadPlayerId: playerId,
        clientRoomId: client.roomId,
        clientPlayerId: client.playerId,
      });
      return sendToClient(client, 'error', {
        error: 'Missing required data',
      } as ErrorPayload);
    }

    // Check if room exists
    if (!rooms.has(effectiveRoomId)) {
      console.error(`Room not found: ${effectiveRoomId}`);
      return sendToClient(client, 'error', {
        error: 'Room not found',
      } as ErrorPayload);
    }

    const room = rooms.get(effectiveRoomId)!;

    // Find player in room
    const player = room.players.find((p) => p.id === effectivePlayerId);

    if (!player) {
      console.error(
        `Player ${effectivePlayerId} not found in room ${effectiveRoomId}`
      );
      return sendToClient(client, 'error', {
        error: 'Player not found in room',
      } as ErrorPayload);
    }

    // Update player ready status
    player.isReady = isReady;

    // Send room updated event to all clients in the room
    sendToRoom(effectiveRoomId, 'room_updated', { room });

    // Also broadcast room_updated to ALL clients for better state synchronization
    broadcastToAll('room_updated', { room });

    // Update room list for all clients
    broadcastToAll('room_list', {
      payload: {
        rooms: getRoomList(),
      },
    });

    console.log(
      `Player ${player.name} (${effectivePlayerId}) in room ${
        room.name
      } (${effectiveRoomId}) is now ${isReady ? 'ready' : 'not ready'}`
    );

    // *** Add game start detection ***
    // Only check for game start when a player becomes ready
    if (isReady) {
      // Check if all players are ready and there is at least the minimum required players
      const allPlayersReady = room.players.every((p) => p.isReady);

      // Count BeagleBoard players for the minimum requirement check
      const beagleBoardPlayers = room.players.filter(
        (p) => p.playerType === 'beagleboard'
      ).length;

      // Use the constant for minimum players
      const hasEnoughPlayers = beagleBoardPlayers >= MIN_REQUIRED_PLAYERS;

      // Log test mode status based on the constant
      if (MIN_REQUIRED_PLAYERS === 1) {
        console.log(
          `Room has ${beagleBoardPlayers} BeagleBoard player(s). TEST MODE: Starting with ${MIN_REQUIRED_PLAYERS} player.`
        );
      } else {
        console.log(
          `Room has ${beagleBoardPlayers} BeagleBoard player(s). Minimum required: ${MIN_REQUIRED_PLAYERS}.`
        );
      }

      if (allPlayersReady && hasEnoughPlayers) {
        console.log(
          `All players in room ${effectiveRoomId} are ready! Starting game...`
        );

        // Update room status to playing
        room.status = 'playing';

        // Send game_starting event to all clients in the room
        sendToRoom(effectiveRoomId, 'game_starting', {
          roomId: effectiveRoomId,
          timestamp: Date.now(),
        });

        // Update room with new status
        sendToRoom(effectiveRoomId, 'room_updated', { room });

        // Also broadcast room_updated to ALL clients for better state synchronization
        broadcastToAll('room_updated', { room });

        // Initialize cards but DON'T send them yet - they will be sent in startRound
        console.log(`PRE-INITIALIZING CARDS for room ${effectiveRoomId}`);
        const cardsInitialized = initializeCardsForRoom(effectiveRoomId);
        if (!cardsInitialized) {
          console.error(
            `Failed to pre-initialize cards for room ${effectiveRoomId}`
          );
        } else {
          console.log(
            `Cards pre-initialized successfully for room ${effectiveRoomId}`
          );

          // Initialize game state and start the first round immediately
          // This will trigger startRound which will send the cards with round_start event
          initializeGameState(effectiveRoomId);
        }
      }
    }
  } catch (error) {
    console.error('Error handling player ready:', error);
    sendToClient(client, 'error', {
      error: 'Internal server error',
    } as ErrorPayload);
  }
};

// Handle game start
export const handleGameStart = (
  client: ExtendedWebSocket,
  payload: GameStartedPayload
) => {
  try {
    const { roomId } = payload;
    console.log(`Handling game start request for room ${roomId}`);

    // Validate data
    if (!roomId) {
      console.error('Missing roomId in game start request');
      return sendToClient(client, 'error', {
        error: 'Missing room ID',
      } as ErrorPayload);
    }

    // Check if room exists
    if (!rooms.has(roomId)) {
      console.error(`Room ${roomId} not found for game start`);
      return sendToClient(client, 'error', {
        error: 'Room not found',
      } as ErrorPayload);
    }

    const room = rooms.get(roomId)!;
    console.log(`Room status: ${room.status}, Players: ${room.players.length}`);

    // Check if we have minimum required players ready (based on MIN_REQUIRED_PLAYERS)
    const readyBeagleBoardPlayers = room.players.filter(
      (player) => player.playerType === 'beagleboard' && player.isReady
    );

    console.log(
      `Ready BeagleBoard players: ${readyBeagleBoardPlayers.length}/${
        room.players.filter((p) => p.playerType === 'beagleboard').length
      }`
    );

    if (readyBeagleBoardPlayers.length < MIN_REQUIRED_PLAYERS) {
      console.error(`Not enough ready BeagleBoard players to start game`);
      return sendToClient(client, 'error', {
        error: `At least ${MIN_REQUIRED_PLAYERS} BeagleBoard player(s) must be ready to start${
          MIN_REQUIRED_PLAYERS === 1 ? ' (TEST MODE)' : ''
        }`,
      } as ErrorPayload);
    }

    // Log mode (test or normal)
    if (MIN_REQUIRED_PLAYERS === 1) {
      console.log(
        `TEST MODE: Starting game with ${readyBeagleBoardPlayers.length} BeagleBoard player(s)`
      );
    } else {
      console.log(
        `Starting game with ${readyBeagleBoardPlayers.length} BeagleBoard players`
      );
    }

    // Set room status to playing
    room.status = 'playing';

    // Initialize cards for the room
    console.log(`Initializing cards for room ${roomId}`);
    const cardsInitialized = initializeCardsForRoom(roomId);
    if (!cardsInitialized) {
      console.error(`Failed to initialize cards for room ${roomId}`);
      // Continue anyway, the game can still start without cards
    } else {
      console.log(`Cards successfully initialized for room ${roomId}`);
    }

    // Send a countdown to all clients in the room
    console.log(`Sending game_starting event to room ${roomId}`);
    sendToRoom(roomId, 'game_starting', { countdown: 3 });

    // Delay the actual game start to allow for countdown animation
    setTimeout(() => {
      // First, initialize game state with goal heights and turn order
      // This will also start the first round and send cards via round_start
      console.log(`Initializing game state for room ${roomId}`);
      const gameStateInitialized = initializeGameState(roomId);
      if (!gameStateInitialized) {
        console.error(`Failed to initialize game state for room ${roomId}`);
        // This is more serious, but we'll continue and try to recover
      } else {
        console.log(`Game state successfully initialized for room ${roomId}`);
      }

      // Notify all clients that the game has started - SEND THIS EXPLICITLY
      console.log(`Broadcasting game_started event to room ${roomId}`);
      sendToRoom(roomId, 'game_started', {
        roomId,
        timestamp: Date.now(),
      });

      // No need to send cards here anymore as they're sent by startRound inside initializeGameState

      // Update room list
      broadcastToAllClients({
        event: 'room_list',
        payload: {
          rooms: getRoomList(),
        },
      });
    }, 3000); // 3 second countdown

    console.log(`Game started in room ${roomId}`);
  } catch (error) {
    console.error('Error starting game:', error);
    sendToClient(client, 'error', {
      error: 'Failed to start game',
    } as ErrorPayload);
  }
};

// Handle gesture event from client
export const handleGestureEvent = (
  client: ExtendedWebSocket,
  payload: GestureEventPayload
) => {
  const { roomId, playerId, gesture, confidence, cardId, roundNumber } =
    payload;

  console.log(
    `[roomManager.ts] Received gesture event from ${playerId} in room ${roomId}:`
  );
  console.log(`[roomManager.ts] - Gesture: ${gesture}`);
  console.log(`[roomManager.ts] - Confidence: ${confidence}`);
  console.log(`[roomManager.ts] - Card ID: ${cardId || 'none'}`);
  console.log(
    `[roomManager.ts] - Round Number: ${roundNumber || 'not specified'}`
  );

  // Validate room and player
  if (!rooms.has(roomId)) {
    console.error(
      `[roomManager.ts] Room ${roomId} not found for gesture event`
    );
    return sendToClient(client, 'error', {
      error: 'Room not found',
    } as ErrorPayload);
  }

  const room = rooms.get(roomId)!;

  // Check if player is in the room
  const player = room.players.find((p) => p.id === playerId);
  if (!player) {
    console.error(
      `[roomManager.ts] Player ${playerId} not found in room ${roomId}`
    );
    return sendToClient(client, 'error', {
      error: 'Player not found in room',
    } as ErrorPayload);
  }

  // Check if game is in progress
  if (room.status !== 'playing') {
    console.error(`[roomManager.ts] Room ${roomId} is not in playing state`);
    return sendToClient(client, 'error', {
      error: 'Game not in progress',
    } as ErrorPayload);
  }

  // Ensure game state exists
  if (!room.gameState) {
    console.error(`[roomManager.ts] Game state not found for room ${roomId}`);
    return sendToClient(client, 'error', {
      error: 'Game state not found',
    } as ErrorPayload);
  }

  // Check if this is a valid gesture type that can be mapped to a game action
  if (gesture === 'attack' || gesture === 'defend' || gesture === 'build') {
    // Process the game action
    const success = processAction(
      roomId,
      playerId,
      gesture as GameActionType,
      confidence || 1.0, // Default to 1.0 if confidence not provided
      cardId // Pass the cardId
    );

    if (!success) {
      console.error(
        `[roomManager.ts] Failed to process action for ${playerId} in room ${roomId}`
      );
      return sendToClient(client, 'error', {
        error: 'Failed to process action',
      } as ErrorPayload);
    }

    // Send move status confirmation to the client
    sendToClient(client, 'move_status', {
      status: 'accepted',
      roundNumber: room.gameState.roundNumber,
    } as MoveStatusPayload);
  } else {
    // Log unknown gesture type
    console.warn(`[roomManager.ts] Unknown gesture type: ${gesture}`);

    // Still send the gesture event to the room for display purposes
    sendToRoom(roomId, 'gesture_event', {
      playerId,
      gesture,
      confidence: confidence || 1.0,
      cardId,
    } as GestureEventPayload);

    // Send confirmation
    sendToClient(client, 'move_status', {
      status: 'accepted',
      reason: 'Non-gameplay gesture',
      roundNumber: room.gameState.roundNumber,
    } as MoveStatusPayload);
  }
};

// Handle room list request
export const handleRoomList = (client: ExtendedWebSocket) => {
  try {
    sendToClient(client, 'room_list', {
      rooms: getRoomList(),
    });
  } catch (error) {
    console.error('Error sending room list:', error);
    sendToClient(client, 'error', {
      error: 'Failed to retrieve room list',
    } as ErrorPayload);
  }
};

// Handle get room request
export const handleGetRoom = (
  client: ExtendedWebSocket,
  payload: { roomId: string }
) => {
  try {
    const { roomId } = payload;

    // Validate data
    if (!roomId) {
      return sendToClient(client, 'error', {
        error: 'Missing room ID',
      } as ErrorPayload);
    }

    // Check if room exists
    if (!rooms.has(roomId)) {
      return sendToClient(client, 'error', {
        code: 'room_not_found',
        error: 'Room not found',
      } as ErrorPayload);
    }

    const room = rooms.get(roomId)!;

    // Send room data to the client
    sendToClient(client, 'room_data', { room });

    console.log(`Room data sent for room ${roomId} to ${client.id}`);
  } catch (error) {
    console.error('Error getting room:', error);
    sendToClient(client, 'error', {
      error: 'Failed to retrieve room',
    } as ErrorPayload);
  }
};

// Handle round_end_ack events from players
export const handleRoundEndAck = (
  client: ExtendedWebSocket,
  payload: RoundEndAckPayload
) => {
  const { roomId, playerId, roundNumber } = payload;

  console.log(
    `Received round_end_ack from ${playerId} for round ${roundNumber} in room ${roomId}`
  );

  // Verify the room exists
  if (!rooms.has(roomId)) {
    console.error(
      `Room ${roomId} not found for round_end_ack from ${playerId}`
    );
    return;
  }

  const room = rooms.get(roomId)!;

  // Get the current round number
  const currentRoundNumber = room.gameState?.roundNumber || 0;

  // Check if the round number matches
  if (roundNumber !== currentRoundNumber - 1) {
    console.warn(
      `Round number mismatch: got ack for round ${roundNumber} but current round is ${currentRoundNumber}`
    );
    // We'll still process the ack because it's coming from the BeagleBoard
  }

  // Forward ack to web client with next round info
  const forwardPayload = {
    roomId,
    playerId,
    roundNumber,
    nextRoundNumber: currentRoundNumber,
  };

  console.log(`Forwarding round_end_ack to web client for room ${roomId}`);

  // Send to all clients in the room (including web client)
  sendToRoom(roomId, 'round_end_ack', forwardPayload);

  // Old code handlers would go here
};

// Modify existing startRoomGame to delay first round until web client is ready
export function startRoomGame(roomId: string) {
  // ... existing code ...

  // Initialize game state with cards
  const { initializeGameState } = require('./gameManager');
  const { initializeCardsForRoom } = require('./cardManager');

  console.log(`PRE-INITIALIZING CARDS for room ${roomId}`);
  const cardsInitialized = initializeCardsForRoom(roomId);

  if (!cardsInitialized) {
    console.error(`Failed to initialize cards for room ${roomId}`);
    return;
  }

  console.log(`Cards pre-initialized successfully for room ${roomId}`);

  // Initialize game state
  const gameInitialized = initializeGameState(roomId);

  if (!gameInitialized) {
    console.error(`Failed to initialize game state for room ${roomId}`);
    return;
  }

  // UPDATED: Don't automatically start the first round, just wait for round_start from client
  console.log(
    `Game initialized for room ${roomId}, waiting for client to send round_start`
  );

  // Send a state update indicating the server is ready
  const room = rooms.get(roomId)!;
  if (room && room.gameState) {
    sendToRoom(roomId, 'game_state_update', {
      roomId,
      gameState: {
        towerHeights: Object.fromEntries(room.gameState.towerHeights),
        goalHeights: Object.fromEntries(room.gameState.goalHeights),
        roundNumber: room.gameState.roundNumber,
      },
      message: 'Waiting for client to send round_start',
      serverReady: true,
    });
  }
}

// Add function to handle next_round_ready event from web client
export function handleNextRoundReady(client: ExtendedWebSocket, payload: any) {
  const { roomId, roundNumber } = payload;

  console.log(
    `[roomManager.ts] Received next_round_ready signal from web client for room ${roomId}, round ${roundNumber}`
  );

  // Verify the room exists
  if (!rooms.has(roomId)) {
    console.error(
      `[roomManager.ts] Room ${roomId} not found for next_round_ready signal`
    );
    return;
  }

  const room = rooms.get(roomId)!;

  // Verify the game state exists
  if (!room.gameState) {
    console.error(`[roomManager.ts] Game state not found for room ${roomId}`);
    return;
  }

  // Check if this is for the current round or the next round
  // If current round number + 1 = payload round number, client is ready for next round
  if (room.gameState.roundNumber + 1 === roundNumber) {
    console.log(
      `[roomManager.ts] Web client ready for next round ${roundNumber} in room ${roomId}`
    );

    // Store that this room's web client is ready for the next round
    webClientNextRoundReadyRooms.set(roomId, roundNumber);

    // Check if all players have completed their moves in the current round
    const allPlayersCompleted = Array.from(
      room.gameState.playerMoves.values()
    ).every((moved) => moved);

    // If all players have completed their moves and all BeagleBoards have acknowledged
    // Now we can start the next round since the web client is also ready
    if (allPlayersCompleted) {
      console.log(
        `[roomManager.ts] All conditions met to start round ${roundNumber} in room ${roomId}:`
      );
      console.log(
        `  - All players completed their moves for round ${room.gameState.roundNumber}`
      );
      console.log(`  - Web client animation ready for round ${roundNumber}`);

      // Start the next round
      startRound(roomId);

      // Remove from ready map since we've started the round
      webClientNextRoundReadyRooms.delete(roomId);
    }
  } else if (room.gameState.roundNumber === roundNumber) {
    // Client is confirming it's ready for current round (could happen if client reloads)
    console.log(
      `[roomManager.ts] Web client confirming readiness for current round ${roundNumber}`
    );
  } else {
    console.warn(
      `[roomManager.ts] Round number mismatch: web client requested round ${roundNumber} but current round is ${room.gameState.roundNumber}`
    );
  }
}

// Add a new function to handle round_end event from web client
export function handleWebClientRoundEnd(
  client: ExtendedWebSocket,
  payload: any
) {
  const { roomId, roundNumber, fromWebClient } = payload;

  // Verify this is coming from web client
  if (!fromWebClient) {
    console.log(`[roomManager.ts] Ignoring non-web client round_end event`);
    return;
  }

  console.log(
    `[roomManager.ts] Received round_end from web client for room ${roomId}, round ${roundNumber}`
  );

  // Verify room exists and game state is valid
  if (!rooms.has(roomId)) {
    console.error(`[roomManager.ts] Room ${roomId} not found for round_end`);
    return;
  }

  const room = rooms.get(roomId)!;

  if (!room.gameState) {
    console.error(`[roomManager.ts] No game state found for room ${roomId}`);
    return;
  }

  // Verify round number matches
  if (room.gameState.roundNumber !== roundNumber) {
    console.warn(
      `[roomManager.ts] Round number mismatch: got ${roundNumber}, current is ${room.gameState.roundNumber}`
    );
    // Continue anyway as we want to process the round end
  }

  // Check win condition and prepare round end message
  const { winningPlayerId, shouldContinue } = checkWinCondition(roomId);

  // Prepare round end event
  const roundEndEvent = {
    event: 'round_end',
    payload: {
      roomId,
      roundNumber: room.gameState.roundNumber,
      gameState: {
        towerHeights: Object.fromEntries(room.gameState.towerHeights),
        goalHeights: Object.fromEntries(room.gameState.goalHeights),
        roundNumber: room.gameState.roundNumber,
      },
      winnerId: winningPlayerId,
      roundComplete: true,
      shouldContinue,
    },
  };

  console.log(
    `[roomManager.ts] Forwarding round_end to BeagleBoard clients for room ${roomId}, round ${roundNumber}`
  );

  // Get all BeagleBoard clients in this room
  const beagleBoardPlayers = room.players.filter(
    (p) => p.playerType === 'beagleboard'
  );

  // Send round_end to each BeagleBoard client
  beagleBoardPlayers.forEach((player) => {
    // Find the client associated with this player
    const playerClient = findClientByPlayerId(player.id);
    if (playerClient && playerClient.readyState === WebSocket.OPEN) {
      playerClient.send(JSON.stringify(roundEndEvent));
      console.log(
        `[roomManager.ts] Sent round_end to BeagleBoard player ${player.name} (${player.id})`
      );
    }
  });

  // If game should continue, prepare for next round
  if (shouldContinue) {
    // Increment round number in preparation for next round
    room.gameState.roundNumber++;
    console.log(
      `[roomManager.ts] Incremented round number to ${room.gameState.roundNumber} for next round`
    );
  } else {
    // Game has ended with a winner
    console.log(
      `[roomManager.ts] Game ended with winner: ${winningPlayerId || 'none'}`
    );
    endGame(roomId, winningPlayerId || '');
  }

  console.log(
    `[roomManager.ts] Round end processing complete for room ${roomId}`
  );
}

// Helper function to find a client by player ID
function findClientByPlayerId(playerId: string): ExtendedWebSocket | undefined {
  // Check all clients to find one associated with this player
  for (const [clientId, client] of clients.entries()) {
    if (client.playerId === playerId) {
      return client;
    }
  }

  // Also check beagleBoards map if it exists
  if (typeof beagleBoards !== 'undefined') {
    for (const [deviceId, device] of beagleBoards.entries()) {
      if (deviceId === playerId) {
        return device.client;
      }
    }
  }

  return undefined;
}
