import http from "http";
import express from "express";
import WebSocket from "ws";
import cors from "cors";
import { WebSocketMessage } from "./types";
import { initializeWebSocketServer } from "./webSocketManager";
import { beagleBoards } from "./messaging";
import { rooms, getRoomList } from "./roomManager";

// Initialize Express app
const app = express();

// Enable CORS for Vercel frontend
app.use(
  cors({
    origin: "https://433-project.vercel.app",
    methods: ["GET", "POST"],
    credentials: true,
  })
);

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Initialize WebSocket handler with the server
initializeWebSocketServer(wss);

// Helper function to broadcast to all clients
export function broadcastToAllClients(message: WebSocketMessage) {
  // Use the same method as broadcastToAll to ensure consistent formatting
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// Add a basic route for health check
app.get("/", (req, res) => {
  res.send("Gesture Tower WebSocket Server is running");
});

// Add a health check endpoint for monitoring
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "UP",
    timestamp: new Date().toISOString(),
    connections: {
      websocket: wss.clients.size,
      beagleBoards: beagleBoards.size,
    },
    rooms: rooms.size,
  });
});

// Export server, app, and wss for external use
export { server, app, wss };
