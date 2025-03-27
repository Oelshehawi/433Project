import http from 'http';
import express from 'express';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import dgram from 'dgram';
import {
  ExtendedWebSocket,
  Room,
  RoomListItem,
  Player,
  WebSocketMessage,
  ClientEventType,
  ServerEventType,
  CreateRoomPayload,
  JoinRoomPayload,
  LeaveRoomPayload,
  PlayerReadyPayload,
  GameStartedPayload,
  GestureEventPayload,
  ErrorPayload,
  UdpMessagePayload,
  BeagleBoardCommandPayload,
} from './types';

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store active rooms
const rooms: Map<string, Room> = new Map();

// Store connected beagle boards with their device IDs
const beagleBoards: Map<
  string,
  { deviceId: string; roomId?: string; playerName?: string }
> = new Map();

// Create UDP server
const udpServer = dgram.createSocket('udp4');
const UDP_PORT = 9090;

// Helper function to broadcast to all clients
function broadcastToAllClients(message: WebSocketMessage) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// Initialize UDP server
udpServer.on('error', (err) => {
  console.error(`UDP server error:\n${err.stack}`);
  udpServer.close();
});

// Helper function to parse UDP command messages from Beagle boards
const parseBeagleBoardCommand = (
  message: string
): {
  command: string;
  deviceId: string;
  params: Record<string, string>;
} | null => {
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
};

// Helper function to parse gesture messages from Beagle boards
const parseGestureMessage = (
  message: string
): { deviceId: string; roomId: string; gestureData: string } | null => {
  try {
    if (!message.startsWith('GESTURE|')) {
      return null;
    }

    const parts = message.split('|');
    const deviceIdPart = parts[1].split(':');
    const deviceId = deviceIdPart[1];

    const roomIdPart = parts[2].split(':');
    const roomId = roomIdPart[1];

    // Extract the gesture data (everything after the third pipe)
    const gestureData = parts.slice(3).join('|');

    return { deviceId, roomId, gestureData };
  } catch (error) {
    console.error('Error parsing gesture message:', error);
    return null;
  }
};

// Handle Beagle board commands
const handleBeagleBoardCommand = (
  command: string,
  deviceId: string,
  params: Record<string, string>,
  rinfo: dgram.RemoteInfo
) => {
  console.log(`Received command ${command} from device ${deviceId}`);

  switch (command) {
    case 'LIST_ROOMS':
      // Send room list to the Beagle board
      sendRoomListToBeagleBoard(deviceId, rinfo);
      break;

    case 'JOIN_ROOM':
      // Join the Beagle board to a room
      const { RoomID, PlayerName } = params;
      if (RoomID && PlayerName) {
        joinBeagleBoardToRoom(deviceId, RoomID, PlayerName, rinfo);
      } else {
        sendResponseToBeagleBoard(
          'ERROR',
          'Missing RoomID or PlayerName',
          deviceId,
          rinfo
        );
      }
      break;

    case 'LEAVE_ROOM':
      // Remove the Beagle board from a room
      if (beagleBoards.has(deviceId)) {
        const board = beagleBoards.get(deviceId)!;
        if (board.roomId) {
          leaveBeagleBoardFromRoom(deviceId, board.roomId, rinfo);
        } else {
          sendResponseToBeagleBoard('ERROR', 'Not in a room', deviceId, rinfo);
        }
      } else {
        sendResponseToBeagleBoard(
          'ERROR',
          'Device not registered',
          deviceId,
          rinfo
        );
      }
      break;

    default:
      sendResponseToBeagleBoard(
        'ERROR',
        `Unknown command: ${command}`,
        deviceId,
        rinfo
      );
  }
};

// Handle gesture data from Beagle board
const handleGestureData = (
  deviceId: string,
  roomId: string,
  gestureData: string
) => {
  try {
    // Parse the gesture data as JSON
    const gestureJson = JSON.parse(gestureData);

    // Ensure a room exists with this ID
    if (!rooms.has(roomId)) {
      console.error(
        `Room ${roomId} not found for gesture from device ${deviceId}`
      );
      return;
    }

    // Find the player ID associated with this device in the room
    const room = rooms.get(roomId)!;
    const board = beagleBoards.get(deviceId);

    if (!board || !board.playerName) {
      console.error(
        `Device ${deviceId} not properly registered with a player name`
      );
      return;
    }

    // Find the player in the room
    const player = room.players.find((p) => p.name === board.playerName);
    if (!player) {
      console.error(`Player ${board.playerName} not found in room ${roomId}`);
      return;
    }

    // Create gesture event payload
    const payload: GestureEventPayload = {
      playerId: player.id,
      gesture: gestureJson.gesture,
      confidence: gestureJson.confidence || 1.0,
    };

    // Send the gesture event to all clients in the room
    sendToRoom(roomId, 'gesture_event', payload);

    console.log(
      `Processed gesture ${gestureJson.gesture} from device ${deviceId} in room ${roomId}`
    );
  } catch (error) {
    console.error('Error handling gesture data:', error);
  }
};

// Function to send room list to a Beagle board
const sendRoomListToBeagleBoard = (
  deviceId: string,
  rinfo: dgram.RemoteInfo
) => {
  const roomList = getRoomList();
  const response = `RESPONSE:LIST_ROOMS|DeviceID:${deviceId}|Rooms:${JSON.stringify(
    roomList
  )}`;
  udpServer.send(response, rinfo.port, rinfo.address);
};

// Function to join a Beagle board to a room
const joinBeagleBoardToRoom = (
  deviceId: string,
  roomId: string,
  playerName: string,
  rinfo: dgram.RemoteInfo
) => {
  if (!rooms.has(roomId)) {
    sendResponseToBeagleBoard(
      'ERROR',
      `Room ${roomId} not found`,
      deviceId,
      rinfo
    );
    return;
  }

  const room = rooms.get(roomId)!;

  // Check if room is full
  if (room.players.length >= room.maxPlayers) {
    sendResponseToBeagleBoard('ERROR', 'Room is full', deviceId, rinfo);
    return;
  }

  // Check if room is already playing
  if (room.status === 'playing') {
    sendResponseToBeagleBoard(
      'ERROR',
      'Game is already in progress',
      deviceId,
      rinfo
    );
    return;
  }

  // Register the Beagle board
  beagleBoards.set(deviceId, { deviceId, roomId, playerName });

  // Create a player ID
  const playerId = uuidv4();

  // Add the player to the room
  const newPlayer: Player = {
    id: playerId,
    name: playerName,
    isReady: false,
    connected: true,
  };

  room.players.push(newPlayer);

  console.log(
    `Beagle board ${deviceId} joined room ${roomId} as player ${playerName}`
  );

  // Update room for all clients
  sendToRoom(roomId, 'room_updated', { room });

  // Update room list for all clients
  broadcastToAll('room_list', { rooms: getRoomList() });

  // Send success response to Beagle board
  sendResponseToBeagleBoard(
    'SUCCESS',
    `Joined room ${roomId}`,
    deviceId,
    rinfo
  );
};

// Function to remove a Beagle board from a room
const leaveBeagleBoardFromRoom = (
  deviceId: string,
  roomId: string,
  rinfo: dgram.RemoteInfo
) => {
  if (!rooms.has(roomId)) {
    sendResponseToBeagleBoard(
      'ERROR',
      `Room ${roomId} not found`,
      deviceId,
      rinfo
    );
    return;
  }

  const room = rooms.get(roomId)!;
  const board = beagleBoards.get(deviceId);

  if (!board || !board.playerName) {
    sendResponseToBeagleBoard(
      'ERROR',
      'Device not properly registered',
      deviceId,
      rinfo
    );
    return;
  }

  // Find the player in the room
  const playerIndex = room.players.findIndex(
    (p) => p.name === board.playerName
  );

  if (playerIndex === -1) {
    sendResponseToBeagleBoard(
      'ERROR',
      `Player ${board.playerName} not found in room`,
      deviceId,
      rinfo
    );
    return;
  }

  // Remove the player from the room
  room.players.splice(playerIndex, 1);

  // Update the Beagle board record
  beagleBoards.set(deviceId, { deviceId });

  console.log(`Beagle board ${deviceId} left room ${roomId}`);

  // Update room for all clients
  sendToRoom(roomId, 'room_updated', { room });

  // Update room list for all clients
  broadcastToAll('room_list', { rooms: getRoomList() });

  // Send success response to Beagle board
  sendResponseToBeagleBoard('SUCCESS', `Left room ${roomId}`, deviceId, rinfo);
};

// Send a response to a Beagle board
const sendResponseToBeagleBoard = (
  status: string,
  message: string,
  deviceId: string,
  rinfo: dgram.RemoteInfo
) => {
  const response = `RESPONSE:${status}|DeviceID:${deviceId}|Message:${message}`;
  udpServer.send(response, rinfo.port, rinfo.address);
};

// Handler for UDP messages
udpServer.on('message', (msg, rinfo) => {
  const message = msg.toString();
  console.log(
    `UDP server received: ${message} from ${rinfo.address}:${rinfo.port}`
  );

  // Check if it's a command from a Beagle board
  const commandData = parseBeagleBoardCommand(message);
  if (commandData) {
    const { command, deviceId, params } = commandData;
    handleBeagleBoardCommand(command, deviceId, params, rinfo);
    return;
  }

  // Check if it's a gesture message from a Beagle board
  const gestureData = parseGestureMessage(message);
  if (gestureData) {
    const { deviceId, roomId, gestureData: gestureJson } = gestureData;
    handleGestureData(deviceId, roomId, gestureJson);
    return;
  }

  // If it's not a command or gesture, treat it as a regular UDP message
  const payload: UdpMessagePayload = {
    message,
    timestamp: Date.now(),
  };

  // Create a payload for the Beagle board command
  const commandPayload: BeagleBoardCommandPayload = {
    message,
    sender: rinfo.address,
    port: rinfo.port,
    timestamp: Date.now(),
  };

  // Broadcast the UDP message to all connected WebSocket clients
  broadcastToAllClients({
    event: 'udp_message',
    payload: commandPayload,
  });
});

udpServer.on('listening', () => {
  const address = udpServer.address();
  console.log(`UDP server listening on ${address.address}:${address.port}`);
});

// Bind UDP server to the specified port
udpServer.bind(UDP_PORT);

// Store client connections with custom properties
const clients: Map<string, ExtendedWebSocket> = new Map();

// Generate room list for clients
const getRoomList = (): RoomListItem[] => {
  console.log(
    Array.from(rooms.values()).map((room) => ({
      id: room.id,
      name: room.name,
      playerCount: room.players.length,
      maxPlayers: room.maxPlayers,
      status: room.status,
    }))
  );
  return Array.from(rooms.values()).map((room) => ({
    id: room.id,
    name: room.name,
    playerCount: room.players.length,
    maxPlayers: room.maxPlayers,
    status: room.status,
  }));
};

// Send message to a specific client
const sendToClient = (
  client: ExtendedWebSocket,
  event: ServerEventType,
  payload: any
) => {
  if (client.readyState === WebSocket.OPEN) {
    const message: WebSocketMessage = { event, payload };
    client.send(JSON.stringify(message));
  }
};

// Send message to all clients in a room
const sendToRoom = (roomId: string, event: ServerEventType, payload: any) => {
  clients.forEach((client) => {
    if (client.roomId === roomId && client.readyState === WebSocket.OPEN) {
      sendToClient(client, event, payload);
    }
  });
};

// Send message to all connected clients
const broadcastToAll = (event: ServerEventType, payload: any) => {
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      sendToClient(client, event, payload);
    }
  });
};

// Handle creating a new room
const handleCreateRoom = (
  client: ExtendedWebSocket,
  payload: CreateRoomPayload
) => {
  try {
    const { room, playerId } = payload;

    // Validate data
    if (!room || !playerId) {
      return sendToClient(client, 'error', {
        error: 'Missing required data',
      } as ErrorPayload);
    }

    // Store the room ID and player ID in the client object
    client.roomId = room.id;
    client.playerId = playerId;
    client.playerName = room.players[0].name;

    // Validate room data
    if (!room || !room.id || !room.name || !playerId) {
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

    // Create the room
    const newRoom: Room = {
      ...room,
      createdAt: Date.now(),
      status: 'waiting',
      players: room.players.map((player) => ({
        ...player,
        isReady: false,
        connected: true,
      })),
    };

    // Add room to storage
    rooms.set(newRoom.id, newRoom);

    console.log(`Room created: ${newRoom.id} - ${newRoom.name}`);

    // Notify the client
    sendToClient(client, 'room_updated', { room: newRoom });

    // Update room list for all clients
    broadcastToAll('room_list', { rooms: getRoomList() });
  } catch (error) {
    console.error('Error creating room:', error);
    sendToClient(client, 'error', {
      error: 'Failed to create room',
    } as ErrorPayload);
  }
};

// Handle joining an existing room
const handleJoinRoom = (
  client: ExtendedWebSocket,
  payload: JoinRoomPayload
) => {
  try {
    const { roomId, playerId, playerName } = payload;

    // Validate data
    if (!roomId || !playerId || !playerName) {
      return sendToClient(client, 'error', {
        error: 'Missing required data',
      } as ErrorPayload);
    }

    // Store the room ID and player ID in the client object
    client.roomId = roomId;
    client.playerId = playerId;
    client.playerName = playerName;

    // Check if room exists
    if (!rooms.has(roomId)) {
      return sendToClient(client, 'error', {
        error: 'Room not found',
      } as ErrorPayload);
    }

    const room = rooms.get(roomId)!;

    // Check if room is full
    if (room.players.length >= room.maxPlayers) {
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

    // Add player to room
    const newPlayer: Player = {
      id: playerId,
      name: playerName,
      isReady: false,
      connected: true,
    };

    room.players.push(newPlayer);

    console.log(`Player ${playerName} joined room ${room.name} (${roomId})`);

    // Notify all clients in the room
    sendToRoom(roomId, 'room_updated', { room });

    // Update room list for all clients
    broadcastToAll('room_list', { rooms: getRoomList() });
  } catch (error) {
    console.error('Error joining room:', error);
    sendToClient(client, 'error', {
      error: 'Failed to join room',
    } as ErrorPayload);
  }
};

// Handle leaving a room
const handleLeaveRoom = (
  client: ExtendedWebSocket,
  payload: LeaveRoomPayload
) => {
  try {
    const { roomId } = payload;
    const playerId = client.playerId;

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
      room.players.splice(playerIndex, 1);

      console.log(
        `Player ${client.playerName} left room ${room.name} (${roomId})`
      );

      // If room is empty, remove it
      if (room.players.length === 0) {
        rooms.delete(roomId);
        console.log(`Room ${roomId} deleted (no players left)`);
      } else {
        // Otherwise, update host if needed
        if (room.hostId === playerId) {
          room.hostId = room.players[0].id;
          console.log(`New host in room ${roomId}: ${room.players[0].name}`);
        }
      }

      // Clear client properties
      client.roomId = undefined;
      client.playerId = undefined;
      client.playerName = undefined;

      // Notify remaining clients in the room if it still exists
      if (rooms.has(roomId)) {
        sendToRoom(roomId, 'room_updated', { room });
      }

      // Update room list for all clients
      broadcastToAll('room_list', { rooms: getRoomList() });
    }
  } catch (error) {
    console.error('Error leaving room:', error);
  }
};

// Handle player ready status
const handlePlayerReady = (
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

    console.log(
      `Player ${player.name} (${effectivePlayerId}) in room ${
        room.name
      } (${effectiveRoomId}) is now ${isReady ? 'ready' : 'not ready'}`
    );
  } catch (error) {
    console.error('Error handling player ready:', error);
    sendToClient(client, 'error', {
      error: 'Internal server error',
    } as ErrorPayload);
  }
};

// Handle game start
const handleGameStart = (
  client: ExtendedWebSocket,
  payload: GameStartedPayload
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
        error: 'Room not found',
      } as ErrorPayload);
    }

    const room = rooms.get(roomId)!;

    // Check if all players are ready
    const allPlayersReady = room.players.every((player) => player.isReady);

    if (!allPlayersReady) {
      return sendToClient(client, 'error', {
        error: 'Not all players are ready',
      } as ErrorPayload);
    }

    // Check if client is the host
    if (client.playerId !== room.hostId) {
      return sendToClient(client, 'error', {
        error: 'Only the host can start the game',
      } as ErrorPayload);
    }

    // Update room status
    room.status = 'playing';

    console.log(`Game started in room ${room.name} (${roomId})`);

    // Notify all clients in the room
    sendToRoom(roomId, 'room_updated', { room });
    sendToRoom(roomId, 'game_started', { roomId });

    // Update room list for all clients
    broadcastToAll('room_list', { rooms: getRoomList() });
  } catch (error) {
    console.error('Error starting game:', error);
    sendToClient(client, 'error', {
      error: 'Failed to start game',
    } as ErrorPayload);
  }
};

// Handle gesture events
const handleGestureEvent = (
  client: ExtendedWebSocket,
  payload: GestureEventPayload
) => {
  try {
    const { playerId, gesture, confidence } = payload;
    const roomId = client.roomId;

    // Validate data
    if (!playerId || !gesture || !roomId) {
      return;
    }

    // Check if room exists and is playing
    if (!rooms.has(roomId) || rooms.get(roomId)!.status !== 'playing') {
      return;
    }

    console.log(
      `Gesture event: ${gesture} from player ${playerId} (conf: ${confidence})`
    );

    // Broadcast gesture event to all players in the room
    sendToRoom(roomId, 'gesture_event', { playerId, gesture, confidence });
  } catch (error) {
    console.error('Error handling gesture event:', error);
  }
};

// Send room list to a client
const handleRoomList = (client: ExtendedWebSocket) => {
  sendToClient(client, 'room_list', { rooms: getRoomList() });
};

// Handle incoming messages
const handleMessage = (
  client: ExtendedWebSocket,
  message: WebSocketMessage
) => {
  const { event, payload } = message;

  console.log(`Received event: ${event}`);

  switch (event as ClientEventType) {
    case 'create_room':
      handleCreateRoom(client, payload);
      break;
    case 'join_room':
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
    default:
      console.warn(`Unknown event type: ${event}`);
      break;
  }
};

// Set up WebSocket connection handler
wss.on('connection', (ws: WebSocket) => {
  // Create extended client with custom properties
  const client = ws as ExtendedWebSocket;
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
      console.error('Error parsing message:', error);
    }
  });

  // Handle client disconnection
  client.on('close', () => {
    console.log(`Client disconnected: ${client.id}`);

    // If client was in a room, handle leaving
    if (client.roomId) {
      handleLeaveRoom(client, { roomId: client.roomId });
    }

    // Remove client from clients map
    clients.delete(client.id);
  });

  // Send initial room list to the client
  handleRoomList(client);
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

// Add a basic route for health check
app.get('/', (req, res) => {
  res.send('Gesture Tower WebSocket Server is running');
});

// Start the server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`WebSocket server is ready at ws://localhost:${PORT}`);
});
