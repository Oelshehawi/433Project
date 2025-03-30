import {
  GestureType,
  RoomUpdatedPayload,
  RoomListPayload,
  GameStartedPayload,
  PlayerReadyPayload,
  GestureEventPayload,
  ErrorPayload,
  BeagleBoardCommandPayload,
} from "./types/index";

// Single source of truth for WebSocket connection
let socket: WebSocket | null = null;
let socketStatus: "disconnected" | "connecting" | "connected" = "disconnected";

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
      "WebSocket already initialized and in state:",
      socket.readyState === WebSocket.OPEN ? "OPEN" : "CONNECTING"
    );
    return socket;
  }

  // Set status to connecting
  socketStatus = "connecting";

  // Don't create multiple connections
  if (socketStatus === "connecting" && socket) {
    console.log("WebSocket connection already in progress");
    return socket;
  }

  try {
    console.log("Initializing WebSocket connection to", url);

    // Create WebSocket connection
    socket = new WebSocket(url);

    // Handle connection open
    socket.onopen = () => {
      console.log("WebSocket connection established");
      socketStatus = "connected";

      // Dispatch a custom event that components can listen for
      window.dispatchEvent(new CustomEvent("ws_connected"));

      // If we have saved room info, immediately request room data
      const savedInfo = getSavedRoomInfo();
      if (savedInfo.roomId) {
        console.log(
          "Found saved room info, requesting room data:",
          savedInfo.roomId
        );
        sendMessage("get_room", { roomId: savedInfo.roomId });
      }
    };

    socket.onclose = (event) => {
      console.log(
        `WebSocket connection closed: Code ${event.code}${
          event.reason ? " - " + event.reason : ""
        }`
      );
      socket = null;
      socketStatus = "disconnected";

      // Auto reconnect if it wasn't intentionally closed
      if (event.code !== 1000) {
        console.log("Attempting to reconnect in 2 seconds...");
        setTimeout(() => initializeSocket(url), 2000);
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket connection error:", error);
      socketStatus = "disconnected";
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("WebSocket message received:", data);

        // Create a simple custom event with the data
        const customEvent = new CustomEvent(data.event, {
          detail: data.payload,
          bubbles: true,
        });

        // Dispatch a single event - all components can listen for specific event types
        window.dispatchEvent(customEvent);
      } catch (error) {
        console.error("Error processing WebSocket message:", error, event.data);
      }
    };

    return socket;
  } catch (error) {
    console.error("Failed to initialize WebSocket:", error);
    socketStatus = "disconnected";
    socket = null;
    return null;
  }
};

// Function to clear room data from localStorage
export const clearRoomData = (): void => {
  localStorage.removeItem("currentRoomId");
  localStorage.removeItem("currentPlayerId");
  localStorage.removeItem("currentPlayerName");
  console.log("Cleared room data from localStorage");
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

// When socket reconnects, attempt to rejoin room
const rejoinRoomAfterConnect = (): void => {
  const { roomId, playerId, playerName } = getSavedRoomInfo();

  if (roomId && playerId && playerName) {
    console.log("Attempting to rejoin room after reconnection:", {
      roomId,
      playerId,
      playerName,
    });

    // Emit join room message
    sendMessage("join_room", {
      roomId,
      playerId,
      playerName,
      playerType: "webviewer",
    }).catch((err) => console.error("Failed to rejoin room:", err));
  }
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

// Get WebSocket connection status
export const getSocketStatus = () => socketStatus;

// Close WebSocket connection
export const closeSocket = (): void => {
  if (socket) {
    console.log("Closing WebSocket connection");
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
