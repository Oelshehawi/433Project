import http from 'http';
import https from 'https';
import fs from 'fs';
import express from 'express';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import dgram from 'dgram';
import cors from 'cors';
import dotenv from 'dotenv';
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

// Load environment variables
dotenv.config();

// Initialize Express app and HTTP server
const app = express();

// Enable CORS for Vercel frontend
app.use(
  cors({
    origin: 'https://433-project.vercel.app',
    methods: ['GET', 'POST'],
    credentials: true,
  })
);

// Create HTTP server (for fallback)
const httpServer = http.createServer(app);

// Try to create HTTPS server if certificates exist
let server;
try {
  // Check if SSL certificates exist and create HTTPS server
  if (
    fs.existsSync('/etc/letsencrypt/live/your-app/privkey.pem') &&
    fs.existsSync('/etc/letsencrypt/live/your-app/fullchain.pem')
  ) {
    // Load SSL certificates
    const privateKey = fs.readFileSync(
      '/etc/letsencrypt/live/your-app/privkey.pem',
      'utf8'
    );
    const certificate = fs.readFileSync(
      '/etc/letsencrypt/live/your-app/fullchain.pem',
      'utf8'
    );
    const credentials = { key: privateKey, cert: certificate };

    // Create HTTPS server
    server = https.createServer(credentials, app);
    console.log('HTTPS server created with SSL certificates');
  } else {
    // Use HTTP server if certificates don't exist
    server = httpServer;
    console.log('SSL certificates not found. Using HTTP server (insecure)');
    console.log(
      'Warning: Browser clients over HTTPS will not be able to connect'
    );
  }
} catch (error) {
  console.error('Error setting up HTTPS server:', error);
  server = httpServer;
  console.log('Falling back to HTTP server due to error');
}

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

// Helper function to broadcast to all clients
function broadcastToAllClients(message: WebSocketMessage) {
  // Use the same method as broadcastToAll to ensure consistent formatting
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
          'JOIN_ROOM',
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
          sendResponseToBeagleBoard(
            'LEAVE_ROOM',
            'ERROR',
            'Not in a room',
            deviceId,
            rinfo
          );
        }
      } else {
        sendResponseToBeagleBoard(
          'LEAVE_ROOM',
          'ERROR',
          'Device not registered',
          deviceId,
          rinfo
        );
      }
      break;

    case 'SET_READY':
      // Set the BeagleBoard player ready status
      const { Ready } = params;
      if (beagleBoards.has(deviceId)) {
        const board = beagleBoards.get(deviceId)!;
        if (board.roomId) {
          const isReady = Ready === 'true' || Ready === '1';
          setBeagleBoardReady(deviceId, board.roomId, isReady, rinfo);
        } else {
          sendResponseToBeagleBoard(
            'SET_READY',
            'ERROR',
            'Not in a room',
            deviceId,
            rinfo
          );
        }
      } else {
        sendResponseToBeagleBoard(
          'SET_READY',
          'ERROR',
          'Device not registered',
          deviceId,
          rinfo
        );
      }
      break;

    default:
      sendResponseToBeagleBoard(
        command,
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
  console.log(roomList);

  // Make sure format exactly matches what client expects: RESPONSE:LIST_ROOMS|DeviceID:deviceId|Rooms:json
  const response = `RESPONSE:LIST_ROOMS|DeviceID:${deviceId}|Rooms:${JSON.stringify(
    roomList
  )}`;

  console.log(`Sending response to ${rinfo.address}:${rinfo.port}:`, response);

  // Send the response back to the beagle board
  udpServer.send(response, rinfo.port, rinfo.address, (err) => {
    if (err) {
      console.error(`Error sending room list to device ${deviceId}:`, err);
    } else {
      console.log(`Sent room list to device ${deviceId}`);
    }
  });
};

// Function to join a Beagle board to a room
const joinBeagleBoardToRoom = (
  deviceId: string,
  roomId: string,
  playerName: string,
  rinfo: dgram.RemoteInfo
) => {
  // Find the room (case insensitive to be more forgiving with IDs)
  const room = Array.from(rooms.values()).find(
    (r) => r.id.toLowerCase() === roomId.toLowerCase()
  );

  if (!room) {
    sendResponseToBeagleBoard(
      'JOIN_ROOM',
      'ERROR',
      `Room ${roomId} not found`,
      deviceId,
      rinfo
    );
    return;
  }

  // Check if room is full
  if (room.players.length >= room.maxPlayers) {
    sendResponseToBeagleBoard(
      'JOIN_ROOM',
      'ERROR',
      'Room is full',
      deviceId,
      rinfo
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
  };

  room.players.push(newPlayer);

  // Register the beagle board with the room
  beagleBoards.set(deviceId, {
    deviceId,
    roomId: room.id,
    playerName,
  });

  // Send success response back to the beagle board
  sendResponseToBeagleBoard(
    'JOIN_ROOM',
    'SUCCESS',
    `Joined room ${room.id} successfully`,
    deviceId,
    rinfo
  );

  // Notify all clients about the room update
  sendToRoom(room.id, 'room_updated', { room });

  // Also broadcast room_updated to ALL clients for better state synchronization
  broadcastToAllClients({
    event: 'room_updated',
    payload: { room },
  });

  // Also broadcast updated room list to ALL clients
  broadcastToAllClients({
    event: 'room_list',
    payload: {
      rooms: getRoomList(),
    },
  });

  console.log(
    `Beagle board ${deviceId} joined room ${room.id} as player ${playerName}`
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
      'LEAVE_ROOM',
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
      'LEAVE_ROOM',
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
      'LEAVE_ROOM',
      'ERROR',
      `Player ${board.playerName} not found in room`,
      deviceId,
      rinfo
    );
    return;
  }

  // Remove the player
  room.players.splice(playerIndex, 1);

  // Update Beagle board record
  beagleBoards.set(deviceId, { deviceId });

  // If room is empty, remove it
  if (room.players.length === 0) {
    rooms.delete(roomId);
    console.log(`Room ${roomId} removed as it's now empty`);
  } else {
    // Update room for all clients
    sendToRoom(roomId, 'room_updated', { room });
  }

  // Update room list for all clients
  broadcastToAllClients({
    event: 'room_list',
    payload: {
      rooms: getRoomList(),
    },
  });

  // Send success response to Beagle board
  sendResponseToBeagleBoard(
    'LEAVE_ROOM',
    'SUCCESS',
    `Left room ${roomId}`,
    deviceId,
    rinfo
  );
};

// Function to send a standardized response to a Beagle board
const sendResponseToBeagleBoard = (
  command: string,
  status: string,
  message: string,
  deviceId: string,
  rinfo: dgram.RemoteInfo
) => {
  // Format: RESPONSE:COMMAND_NAME|DeviceID:device_id|status:SUCCESS/ERROR|message:details
  const response = `RESPONSE:${command}|DeviceID:${deviceId}|status:${status}|message:${message}`;

  udpServer.send(response, rinfo.port, rinfo.address, (err) => {
    if (err) {
      console.error(`Error sending response to device ${deviceId}:`, err);
    } else {
      console.log(
        `Sent response to device ${deviceId}: ${status} - ${message}`
      );
    }
  });
};

// Function to extract device ID from a message
const extractDeviceId = (message: string): string | null => {
  const deviceIdMatch = message.match(/DeviceID:([^|]+)/);
  return deviceIdMatch ? deviceIdMatch[1] : null;
};

// Process BeagleBoard commands for web clients
const processBeagleBoardCommandForWebClients = (
  command: string,
  deviceId: string,
  message: string
): void => {
  // For join/leave room commands, broadcast an updated room list
  if (command === 'JOIN_ROOM' || command === 'LEAVE_ROOM') {
    broadcastToAllClients({
      event: 'room_list',
      payload: {
        rooms: getRoomList(),
      },
    });
  }
};

// Handler for UDP messages
udpServer.on('message', (msg, rinfo) => {
  const message = msg.toString();
  console.log(
    `UDP server received: ${message} from ${rinfo.address}:${rinfo.port}`
  );

  // Store client info for this device ID if needed
  const deviceId = extractDeviceId(message);

  try {
    // Check if it's a command from a Beagle board
    const cmdResult = parseBeagleBoardCommand(message);
    if (cmdResult) {
      const { command, deviceId, params } = cmdResult;

      // Add or update client info
      const clientPort = 9091; // Beagle board client listens on port 9091

      // Handle the command
      handleBeagleBoardCommand(command, deviceId, params, {
        address: rinfo.address,
        port: clientPort, // Send responses to port 9091
        family: rinfo.family,
        size: rinfo.size,
      });

      // Broadcast the command to all web clients
      broadcastToAllClients({
        event: 'beagle_board_command',
        payload: {
          message,
          sender: deviceId,
          port: rinfo.port,
          timestamp: Date.now(),
        },
      });

      // Process the command for web clients (ensure room list is updated)
      processBeagleBoardCommandForWebClients(command, deviceId, message);
    }
    // Check if it's a gesture message
    else if (message.startsWith('GESTURE|')) {
      const gestureResult = parseGestureMessage(message);
      if (gestureResult) {
        const { deviceId, roomId, gestureData } = gestureResult;
        handleGestureData(deviceId, roomId, gestureData);
      }
    }
    // Send the message to all web clients
    broadcastToAllClients({
      event: 'udp_message',
      payload: {
        message,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error('Error handling UDP message:', error);
  }
});

udpServer.on('listening', () => {
  const address = udpServer.address();
  console.log(`UDP server listening on ${address.address}:${address.port}`);
});

// Bind UDP server to the specified port
udpServer.bind(UDP_PORT);

// Handle creating a new room
const handleCreateRoom = (
  client: ExtendedWebSocket,
  payload: CreateRoomPayload
) => {
  try {
    const { room } = payload;

    // Validate data
    if (!room) {
      return sendToClient(client, 'error', {
        error: 'Missing required data',
      } as ErrorPayload);
    }

    // Validate room data
    if (!room || !room.id || !room.name) {
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

    // Add room to storage
    rooms.set(newRoom.id, newRoom);

    console.log(`Room created: ${newRoom.id} - ${newRoom.name}`);

    // Notify the client
    sendToClient(client, 'room_updated', { room: newRoom });

    // Update room list for all clients
    broadcastToAllClients({
      event: 'room_list',
      payload: {
        rooms: getRoomList(),
      },
    });
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
    broadcastToAllClients({
      event: 'room_list',
      payload: {
        rooms: getRoomList(),
      },
    });
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
      broadcastToAllClients({
        event: 'room_list',
        payload: {
          rooms: getRoomList(),
        },
      });
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
    broadcastToAllClients({
      event: 'room_list',
      payload: {
        rooms: getRoomList(),
      },
    });
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

// Add a health check endpoint for monitoring
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    connections: {
      websocket: wss.clients.size,
      beagleBoards: beagleBoards.size,
    },
    rooms: rooms.size,
  });
});

// Start the server
const PORT = 8080;
const HOST = '0.0.0.0'; // Listen on all network interfaces by default

server.listen(PORT, HOST, () => {
  console.log(`Server is running on ${HOST}:${PORT}`);
  // Determine protocol based on server type
  const protocol = server === httpServer ? 'ws' : 'wss';
  console.log(`WebSocket server is ready at ${protocol}://${HOST}:${PORT}`);
  console.log(`UDP server is listening on port ${UDP_PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: shutting down...');

  // Close WebSocket server
  wss.close(() => {
    console.log('WebSocket server closed');
  });

  // Close UDP server
  udpServer.close(() => {
    console.log('UDP server closed');
  });

  // Close HTTP server
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });

  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

// Add new function to set BeagleBoard player ready status
const setBeagleBoardReady = (
  deviceId: string,
  roomId: string,
  isReady: boolean,
  rinfo: dgram.RemoteInfo
) => {
  // Check if room exists
  if (!rooms.has(roomId)) {
    sendResponseToBeagleBoard(
      'SET_READY',
      'ERROR',
      `Room ${roomId} not found`,
      deviceId,
      rinfo
    );
    return;
  }

  const room = rooms.get(roomId)!;
  const board = beagleBoards.get(deviceId)!;

  // Find the player in the room
  const player = room.players.find((p) => p.name === board.playerName);

  if (!player) {
    sendResponseToBeagleBoard(
      'SET_READY',
      'ERROR',
      `Player ${board.playerName} not found in room`,
      deviceId,
      rinfo
    );
    return;
  }

  // Update player ready status
  player.isReady = isReady;

  // Send success response to BeagleBoard
  sendResponseToBeagleBoard(
    'SET_READY',
    'SUCCESS',
    `Player is now ${isReady ? 'ready' : 'not ready'}`,
    deviceId,
    rinfo
  );

  // Notify all clients about the room update
  sendToRoom(roomId, 'room_updated', { room });

  // Also broadcast room_updated to ALL clients for better state synchronization
  broadcastToAllClients({
    event: 'room_updated',
    payload: { room },
  });

  console.log(
    `Beagle board ${deviceId} (${board.playerName}) in room ${roomId} is now ${
      isReady ? 'ready' : 'not ready'
    }`
  );
};
