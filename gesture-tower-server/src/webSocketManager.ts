import WebSocket from 'ws';
import {
  ExtendedWebSocket,
  WebSocketMessage,
  GameActionType,
  Room,
  Player,
  GestureEventPayload,
  GestureType,
} from './types';
import { v4 as uuidv4 } from 'uuid';
import {
  handleCreateRoom,
  handleJoinRoom,
  handleLeaveRoom,
  handlePlayerReady,
  handleGameStart,
  handleGestureEvent,
  handleRoomList,
  handleGetRoom,
  getRoomList,
  rooms,
  handleRoundStartEvent,
  webClientNextRoundReadyRooms,
  handleNextRoundReady,
} from './roomManager';
import { clients, beagleBoards, broadcastToAll, sendToRoom } from './messaging';
import { initializeGameState } from './gameManager';
import { initializeCardsForRoom } from './cardManager';

// Functions for handling BeagleBoard commands via WebSocket

// Initialize WebSocket server
export function initializeWebSocketServer(wss: WebSocket.Server) {
  // Setup WebSocket connection handlers
  wss.on('connection', (ws: WebSocket) => {
    setupNewClientConnection(ws as ExtendedWebSocket);
  });

  // Health check interval to detect disconnected clients
  const interval = setInterval(() => {
    clients.forEach((client) => {
      if (!client.isAlive) {
        console.log(`Client ${client.id} timed out`);

        // If client was in a room, handle leaving
        if (client.roomId) {
          handleLeaveRoom(client, { roomId: client.roomId });
        }

        // Remove client from clients map
        clients.delete(client.id);
        return client.terminate();
      }

      client.isAlive = false;
      client.ping();
    });
  }, 30000);

  // Clean up interval on server close
  wss.on('close', () => {
    clearInterval(interval);
  });

  return wss;
}

// Set up a new client connection
function setupNewClientConnection(client: ExtendedWebSocket) {
  // Initialize client properties
  client.id = uuidv4();
  client.isAlive = true;

  // Add client to clients map
  clients.set(client.id, client);

  console.log(`Client connected: ${client.id}`);

  // Set up ping/pong for connection health check
  client.on('pong', () => {
    client.isAlive = true;
  });

  // Handle incoming messages
  client.on('message', (data: WebSocket.Data) => {
    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage;
      handleMessage(client, message);
    } catch (error) {
      // Try to parse as BeagleBoard command format
      try {
        const messageStr = data.toString();
        if (messageStr.startsWith('CMD:')) {
          handleBeagleBoardCommand(client, messageStr);
        } else if (messageStr.startsWith('GESTURE|')) {
          handleBeagleBoardGesture(client, messageStr);
        } else {
          console.error('Error parsing message:', error);
        }
      } catch (beagleBoardError) {
        console.error(
          'Error parsing potential BeagleBoard message:',
          beagleBoardError
        );
      }
    }
  });

  // Handle client disconnection
  client.on('close', () => {
    console.log(`Client disconnected: ${client.id}`);

    // If client was in a room, handle leaving
    if (client.roomId) {
      handleLeaveRoom(client, { roomId: client.roomId });
    }

    // If client was a BeagleBoard, remove from beagleBoards map
    if (client.deviceId) {
      beagleBoards.delete(client.deviceId);
    }

    // Remove client from clients map
    clients.delete(client.id);
  });

  // Send initial room list to the client
  handleRoomList(client);
}

// Handle incoming message based on event type
function handleMessage(client: ExtendedWebSocket, message: WebSocketMessage) {
  const { event, payload } = message;

  console.log(`Received event: ${event}`);
  console.log(`Payload for ${event}:`, JSON.stringify(payload));

  switch (event) {
    case 'create_room':
      console.log('Processing create_room event');
      handleCreateRoom(client, payload);
      break;
    case 'join_room':
      console.log('Processing join_room event');
      handleJoinRoom(client, payload);
      break;
    case 'leave_room':
      handleLeaveRoom(client, payload);
      break;
    case 'player_ready':
      handlePlayerReady(client, payload);
      break;
    case 'game_started':
      handleGameStart(client, payload);
      break;
    case 'gesture_event':
      handleGestureEvent(client, payload);
      break;
    case 'room_list':
      handleRoomList(client);
      break;
    case 'get_room':
      handleGetRoom(client, payload);
      break;
    case 'get_game_state':
      handleGetGameState(client, payload);
      break;
    case 'next_round_ready':
      console.log(
        `[webSocketManager.ts] Forwarding next_round_ready to roomManager for ${client.id}`
      );
      handleNextRoundReady(client, payload);
      break;
    case 'game_ready':
      handleGameReady(client, payload);
      break;
    case 'round_start':
      handleRoundStartEvent(client, payload);
      break;
    case 'beagleboard_command':
      // Handle BeagleBoard specific commands
      if (payload && payload.command) {
        handleBeagleBoardWSCommand(client, payload);
      }
      break;
    case 'round_end_ack':
      // Handle round end acknowledgment from beagleboard
      handleRoundEndAck(client, payload);
      break;
    default:
      console.warn(`Unknown event type: ${event}`);
      break;
  }
}

// Handle BeagleBoard commands that come in the old format
function handleBeagleBoardCommand(client: ExtendedWebSocket, message: string) {
  try {
    // Parse BeagleBoard command
    const cmdResult = parseBeagleBoardCommand(message);
    if (!cmdResult) return;

    const { command, deviceId, params } = cmdResult;

    // Store or update client info
    client.deviceId = deviceId;
    beagleBoards.set(deviceId, {
      deviceId,
      client,
    });

    // Process commands
    console.log(`Received command ${command} from device ${deviceId}`);

    switch (command) {
      case 'LIST_ROOMS':
        sendRoomListToBeagleBoard(client, deviceId);
        break;

      case 'CREATE_ROOM':
        const { RoomID, RoomName, PlayerName } = params;
        if (RoomID && RoomName && PlayerName) {
          createRoomForBeagleBoard(
            client,
            deviceId,
            RoomID,
            RoomName,
            PlayerName
          );
        } else {
          sendResponseToBeagleBoard(
            client,
            'CREATE_ROOM',
            'ERROR',
            'Missing RoomID, RoomName or PlayerName',
            deviceId
          );
        }
        break;

      case 'JOIN_ROOM':
        const { RoomID: joinRoomID, PlayerName: joinPlayerName } = params;
        if (joinRoomID && joinPlayerName) {
          joinBeagleBoardToRoom(client, deviceId, joinRoomID, joinPlayerName);
        } else {
          sendResponseToBeagleBoard(
            client,
            'JOIN_ROOM',
            'ERROR',
            'Missing RoomID or PlayerName',
            deviceId
          );
        }
        break;

      case 'LEAVE_ROOM':
        if (beagleBoards.has(deviceId)) {
          const board = beagleBoards.get(deviceId)!;
          if (board.roomId) {
            leaveBeagleBoardFromRoom(client, deviceId, board.roomId);
          } else {
            sendResponseToBeagleBoard(
              client,
              'LEAVE_ROOM',
              'ERROR',
              'Not in a room',
              deviceId
            );
          }
        } else {
          sendResponseToBeagleBoard(
            client,
            'LEAVE_ROOM',
            'ERROR',
            'Device not registered',
            deviceId
          );
        }
        break;

      case 'SET_READY':
        const { Ready } = params;
        if (beagleBoards.has(deviceId)) {
          const board = beagleBoards.get(deviceId)!;
          if (board.roomId) {
            const isReady = Ready === 'true' || Ready === '1';
            setBeagleBoardReady(client, deviceId, board.roomId, isReady);
          } else {
            sendResponseToBeagleBoard(
              client,
              'SET_READY',
              'ERROR',
              'Not in a room',
              deviceId
            );
          }
        } else {
          sendResponseToBeagleBoard(
            client,
            'SET_READY',
            'ERROR',
            'Device not registered',
            deviceId
          );
        }
        break;

      default:
        sendResponseToBeagleBoard(
          client,
          command,
          'ERROR',
          `Unknown command: ${command}`,
          deviceId
        );
    }

    // Broadcast the command to all web clients for monitoring
    broadcastToAll('beagle_board_command', {
      message,
      sender: deviceId,
      timestamp: Date.now(),
    });

    // Update room lists for all clients
    broadcastToAll('room_list', {
      rooms: getRoomList(),
    });
  } catch (error) {
    console.error('Error handling BeagleBoard command:', error);
  }
}

// Handle BeagleBoard commands in WebSocket JSON format
function handleBeagleBoardWSCommand(client: ExtendedWebSocket, payload: any) {
  try {
    const { command, deviceId, ...params } = payload;

    if (!command || !deviceId) {
      console.error('Invalid BeagleBoard command payload', payload);
      return;
    }

    // Convert to old format for processing
    const messageParams = Object.entries(params)
      .map(([key, value]) => `${key}:${value}`)
      .join('|');

    const oldFormatMessage = `CMD:${command}|DeviceID:${deviceId}${
      messageParams ? '|' + messageParams : ''
    }`;

    handleBeagleBoardCommand(client, oldFormatMessage);
  } catch (error) {
    console.error('Error handling BeagleBoard WS command:', error);
  }
}

// Parse a BeagleBoard gesture command
function parseBeagleBoardGesture(message: string): GestureEventPayload | null {
  try {
    // Expected format: "GESTURE|<deviceId>|<gesture>|<confidence>|<cardId>"
    const parts = message.split('|');
    if (parts.length < 4 || parts[0] !== 'GESTURE') {
      return null;
    }

    const deviceId = parts[1];
    const gestureType = parts[2] as GestureType;
    const confidence = parseFloat(parts[3]);
    const cardId = parts.length > 4 ? parts[4] : undefined;

    // Get the BeagleBoard client info
    const beagleBoard = Array.from(beagleBoards.values()).find(
      (bb) => bb.deviceId === deviceId
    );

    if (!beagleBoard) {
      console.error(
        `[webSocketManager.ts] BeagleBoard with ID ${deviceId} not found`
      );
      return null;
    }

    // Need to know which room the device is in
    if (!beagleBoard.roomId) {
      console.error(
        `[webSocketManager.ts] BeagleBoard ${deviceId} is not in a room`
      );
      return null;
    }

    // Get the current round number from the room
    let roundNumber: number | undefined;
    if (rooms.has(beagleBoard.roomId)) {
      const room = rooms.get(beagleBoard.roomId)!;
      if (room.gameState) {
        roundNumber = room.gameState.roundNumber;
      }
    }

    const gesture: GestureEventPayload = {
      playerId: deviceId,
      gesture: gestureType,
      confidence: confidence,
      cardId,
      roomId: beagleBoard.roomId,
      roundNumber,
    };

    return gesture;
  } catch (error) {
    console.error(
      `[webSocketManager.ts] Error parsing BeagleBoard gesture:`,
      error
    );
    return null;
  }
}

// Handle BeagleBoard gesture message
function handleBeagleBoardGesture(client: ExtendedWebSocket, message: string) {
  try {
    const gesture = parseBeagleBoardGesture(message);
    if (!gesture) {
      console.error(
        `[webSocketManager.ts] Invalid gesture message format: ${message}`
      );
      return;
    }

    console.log(`[webSocketManager.ts] Parsed BeagleBoard gesture:`, gesture);

    // Process the gesture as a game event
    handleGestureEvent(client, gesture);
  } catch (error) {
    console.error(
      `[webSocketManager.ts] Error handling BeagleBoard gesture:`,
      error
    );
  }
}

// Helper function to send response to BeagleBoard
function sendResponseToBeagleBoard(
  client: ExtendedWebSocket,
  command: string,
  status: string,
  message: string,
  deviceId: string
) {
  if (client.readyState === WebSocket.OPEN) {
    const response = `RESPONSE:${command}|DeviceID:${deviceId}|status:${status}|message:${message}\n`;
    client.send(response);
  }
}

// Function to send room list to a BeagleBoard
function sendRoomListToBeagleBoard(
  client: ExtendedWebSocket,
  deviceId: string
) {
  const roomList = getRoomList();

  // Make sure format exactly matches what client expects: RESPONSE:LIST_ROOMS|DeviceID:deviceId|Rooms:json
  const response = `RESPONSE:LIST_ROOMS|DeviceID:${deviceId}|Rooms:${JSON.stringify(
    roomList
  )}`;

  console.log(`Sending room list to device ${deviceId}`);

  // Send the response back to the beagle board
  sendResponseToBeagleBoard(
    client,
    'LIST_ROOMS',
    'SUCCESS',
    response,
    deviceId
  );
}

// Function to join a BeagleBoard to a room
function joinBeagleBoardToRoom(
  client: ExtendedWebSocket,
  deviceId: string,
  roomId: string,
  playerName: string
) {
  console.log(
    `BeagleBoard ${deviceId} joining room ${roomId} as ${playerName}`
  );

  // Find the room (case insensitive to be more forgiving with IDs)
  const room = Array.from(rooms.values()).find(
    (r) => r.id.toLowerCase() === roomId.toLowerCase()
  );

  if (!room) {
    console.error(`Room ${roomId} not found for BeagleBoard join request`);
    sendResponseToBeagleBoard(
      client,
      'JOIN_ROOM',
      'ERROR',
      `Room ${roomId} not found`,
      deviceId
    );
    return;
  }

  // Check if room is full (only count BeagleBoard players, not web admins)
  const beagleBoardPlayerCount = room.players.filter(
    (player) => player.playerType === 'beagleboard'
  ).length;

  console.log(
    `Room ${roomId} current BeagleBoard player count: ${beagleBoardPlayerCount}/${room.maxPlayers}`
  );

  if (beagleBoardPlayerCount >= room.maxPlayers) {
    console.error(
      `Room ${roomId} is full, cannot add more BeagleBoard players`
    );
    sendResponseToBeagleBoard(
      client,
      'JOIN_ROOM',
      'ERROR',
      'Room is full',
      deviceId
    );
    return;
  }

  // Create a unique player ID for the beagle board
  const playerId = uuidv4();

  // Add player to the room
  const newPlayer: Player = {
    id: playerId,
    name: playerName,
    isReady: false,
    connected: true,
    playerType: 'beagleboard', // Mark as BeagleBoard player
  };

  room.players.push(newPlayer);

  // If no host set yet, make this player the host
  if (!room.hostId && room.players.length > 0) {
    room.hostId = playerId;
    console.log(`Player ${playerName} set as host of room ${room.id}`);
  }

  // Register the beagle board with the room
  beagleBoards.set(deviceId, {
    deviceId,
    roomId: room.id,
    playerName,
    client,
  });

  // Update the room in the map to ensure latest state
  rooms.set(room.id, room);

  // Log updated player count for verification
  const updatedPlayerCount = room.players.filter(
    (p) => p.playerType === 'beagleboard'
  ).length;
  console.log(
    `Room ${room.id} now has ${updatedPlayerCount} BeagleBoard players`
  );
  console.log(
    `Total players in room: ${room.players.length} (including web admins)`
  );
  console.log(
    `Players in room: ${JSON.stringify(
      room.players.map((p) => ({ name: p.name, type: p.playerType }))
    )}`
  );

  // Send success response back to the beagle board
  sendResponseToBeagleBoard(
    client,
    'JOIN_ROOM',
    'SUCCESS',
    `Joined room ${room.id} successfully`,
    deviceId
  );

  try {
    // Broadcast the specific room update to ALL clients
    console.log(`Broadcasting room update for room ${room.id}`);
    broadcastToAll('room_updated', { room });

    // Also broadcast the updated room list
    broadcastToAll('room_list', { rooms: getRoomList() });

    console.log(
      `Successfully broadcast updates for BeagleBoard ${deviceId} joining room ${room.id}`
    );
  } catch (error) {
    console.error(`Error broadcasting room updates: ${error}`);
  }

  console.log(
    `Beagle board ${deviceId} joined room ${room.id} as player ${playerName}`
  );
}

// Function to remove a BeagleBoard from a room
function leaveBeagleBoardFromRoom(
  client: ExtendedWebSocket,
  deviceId: string,
  roomId: string
) {
  if (!rooms.has(roomId)) {
    sendResponseToBeagleBoard(
      client,
      'LEAVE_ROOM',
      'ERROR',
      `Room ${roomId} not found`,
      deviceId
    );
    return;
  }

  const room = rooms.get(roomId)!;
  const board = beagleBoards.get(deviceId);

  if (!board || !board.playerName) {
    sendResponseToBeagleBoard(
      client,
      'LEAVE_ROOM',
      'ERROR',
      'Device not properly registered',
      deviceId
    );
    return;
  }

  // Find the player in the room
  const playerIndex = room.players.findIndex(
    (p) => p.name === board.playerName
  );

  if (playerIndex === -1) {
    sendResponseToBeagleBoard(
      client,
      'LEAVE_ROOM',
      'ERROR',
      `Player ${board.playerName} not found in room`,
      deviceId
    );
    return;
  }

  // Remove the player
  room.players.splice(playerIndex, 1);

  // Update Beagle board record - remove room association
  beagleBoards.set(deviceId, {
    deviceId,
    client,
  });

  // If room is empty, remove it
  if (room.players.length === 0) {
    rooms.delete(roomId);
    console.log(`Room ${roomId} removed as it's now empty`);
  } else {
    // Update room for all clients
    broadcastToAll('room_updated', { room });
  }

  // Update room list for all clients
  broadcastToAll('room_list', {
    rooms: getRoomList(),
  });

  // Send success response to Beagle board
  sendResponseToBeagleBoard(
    client,
    'LEAVE_ROOM',
    'SUCCESS',
    `Left room ${roomId}`,
    deviceId
  );
}

// Function to set BeagleBoard player ready status
function setBeagleBoardReady(
  client: ExtendedWebSocket,
  deviceId: string,
  roomId: string,
  isReady: boolean
) {
  // Check if room exists
  if (!rooms.has(roomId)) {
    sendResponseToBeagleBoard(
      client,
      'SET_READY',
      'ERROR',
      `Room ${roomId} not found`,
      deviceId
    );
    return;
  }

  const room = rooms.get(roomId)!;
  const board = beagleBoards.get(deviceId);

  if (!board || !board.playerName) {
    sendResponseToBeagleBoard(
      client,
      'SET_READY',
      'ERROR',
      'Device not properly registered',
      deviceId
    );
    return;
  }

  // Find the player in the room
  const playerIndex = room.players.findIndex(
    (p) => p.name === board.playerName
  );

  if (playerIndex === -1) {
    sendResponseToBeagleBoard(
      client,
      'SET_READY',
      'ERROR',
      `Player ${board.playerName} not found in room`,
      deviceId
    );
    return;
  }

  // Update player ready status
  room.players[playerIndex].isReady = isReady;

  // Broadcast the ready status change
  sendToRoom(roomId, 'player_ready', {
    playerId: room.players[playerIndex].id,
    isReady,
  });

  // Update room in map
  rooms.set(roomId, room);

  // Send success response
  sendResponseToBeagleBoard(
    client,
    'SET_READY',
    'SUCCESS',
    `Ready status set to ${isReady}`,
    deviceId
  );

  // Update room for all clients
  broadcastToAll('room_updated', { room });

  // Check if all players are ready to start the game
  const allPlayersReady = room.players.every((player) => player.isReady);

  // Verify we have enough players (2 BeagleBoard players) for normal gameplay
  const beagleBoardPlayers = room.players.filter(
    (p) => p.playerType === 'beagleboard'
  ).length;
  const hasEnoughPlayers = beagleBoardPlayers >= 2;
  console.log(
    `Room has ${beagleBoardPlayers} BeagleBoard player(s). Require 2 players for normal gameplay.`
  );

  const notPlaying = room.status !== 'playing';

  if (allPlayersReady && hasEnoughPlayers && notPlaying) {
    console.log(`All players ready in room ${roomId}, starting game...`);
    startRoomGame(roomId);
  }
}

// Helper function to parse Beagle board command messages
function parseBeagleBoardCommand(message: string): {
  command: string;
  deviceId: string;
  params: Record<string, string>;
} | null {
  try {
    if (!message.startsWith('CMD:')) {
      return null;
    }

    const parts = message.split('|');
    const cmdPart = parts[0].split(':');
    const command = cmdPart[1];

    const deviceIdPart = parts[1].split(':');
    const deviceId = deviceIdPart[1];

    const params: Record<string, string> = {};
    for (let i = 2; i < parts.length; i++) {
      const param = parts[i].split(':');
      if (param.length === 2) {
        params[param[0]] = param[1];
      }
    }

    return { command, deviceId, params };
  } catch (error) {
    console.error('Error parsing Beagle board command:', error);
    return null;
  }
}

// Add this as a new function in the file
function createRoomForBeagleBoard(
  client: ExtendedWebSocket,
  deviceId: string,
  roomId: string,
  roomName: string,
  playerName: string
) {
  console.log(
    `BeagleBoard ${deviceId} creating room ${roomId} with name ${roomName}`
  );

  // Check if room already exists
  if (rooms.has(roomId)) {
    console.error(`Room ${roomId} already exists`);
    sendResponseToBeagleBoard(
      client,
      'CREATE_ROOM',
      'ERROR',
      `Room ${roomId} already exists`,
      deviceId
    );
    return;
  }

  // Create a unique player ID for the beagle board
  const playerId = deviceId;

  // Create the room
  const newRoom: Room = {
    id: roomId,
    name: roomName,
    createdAt: Date.now(),
    hostId: playerId, // BeagleBoard is the host
    players: [
      {
        id: playerId,
        name: playerName,
        isReady: false,
        connected: true,
        playerType: 'beagleboard',
      },
    ],
    status: 'waiting',
    maxPlayers: 2, // Default max players
  };

  // Add room to the rooms map
  rooms.set(roomId, newRoom);

  // Register the beagle board with the room
  beagleBoards.set(deviceId, {
    deviceId,
    roomId: roomId,
    playerName,
    client,
  });

  // Send success response back to the beagle board
  sendResponseToBeagleBoard(
    client,
    'CREATE_ROOM',
    'SUCCESS',
    `Created room ${roomId} successfully`,
    deviceId
  );

  try {
    // Broadcast room updates
    broadcastToAll('room_updated', { room: newRoom });
    broadcastToAll('room_list', { rooms: getRoomList() });

    console.log(
      `Successfully broadcast updates for BeagleBoard ${deviceId} creating room ${roomId}`
    );
  } catch (error) {
    console.error(`Error broadcasting room updates: ${error}`);
  }
}

// Function to handle starting a room's game
function startRoomGame(roomId: string) {
  if (!rooms.has(roomId)) {
    console.error(`Room ${roomId} not found for starting game`);
    return;
  }

  const room = rooms.get(roomId)!;

  // Check if game is already in progress
  if (room.status === 'playing') {
    console.log(`Game already in progress for room ${roomId}`);
    return;
  }

  // Verify all players are ready
  const notReadyPlayers = room.players.filter((player) => !player.isReady);
  if (notReadyPlayers.length > 0) {
    console.log(
      `Not all players are ready in room ${roomId}. Waiting for: ${notReadyPlayers
        .map((p) => p.name)
        .join(', ')}`
    );
    return;
  }

  // Set room status to playing
  room.status = 'playing';

  // Initialize game state
  const success = initializeGameState(roomId);

  if (!success) {
    console.error(`Failed to initialize game state for room ${roomId}`);
    room.status = 'waiting';
    return;
  }

  // Initialize cards for the room
  initializeCardsForRoom(roomId);

  // Distribute initial cards to all players
  const beagleBoardPlayers = room.players.filter(
    (player) => player.playerType === 'beagleboard'
  );

  beagleBoardPlayers.forEach((player) => {
    if (room.playerCards && room.playerCards.has(player.id)) {
      const playerCards = room.playerCards.get(player.id)!;

      console.log(
        `Sending ${playerCards.cards.length} cards to player ${player.name} (${player.id}) in room ${roomId}`
      );

      // Find the BeagleBoard device for this player
      const beagleBoard = Array.from(beagleBoards.values()).find(
        (board) => board.playerName === player.name
      );

      if (beagleBoard && beagleBoard.client) {
        console.log(
          `Found beagleboard for player ${player.name}: ${beagleBoard.deviceId}`
        );

        // Send cards to the BeagleBoard client
        beagleBoard.client.send(
          JSON.stringify({
            event: 'beagle_board_command',
            payload: {
              command: 'CARDS',
              cards: playerCards.cards,
            },
          })
        );

        console.log(`Cards sent to BeagleBoard ${beagleBoard.deviceId}`);
      } else {
        console.error(
          `No BeagleBoard found for player ${player.name}. Cards not sent.`
        );
      }
    }
  });

  // Broadcast game started event
  sendToRoom(roomId, 'game_started', {
    roomId,
    gameState: room.gameState,
  });

  console.log(`Game started in room ${roomId}`);
}

// Add a handler for ping events
export const setupPingHandler = (client: ExtendedWebSocket) => {
  client.on('message', (message: WebSocket.Data) => {
    try {
      const data = JSON.parse(message.toString());

      // Handle ping event explicitly
      if (data.event === 'ping') {
        // Send a pong response immediately with a proper payload
        client.send(
          JSON.stringify({
            event: 'pong',
            payload: { timestamp: Date.now() },
          })
        );

        // Reset client's ping timers since we received activity
        if (client.pingTimeout) {
          clearTimeout(client.pingTimeout);
          setPingTimeout(client);
        }
      }
    } catch (e) {
      // Ignore parsing errors
    }
  });
};

// Update client connections when not using WebSocket native ping/pong
export const setPingTimeout = (client: ExtendedWebSocket) => {
  // Clear existing timeout if any
  if (client.pingTimeout) {
    clearTimeout(client.pingTimeout);
  }

  // Set new ping timeout - terminate connection after 60 seconds of inactivity
  client.pingTimeout = setTimeout(() => {
    console.log('Client ping timeout - terminating connection');
    client.terminate();
  }, 60000); // 60 seconds
};

// Add this function to reset ping timeout when any message is received
export const resetPingTimeoutOnMessage = (client: ExtendedWebSocket) => {
  if (client.pingTimeout) {
    clearTimeout(client.pingTimeout);
    setPingTimeout(client);
  }
};

// Function to handle round end acknowledgment from beagleboard
function handleRoundEndAck(client: ExtendedWebSocket, payload: any) {
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

  // Check if we have a game state
  if (!room.gameState) {
    console.error(`Game state not found for room ${roomId}`);
    return;
  }

  // Check if this acknowledgment is for the current round
  if (room.gameState.roundNumber !== roundNumber) {
    console.warn(
      `Round number mismatch: got ack for round ${roundNumber} but current round is ${room.gameState.roundNumber}`
    );
    return;
  }

  // Mark this player as having completed their move
  console.log(`Marking ${playerId} as having completed round ${roundNumber}`);
  room.gameState.playerMoves.set(playerId, true);

  // Forward the round_end_ack to web clients in the room
  // This allows the web client to know when BeagleBoards have acknowledged the round end
  console.log(`Forwarding round_end_ack to web clients in room ${roomId}`);

  // Get total number of BeagleBoard players for this room
  const beagleBoardPlayers = room.players.filter(
    (p) => p.playerType === 'beagleboard'
  ).length;

  // Get number of players who have acknowledged
  const acknowledgedPlayers = Array.from(
    room.gameState.playerMoves.entries()
  ).filter(([id, moved]) => moved).length;

  // Calculate next round number
  const nextRoundNumber = room.gameState.roundNumber + 1;

  sendToRoom(roomId, 'round_end_ack', {
    roomId,
    playerId,
    roundNumber,
    nextRoundNumber,
    acknowledgedPlayers,
    totalPlayers: beagleBoardPlayers,
    allAcknowledged: acknowledgedPlayers >= beagleBoardPlayers,
  });

  // Check if all players have completed their moves
  const allPlayersCompleted = Array.from(
    room.gameState.playerMoves.values()
  ).every((moved) => moved);

  console.log(`Player move status for round ${roundNumber}:`);
  room.gameState.playerMoves.forEach((moved, id) => {
    console.log(`  - ${id}: ${moved ? 'completed' : 'not completed'}`);
  });

  // If all players have completed their moves, end the round
  if (allPlayersCompleted) {
    console.log(
      `All players have completed their moves for round ${roundNumber}. Ending round.`
    );
    const { endRound } = require('./gameManager');
    endRound(roomId);
  }
}

// Function to handle get_game_state event
function handleGetGameState(client: ExtendedWebSocket, payload: any) {
  const { roomId } = payload;
  console.log(
    `[webSocketManager.ts] Handling get_game_state for room ${roomId}`
  );

  if (!roomId) {
    console.error(
      `[webSocketManager.ts] Missing roomId in get_game_state event`
    );
    return;
  }

  // Check if the room exists
  if (!rooms.has(roomId)) {
    console.error(
      `[webSocketManager.ts] Room ${roomId} not found for get_game_state`
    );
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          event: 'error',
          payload: {
            message: `Room ${roomId} not found`,
            code: 'ROOM_NOT_FOUND',
          },
        })
      );
    }
    return;
  }

  const room = rooms.get(roomId)!;

  // Check if the room has a game state
  if (!room.gameState) {
    console.error(
      `[webSocketManager.ts] Game state not found for room ${roomId}`
    );
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          event: 'error',
          payload: {
            message: `Game not started in room ${roomId}`,
            code: 'GAME_NOT_STARTED',
          },
        })
      );
    }
    return;
  }

  // Prepare game state for sending
  const gameStateForSending = {
    towerHeights: Object.fromEntries(room.gameState.towerHeights),
    goalHeights: Object.fromEntries(room.gameState.goalHeights),
    roundNumber: room.gameState.roundNumber,
  };

  // Send the game state to the client
  if (client.readyState === WebSocket.OPEN) {
    client.send(
      JSON.stringify({
        event: 'game_state_update',
        payload: {
          roomId,
          gameState: gameStateForSending,
          message: 'Game state retrieved successfully',
        },
      })
    );
    console.log(
      `[webSocketManager.ts] Game state sent to client for room ${roomId}`
    );
  }
}

// Function to handle game_ready event from web client
function handleGameReady(client: ExtendedWebSocket, payload: any) {
  const { roomId } = payload;
  console.log(`[webSocketManager.ts] Received game_ready for room ${roomId}`);

  if (!roomId) {
    console.error(`[webSocketManager.ts] Missing roomId in game_ready event`);
    return;
  }

  // Check if the room exists
  if (!rooms.has(roomId)) {
    console.error(
      `[webSocketManager.ts] Room ${roomId} not found for game_ready`
    );
    return;
  }

  const room = rooms.get(roomId)!;

  // Check if the room has a game state
  if (!room.gameState) {
    console.error(
      `[webSocketManager.ts] Game state not found for room ${roomId}`
    );
    return;
  }

  // Import the handleGameReady function from roomManager
  const { handleGameReady: rmHandleGameReady } = require('./roomManager');

  console.log(
    `[webSocketManager.ts] Web client ready for game in room ${roomId}`
  );
  console.log(`Received game_ready signal from web client for room ${roomId}`);

  // Delegate to roomManager's implementation
  rmHandleGameReady(client, payload);
}
