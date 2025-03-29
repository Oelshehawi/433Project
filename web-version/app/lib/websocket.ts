import {
  GestureType,
  RoomUpdatedPayload,
  RoomListPayload,
  GameStartedPayload,
  PlayerReadyPayload,
  GestureEventPayload,
  ErrorPayload,
  UdpMessagePayload,
  BeagleBoardCommandPayload,
} from "./types/index";

// Function to clear any room data from localStorage
export const clearRoomData = (): void => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("currentRoomId");
    localStorage.removeItem("currentPlayerId");
    localStorage.removeItem("currentPlayerName");
    console.log("Cleared room data from localStorage");
  }
};

// Ensure the WebSocket global is declared
declare global {
  interface Window {
    _socket: WebSocket | null;
    _isConnecting: boolean;
  }
}

// Initialize WebSocket connection
export const initializeSocket = (
  url: string = "wss://four33project.onrender.com"
): WebSocket | null => {
  // Check if we're in a browser environment
  if (typeof window === "undefined") {
    console.log(
      "WebSocket initialization skipped - not in browser environment"
    );
    return null;
  }

  // Initialize globals if necessary
  window._socket = window._socket || null;
  window._isConnecting = window._isConnecting || false;

  // Use existing socket if connected
  if (window._socket && window._socket.readyState === WebSocket.OPEN) {
    console.log("Using existing open WebSocket connection");
    return window._socket;
  }

  // Use existing socket if connecting
  if (window._isConnecting) {
    console.log("WebSocket connection already in progress");
    return window._socket;
  }

  window._isConnecting = true;
  console.log("Creating new WebSocket connection to:", url);

  try {
    const socket = new WebSocket(url);

    // Store socket reference immediately to prevent multiple connections
    window._socket = socket;

    socket.onopen = () => {
      console.log("WebSocket connection established");
      window._isConnecting = false;

      // Attempt to rejoin room if we have saved info
      rejoinRoomAfterConnect();
    };

    socket.onclose = (event) => {
      console.log(
        `WebSocket connection closed: Code ${event.code}${
          event.reason ? " - " + event.reason : ""
        }`
      );

      // Only clear socket reference if it's the same socket that was closed
      if (window._socket === socket) {
        window._socket = null;
      }

      window._isConnecting = false;

      // Auto reconnect if it wasn't intentionally closed
      if (event.code !== 1000) {
        console.log("Attempting to reconnect in 2 seconds...");
        setTimeout(() => {
          initializeSocket(url);
        }, 2000);
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket connection error:", error);
      // Don't clear socket reference here, let onclose handle it
      window._isConnecting = false;
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("WebSocket message received:", data);

        try {
          // Handle different event types - Updated to use event instead of type
          if (data.event === "room_updated") {
            handleRoomUpdated(data.payload);
            // Dispatch a custom event to notify components about a room update
            dispatchCustomEvent("manual_room_update", data.payload);
          } else if (data.event === "room_list") {
            handleRoomList(data.payload);
          } else if (data.event === "player_ready") {
            handlePlayerReady(data.payload);
          } else if (data.event === "game_started") {
            handleGameStarted(data.payload);
          } else if (data.event === "error") {
            handleError(data.payload);
          } else if (data.event === "gesture_event") {
            handleGestureEvent(data.payload);
          } else if (data.event === "udp_message") {
            handleUdpMessage(data.payload as UdpMessagePayload);
          } else if (data.event === "beagle_board_command") {
            handleBeagleBoardCommand(data.payload as BeagleBoardCommandPayload);
          } else {
            console.warn("Unhandled WebSocket message event:", data.event);
          }
        } catch (handlerError) {
          console.error(
            "Error in WebSocket message handler:",
            handlerError,
            "for event:",
            data.event
          );
        }
      } catch (parseError) {
        console.error(
          "Error parsing WebSocket message:",
          parseError,
          event.data
        );
      }
    };

    return socket;
  } catch (error) {
    console.error("Error creating WebSocket connection:", error);
    window._isConnecting = false;
    window._socket = null;
    return null;
  }
};

// When socket reconnects, attempt to rejoin room
const rejoinRoomAfterConnect = (): void => {
  if (typeof window === "undefined") return;

  // Get saved room info
  const roomId = localStorage.getItem("currentRoomId");
  const playerId = localStorage.getItem("currentPlayerId");
  const playerName = localStorage.getItem("currentPlayerName");

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
      playerType: "webadmin",
    }).catch((err) => {
      console.error("Failed to rejoin room:", err);
    });
  }
};

// Get saved room info from localStorage
export const getSavedRoomInfo = () => {
  if (typeof window === "undefined") {
    return { roomId: null, playerId: null, playerName: null };
  }

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

// Send a message to the server with retry logic
export const sendMessage = <T>(
  type: string,
  payload: T,
  maxRetries = 2,
  delay = 500
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const attemptSend = (retriesLeft: number) => {
      // Make sure we have a socket
      if (!window?._socket) {
        // Try to initialize
        console.log("No socket available, attempting to initialize...");
        const socket = initializeSocket();

        if (!socket && retriesLeft > 0) {
          console.log(`Retrying in ${delay}ms (${retriesLeft} retries left)`);
          setTimeout(() => attemptSend(retriesLeft - 1), delay);
          return;
        }

        if (!socket) {
          const errorMsg = "Could not initialize WebSocket connection";
          console.error(errorMsg);
          reject(new Error(errorMsg));
          return;
        }
      }

      // Check if socket is ready to send messages
      // We already confirmed socket exists in the previous check
      const socket = window._socket!;

      if (socket.readyState !== WebSocket.OPEN) {
        const state = getReadyStateLabel(socket.readyState);
        console.log(`WebSocket not ready (${state}), waiting...`);

        if (retriesLeft > 0) {
          console.log(`Retrying in ${delay}ms (${retriesLeft} retries left)`);
          setTimeout(() => attemptSend(retriesLeft - 1), delay);
          return;
        }

        const errorMsg = `WebSocket is not in OPEN state (current state: ${state})`;
        console.error(errorMsg);
        reject(new Error(errorMsg));
        return;
      }

      try {
        // Use event instead of type to match server expectation
        const message = { event: type, payload };
        console.log("Sending WebSocket message:", message);
        socket.send(JSON.stringify(message));
        resolve();
      } catch (error) {
        console.error("Error sending WebSocket message:", error);

        if (retriesLeft > 0) {
          console.log(`Retrying in ${delay}ms (${retriesLeft} retries left)`);
          setTimeout(() => attemptSend(retriesLeft - 1), delay);
        } else {
          reject(error);
        }
      }
    };

    // Start with initial attempt
    attemptSend(maxRetries);
  });
};

// Helper function to get readable WebSocket ready state
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

// Get WebSocket connection status
export const getSocketStatus = ():
  | "connected"
  | "connecting"
  | "disconnected" => {
  if (window?._socket && window._socket.readyState === WebSocket.OPEN) {
    return "connected";
  } else if (window?._isConnecting) {
    return "connecting";
  } else {
    return "disconnected";
  }
};

// Close WebSocket connection
export const closeSocket = (): void => {
  if (typeof window === "undefined") return;

  if (window._socket) {
    console.log("Closing WebSocket connection");
    window._socket.close();
    window._socket = null;
  }
};

// Close WebSocket connection and clear data
export const closeSocketAndClearData = (): void => {
  closeSocket();
  clearRoomData();
};

// Event handlers
const handleRoomUpdated = (payload: RoomUpdatedPayload): void => {
  console.log("Handling room_updated event:", payload);
  const { room } = payload;

  // Additional detailed logging
  console.log("Room data received:", JSON.stringify(room, null, 2));
  console.log("Room players:", room.players);

  // If we have room info saved, check if this is our room
  const savedRoomInfo = getSavedRoomInfo();
  if (savedRoomInfo.roomId && savedRoomInfo.playerId) {
    console.log("Saved room info:", savedRoomInfo);

    if (room.id === savedRoomInfo.roomId) {
      console.log("This is an update for our current room!");

      // Check if our player is still in the room
      const ourPlayer = room.players.find(
        (p) => p.id === savedRoomInfo.playerId
      );
      if (ourPlayer) {
        console.log("Our player is in the room:", ourPlayer);
      } else {
        console.warn("Our player is no longer in the room!");
      }
    }
  }

  // Dispatch to room store
  const roomUpdatedEvent = new CustomEvent("room_updated", {
    detail: { room },
  });
  window.dispatchEvent(roomUpdatedEvent);
  console.log("Dispatched room_updated event to window");
};

const handleRoomList = (payload: RoomListPayload): void => {
  console.log("Handling room_list event:", payload);

  try {
    // Make sure payload and rooms exist
    if (!payload || !payload.rooms) {
      console.warn("Invalid room_list payload received:", payload);
      return;
    }

    const { rooms } = payload;

    // Dispatch to room store
    const roomListEvent = new CustomEvent("room_list", {
      detail: { rooms },
    });
    window.dispatchEvent(roomListEvent);
  } catch (error) {
    console.error("Error handling room_list event:", error);
  }
};

const handlePlayerReady = (payload: PlayerReadyPayload): void => {
  console.log("Handling player_ready event:", payload);
  const { roomId, playerId, isReady } = payload;

  // Dispatch to room store
  const playerReadyEvent = new CustomEvent("player_ready", {
    detail: { roomId, playerId, isReady },
  });
  window.dispatchEvent(playerReadyEvent);
};

const handleGameStarted = (payload: GameStartedPayload): void => {
  console.log("Handling game_started event:", payload);
  const { roomId } = payload;

  // Dispatch to room store
  const gameStartedEvent = new CustomEvent("game_started", {
    detail: { roomId },
  });
  window.dispatchEvent(gameStartedEvent);
};

const handleError = (payload: ErrorPayload): void => {
  console.error("WebSocket server error:", payload);
  const { error, code, details } = payload;

  // Dispatch to error handler
  const errorEvent = new CustomEvent("ws_error", {
    detail: { error, code, details },
  });
  window.dispatchEvent(errorEvent);
};

const handleGestureEvent = (payload: GestureEventPayload): void => {
  console.log("Handling gesture_event:", payload);
  const { playerId, gesture, confidence } = payload;

  // Dispatch to gesture handler
  const gestureEvent = new CustomEvent("gesture_event", {
    detail: { playerId, gesture: gesture as GestureType, confidence },
  });
  window.dispatchEvent(gestureEvent);
};

// Add this function to handle UDP messages
const handleUdpMessage = (payload: UdpMessagePayload): void => {
  console.log("Handling udp_message:", payload);
  const { message, timestamp } = payload;

  // Dispatch UDP message event
  const udpEvent = new CustomEvent("udp_message", {
    detail: { message, timestamp },
  });
  window.dispatchEvent(udpEvent);
};

// Handle BeagleBoard command events
const handleBeagleBoardCommand = (payload: BeagleBoardCommandPayload): void => {
  console.log("Handling beagle_board_command:", payload);
  const { message, sender, timestamp } = payload || {};

  // Create a BeagleBoard command event
  const beagleBoardEvent = new CustomEvent("beagle_board_command", {
    detail: { message, sender, timestamp },
  });
  window.dispatchEvent(beagleBoardEvent);
};

// Utility function to log connection details for debugging
export const logConnectionDetails = (): void => {
  if (typeof window === "undefined") {
    console.log("Cannot log connection details - not in browser environment");
    return;
  }

  console.log("WebSocket connection details:");
  console.log(`Socket exists: ${window._socket !== null}`);

  if (window._socket) {
    console.log(
      `Ready state: ${getReadyStateLabel(window._socket.readyState)}`
    );
    console.log(`Is connecting flag: ${window._isConnecting}`);
  } else {
    console.log("No socket instance available");
  }

  const savedInfo = getSavedRoomInfo();
  console.log("Saved room info:", savedInfo);
};

// Helper to dispatch custom events
const dispatchCustomEvent = (eventName: string, detail: any): void => {
  if (typeof window !== "undefined") {
    const event = new CustomEvent(eventName, { detail });
    window.dispatchEvent(event);
    console.log(`Dispatched custom event: ${eventName}`, detail);
  }
};
