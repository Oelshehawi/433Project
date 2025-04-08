import WebSocket from "ws";
import express from "express";
import { createServer } from "http";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";
import { ExtendedWebSocket, WebSocketMessage, ServerEventType } from "./types";
import {
  handleCreateRoom,
  handleJoinRoom,
  handleLeaveRoom,
  handlePlayerReady,
  handleRoomList,
  handleGetRoom,
  handleGameStart,
  handleGestureEvent,
} from "./roomManager";
import { clients, beagleBoards } from "./messaging";
import {
  setupPingHandler,
  setPingTimeout,
  resetPingTimeoutOnMessage,
} from "./webSocketManager";

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// HTTP server
const server = createServer(app);

// WebSocket server
const wss = new WebSocket.Server({ server });

// Broadcast to all clients
export const broadcastToAllClients = (message: WebSocketMessage) => {
  const messageStr = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
};

// Handle WebSocket connections
wss.on("connection", (ws: WebSocket) => {
  const clientId = uuidv4();
  console.log(`Client connected: ${clientId}`);

  // Cast to our extended type
  const client = ws as ExtendedWebSocket;
  client.id = clientId;
  client.isAlive = true;

  // Store client in the map
  clients.set(clientId, client);

  // Set up ping handler for this client
  setupPingHandler(client);

  // Initialize ping timeout for this client
  setPingTimeout(client);

  // Handle messages
  client.on("message", (message: WebSocket.Data) => {
    try {
      const data = JSON.parse(message.toString());
      console.log(`Received event: ${data.event}`);
      console.log(`Payload for ${data.event}:`, JSON.stringify(data.payload));

      // Reset ping timeout when any message is received
      resetPingTimeoutOnMessage(client);

      // Route to appropriate handler based on event type
      switch (data.event) {
        case "create_room":
          console.log("Processing create_room event");
          handleCreateRoom(client, data.payload);
          break;
        case "join_room":
          handleJoinRoom(client, data.payload);
          break;
        case "leave_room":
          handleLeaveRoom(client, data.payload);
          break;
        case "player_ready":
          handlePlayerReady(client, data.payload);
          break;
        case "game_start":
          handleGameStart(client, data.payload);
          break;
        case "gesture_event":
          handleGestureEvent(client, data.payload);
          break;
        case "room_list":
          handleRoomList(client);
          break;
        case "get_room":
          handleGetRoom(client, data.payload);
          break;
        case "ping":
          // Handle ping explicitly here as well as in setupPingHandler
          client.send(JSON.stringify({ event: "pong", timestamp: Date.now() }));
          break;
        default:
          console.log(`Unknown event type: ${data.event}`);
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  });

  // Handle disconnection
  client.on("close", () => {
    console.log(`Client disconnected: ${clientId}`);

    // Clear ping timeout
    if (client.pingTimeout) {
      clearTimeout(client.pingTimeout);
    }

    // Clean up
    clients.delete(clientId);
    beagleBoards.delete(clientId);

    // If client was in a room, leave it
    if (client.roomId) {
      handleLeaveRoom(client, {
        roomId: client.roomId,
        playerId: client.playerId,
      });
    }
  });

  // Send initial room list
  handleRoomList(client);
});

// REST API routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`==> Your service is live 🎉`);
});
