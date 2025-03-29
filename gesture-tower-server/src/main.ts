import http from "http";
import express from "express";
import WebSocket from "ws";
import cors from "cors";
import { initializeWebSocketServer } from "./webSocketManager";
import { rooms } from "./roomManager";
import { beagleBoards } from "./messaging";

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

// Initialize WebSocket server
initializeWebSocketServer(wss);

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

// Start the server
const PORT = parseInt(process.env.PORT || "8080", 10);
const HOST = "0.0.0.0"; // Listen on all network interfaces by default

server.listen(PORT, HOST, () => {
  console.log(`Server is running on ${HOST}:${PORT}`);
  console.log(`WebSocket server is ready at ws://${HOST}:${PORT}`);
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: shutting down...");

  // Close WebSocket server
  wss.close(() => {
    console.log("WebSocket server closed");
  });

  // Close HTTP server
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });

  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
});
