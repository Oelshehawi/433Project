import { server, wss } from "./server";

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
