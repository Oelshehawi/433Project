import http from "http";
import express from "express";
import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";
import dgram from "dgram";
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
} from "./types";

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store active rooms
const rooms: Map<string, Room> = new Map();

// Create UDP server
const udpServer = dgram.createSocket("udp4");
const UDP_PORT = 9090;

// Initialize UDP server
udpServer.on("error", (err) => {
  console.error(`UDP server error:\n${err.stack}`);
  udpServer.close();
});

udpServer.on("message", (msg, rinfo) => {
  const message = msg.toString();
  console.log(
    `UDP server received message: ${message} from ${rinfo.address}:${rinfo.port}`
  );

  // Create a payload with the UDP message
  const payload: UdpMessagePayload = {
    message,
    timestamp: Date.now(),
  };

  // Broadcast the UDP message to all connected WebSocket clients
  broadcastToAllClients({
    event: "udp_message",
    payload,
  });
});

udpServer.on("listening", () => {
  const address = udpServer.address();
  console.log(`UDP server listening on ${address.address}:${address.port}`);
});

// Bind UDP server to the specified port
udpServer.bind(UDP_PORT);

// Helper function to broadcast to all clients
function broadcastToAllClients(message: WebSocketMessage) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

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
      return sendToClient(client, "error", {
        error: "Missing required data",
      } as ErrorPayload);
    }

    // Store the room ID and player ID in the client object
    client.roomId = room.id;
    client.playerId = playerId;
    client.playerName = room.players[0].name;

    // Validate room data
    if (!room || !room.id || !room.name || !playerId) {
      return sendToClient(client, "error", {
        error: "Invalid room data",
      } as ErrorPayload);
    }

    // Check if room already exists
    if (rooms.has(room.id)) {
      return sendToClient(client, "error", {
        error: "Room already exists",
      } as ErrorPayload);
    }

    // Create the room
    const newRoom: Room = {
      ...room,
      createdAt: Date.now(),
      status: "waiting",
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
    sendToClient(client, "room_updated", { room: newRoom });

    // Update room list for all clients
    broadcastToAll("room_list", { rooms: getRoomList() });
  } catch (error) {
    console.error("Error creating room:", error);
    sendToClient(client, "error", {
      error: "Failed to create room",
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
      return sendToClient(client, "error", {
        error: "Missing required data",
      } as ErrorPayload);
    }

    // Store the room ID and player ID in the client object
    client.roomId = roomId;
    client.playerId = playerId;
    client.playerName = playerName;

    // Check if room exists
    if (!rooms.has(roomId)) {
      return sendToClient(client, "error", {
        error: "Room not found",
      } as ErrorPayload);
    }

    const room = rooms.get(roomId)!;

    // Check if room is full
    if (room.players.length >= room.maxPlayers) {
      return sendToClient(client, "error", {
        error: "Room is full",
      } as ErrorPayload);
    }

    // Check if room is already playing
    if (room.status === "playing") {
      return sendToClient(client, "error", {
        error: "Game is already in progress",
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
    sendToRoom(roomId, "room_updated", { room });

    // Update room list for all clients
    broadcastToAll("room_list", { rooms: getRoomList() });
  } catch (error) {
    console.error("Error joining room:", error);
    sendToClient(client, "error", {
      error: "Failed to join room",
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
      return sendToClient(client, "error", {
        error: "Missing room ID",
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
        sendToRoom(roomId, "room_updated", { room });
      }

      // Update room list for all clients
      broadcastToAll("room_list", { rooms: getRoomList() });
    }
  } catch (error) {
    console.error("Error leaving room:", error);
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
      console.error("Missing roomId or playerId in player ready event", {
        payloadRoomId: roomId,
        payloadPlayerId: playerId,
        clientRoomId: client.roomId,
        clientPlayerId: client.playerId,
      });
      return sendToClient(client, "error", {
        error: "Missing required data",
      } as ErrorPayload);
    }

    // Check if room exists
    if (!rooms.has(effectiveRoomId)) {
      console.error(`Room not found: ${effectiveRoomId}`);
      return sendToClient(client, "error", {
        error: "Room not found",
      } as ErrorPayload);
    }

    const room = rooms.get(effectiveRoomId)!;

    // Find player in room
    const player = room.players.find((p) => p.id === effectivePlayerId);

    if (!player) {
      console.error(
        `Player ${effectivePlayerId} not found in room ${effectiveRoomId}`
      );
      return sendToClient(client, "error", {
        error: "Player not found in room",
      } as ErrorPayload);
    }

    // Update player ready status
    player.isReady = isReady;

    // Send room updated event to all clients in the room
    sendToRoom(effectiveRoomId, "room_updated", { room });

    console.log(
      `Player ${player.name} (${effectivePlayerId}) in room ${
        room.name
      } (${effectiveRoomId}) is now ${isReady ? "ready" : "not ready"}`
    );
  } catch (error) {
    console.error("Error handling player ready:", error);
    sendToClient(client, "error", {
      error: "Internal server error",
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
      return sendToClient(client, "error", {
        error: "Missing room ID",
      } as ErrorPayload);
    }

    // Check if room exists
    if (!rooms.has(roomId)) {
      return sendToClient(client, "error", {
        error: "Room not found",
      } as ErrorPayload);
    }

    const room = rooms.get(roomId)!;

    // Check if all players are ready
    const allPlayersReady = room.players.every((player) => player.isReady);

    if (!allPlayersReady) {
      return sendToClient(client, "error", {
        error: "Not all players are ready",
      } as ErrorPayload);
    }

    // Check if client is the host
    if (client.playerId !== room.hostId) {
      return sendToClient(client, "error", {
        error: "Only the host can start the game",
      } as ErrorPayload);
    }

    // Update room status
    room.status = "playing";

    console.log(`Game started in room ${room.name} (${roomId})`);

    // Notify all clients in the room
    sendToRoom(roomId, "room_updated", { room });
    sendToRoom(roomId, "game_started", { roomId });

    // Update room list for all clients
    broadcastToAll("room_list", { rooms: getRoomList() });
  } catch (error) {
    console.error("Error starting game:", error);
    sendToClient(client, "error", {
      error: "Failed to start game",
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
    if (!rooms.has(roomId) || rooms.get(roomId)!.status !== "playing") {
      return;
    }

    console.log(
      `Gesture event: ${gesture} from player ${playerId} (conf: ${confidence})`
    );

    // Broadcast gesture event to all players in the room
    sendToRoom(roomId, "gesture_event", { playerId, gesture, confidence });
  } catch (error) {
    console.error("Error handling gesture event:", error);
  }
};

// Send room list to a client
const handleRoomList = (client: ExtendedWebSocket) => {
  sendToClient(client, "room_list", { rooms: getRoomList() });
};

// Handle incoming messages
const handleMessage = (
  client: ExtendedWebSocket,
  message: WebSocketMessage
) => {
  const { event, payload } = message;

  console.log(`Received event: ${event}`);

  switch (event as ClientEventType) {
    case "create_room":
      handleCreateRoom(client, payload);
      break;
    case "join_room":
      handleJoinRoom(client, payload);
      break;
    case "leave_room":
      handleLeaveRoom(client, payload);
      break;
    case "player_ready":
      handlePlayerReady(client, payload);
      break;
    case "game_started":
      handleGameStart(client, payload);
      break;
    case "gesture_event":
      handleGestureEvent(client, payload);
      break;
    case "room_list":
      handleRoomList(client);
      break;
    default:
      console.warn(`Unknown event type: ${event}`);
      break;
  }
};

// Set up WebSocket connection handler
wss.on("connection", (ws: WebSocket) => {
  // Create extended client with custom properties
  const client = ws as ExtendedWebSocket;
  client.id = uuidv4();
  client.isAlive = true;

  // Add client to clients map
  clients.set(client.id, client);

  console.log(`Client connected: ${client.id}`);

  // Set up ping/pong for connection health check
  client.on("pong", () => {
    client.isAlive = true;
  });

  // Handle incoming messages
  client.on("message", (data: WebSocket.Data) => {
    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage;
      handleMessage(client, message);
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  });

  // Handle client disconnection
  client.on("close", () => {
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
wss.on("close", () => {
  clearInterval(interval);
});

// Add a basic route for health check
app.get("/", (req, res) => {
  res.send("Gesture Tower WebSocket Server is running");
});

// Start the server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`WebSocket server is ready at ws://localhost:${PORT}`);
});
