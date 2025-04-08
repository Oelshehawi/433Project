// Single source of truth for WebSocket connection
let socket: WebSocket | null = null;
let socketStatus: "disconnected" | "connecting" | "connected" = "disconnected";
let pingInterval: NodeJS.Timeout | null = null; // Track ping interval
let lastPongTime: number = 0; // Track last pong received

// Initialize WebSocket connection
export const initializeSocket = (
  url: string = "wss://four33project.onrender.com"
): WebSocket | null => {
  // Use existing socket if connected or connecting
  if (
    socket &&
    (socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING)
  ) {
    console.log(
      "[websocket.ts] WebSocket already initialized and in state:",
      socket.readyState === WebSocket.OPEN ? "OPEN" : "CONNECTING"
    );
    return socket;
  }

  // Set status to connecting
  socketStatus = "connecting";

  // Don't create multiple connections
  if (socketStatus === "connecting" && socket) {
    console.log("[websocket.ts] WebSocket connection already in progress");
    return socket;
  }

  try {
    console.log("[websocket.ts] Initializing WebSocket connection to", url);

    // Create WebSocket connection
    socket = new WebSocket(url);

    // Handle connection open
    socket.onopen = () => {
      console.log("[websocket.ts] WebSocket connection established");
      socketStatus = "connected";
      lastPongTime = Date.now(); // Initialize pong time

      // Start ping interval to keep connection alive
      startPingInterval();

      // Dispatch a custom event that components can listen for
      window.dispatchEvent(new CustomEvent("ws_connected"));

      // If we have saved room info, immediately request room data
      const savedInfo = getSavedRoomInfo();
      if (savedInfo.roomId) {
        console.log(
          "[websocket.ts] Found saved room info, requesting room data:",
          savedInfo.roomId
        );
        sendMessage("get_room", { roomId: savedInfo.roomId });
      }
    };

    socket.onclose = (event) => {
      console.log(
        `[websocket.ts] WebSocket connection closed: Code ${event.code}${
          event.reason ? " - " + event.reason : ""
        }`
      );
      socket = null;
      socketStatus = "disconnected";
      stopPingInterval();

      // Auto reconnect if it wasn't intentionally closed
      if (event.code !== 1000) {
        console.log("[websocket.ts] Attempting to reconnect in 2 seconds...");
        setTimeout(() => initializeSocket(url), 2000);
      }
    };

    socket.onerror = (error) => {
      console.error("[websocket.ts] WebSocket connection error:", error);
      socketStatus = "disconnected";
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle pong messages separately
        if (data.event === "pong") {
          lastPongTime = Date.now();
          return;
        }

        console.log("[websocket.ts] WebSocket message received:", data);

        // Special handling for game_starting to make it more visible in logs
        if (data.event === "game_starting") {
          console.log(
            "[websocket.ts] 🎮 GAME STARTING EVENT RECEIVED:",
            data.payload
          );
        }

        // Create a simple custom event with the data
        const customEvent = new CustomEvent(data.event, {
          detail: data.payload,
          bubbles: true,
        });

        // Dispatch a single event - all components can listen for specific event types
        window.dispatchEvent(customEvent);
      } catch (error) {
        console.error(
          "[websocket.ts] Error processing WebSocket message:",
          error,
          event.data
        );
      }
    };

    return socket;
  } catch (error) {
    console.error("[websocket.ts] Failed to initialize WebSocket:", error);
    socketStatus = "disconnected";
    socket = null;
    return null;
  }
};

// Start regular ping interval to keep connection alive
const startPingInterval = () => {
  // Clear any existing interval first
  stopPingInterval();

  // Send ping every 30 seconds
  pingInterval = setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      console.log("[websocket.ts] Sending ping to server");
      sendMessage("ping", { timestamp: Date.now() }).catch((err) => {
        console.error("[websocket.ts] Error sending ping:", err);
      });

      // Check if we've received a pong in the last 45 seconds
      const now = Date.now();
      if (now - lastPongTime > 45000) {
        console.warn(
          "[websocket.ts] No pong received in 45 seconds, reconnecting"
        );
        closeSocket();
        initializeSocket();
      }
    }
  }, 30000);
};

// Stop ping interval
const stopPingInterval = () => {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
};

// Function to clear room data from localStorage
export const clearRoomData = (): void => {
  localStorage.removeItem("currentRoomId");
  localStorage.removeItem("currentPlayerId");
  localStorage.removeItem("currentPlayerName");
  console.log("[websocket.ts] Cleared room data from localStorage");
};

// Get saved room info from localStorage
export const getSavedRoomInfo = () => {
  if (typeof window === "undefined")
    return { roomId: null, playerId: null, playerName: null };
  return {
    roomId: localStorage.getItem("currentRoomId"),
    playerId: localStorage.getItem("currentPlayerId"),
    playerName: localStorage.getItem("currentPlayerName"),
  };
};

// Save room info to localStorage
export const saveRoomInfo = (
  roomId: string,
  playerId: string,
  playerName: string
): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem("currentRoomId", roomId);
  localStorage.setItem("currentPlayerId", playerId);
  localStorage.setItem("currentPlayerName", playerName);
  console.log("Saved room info to localStorage:", {
    roomId,
    playerId,
    playerName,
  });
};

// Simple send message function
export const sendMessage = <T>(type: string, payload: T): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Initialize if needed
    if (!socket) {
      socket = initializeSocket();
    }

    if (!socket) {
      reject(new Error("Could not initialize WebSocket connection"));
      return;
    }

    if (socket.readyState !== WebSocket.OPEN) {
      reject(
        new Error(
          `WebSocket not ready (${getReadyStateLabel(socket.readyState)})`
        )
      );
      return;
    }

    try {
      const message = { event: type, payload };
      console.log("Sending WebSocket message:", message);
      socket.send(JSON.stringify(message));
      resolve();
    } catch (error) {
      console.error("Error sending message:", error);
      reject(error);
    }
  });
};

// A simplified version of sendMessage that doesn't return a Promise
export const sendWebSocketMessage = (message: {
  event: string;
  payload: any;
}): void => {
  try {
    sendMessage(message.event, message.payload).catch((error) => {
      console.error("Error sending WebSocket message:", error);
    });
  } catch (error) {
    console.error("Error in sendWebSocketMessage:", error);
  }
};

// Get WebSocket connection status
export const getSocketStatus = () => socketStatus;

// Close WebSocket connection
export const closeSocket = (): void => {
  if (socket) {
    console.log("[websocket.ts] Closing WebSocket connection");
    stopPingInterval();
    socket.close();
    socket = null;
  }
};

// Close WebSocket and clear data
export const closeSocketAndClearData = (): void => {
  closeSocket();
  clearRoomData();
};

// Helper to get readable WebSocket state
const getReadyStateLabel = (readyState: number): string => {
  switch (readyState) {
    case WebSocket.CONNECTING:
      return "CONNECTING";
    case WebSocket.OPEN:
      return "OPEN";
    case WebSocket.CLOSING:
      return "CLOSING";
    case WebSocket.CLOSED:
      return "CLOSED";
    default:
      return `UNKNOWN (${readyState})`;
  }
};

// Utility function to signal client is ready for the next round
export const signalNextRoundReady = (
  roomId: string,
  roundNumber: number
): void => {
  console.log(
    `[websocket.ts] Signaling server that web client is ready for round ${roundNumber}`
  );

  try {
    sendMessage("next_round_ready", { roomId, roundNumber }).catch((error) => {
      console.error(
        "[websocket.ts] Error sending next_round_ready signal:",
        error
      );
    });
  } catch (error) {
    console.error(
      "[websocket.ts] Exception sending next_round_ready signal:",
      error
    );
  }
};
