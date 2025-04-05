import WebSocket from "ws";
import { ExtendedWebSocket, WebSocketMessage, ServerEventType } from "./types";
import { v4 as uuidv4 } from "uuid";
import {
  handleCreateRoom,
  handleJoinRoom,
  handleLeaveRoom,
  handlePlayerReady,
  handleGameStart,
  handleGestureEvent,
  handleRoomList,
  handleGetRoom,
  getRoomList,
  rooms,
} from "./roomManager";
import { clients, beagleBoards, broadcastToAll, sendToRoom } from "./messaging";

// Functions for handling BeagleBoard commands via WebSocket
import { Player, Room } from "./types";

// Initialize WebSocket server
export function initializeWebSocketServer(wss: WebSocket.Server) {
  // Setup WebSocket connection handlers
  wss.on("connection", (ws: WebSocket) => {
    setupNewClientConnection(ws as ExtendedWebSocket);
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

  return wss;
}

// Set up a new client connection
function setupNewClientConnection(client: ExtendedWebSocket) {
  // Initialize client properties
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
      // Try to parse as BeagleBoard command format
      try {
        const messageStr = data.toString();
        if (messageStr.startsWith("CMD:")) {
          handleBeagleBoardCommand(client, messageStr);
        } else if (messageStr.startsWith("GESTURE|")) {
          handleBeagleBoardGesture(client, messageStr);
        } else {
          console.error("Error parsing message:", error);
        }
      } catch (beagleBoardError) {
        console.error(
          "Error parsing potential BeagleBoard message:",
          beagleBoardError
        );
      }
    }
  });

  // Handle client disconnection
  client.on("close", () => {
    console.log(`Client disconnected: ${client.id}`);

    // If client was in a room, handle leaving
    if (client.roomId) {
      handleLeaveRoom(client, { roomId: client.roomId });
    }

    // If client was a BeagleBoard, remove from beagleBoards map
    if (client.deviceId) {
      beagleBoards.delete(client.deviceId);
    }

    // Remove client from clients map
    clients.delete(client.id);
  });

  // Send initial room list to the client
  handleRoomList(client);
}

// Handle incoming message based on event type
function handleMessage(client: ExtendedWebSocket, message: WebSocketMessage) {
  const { event, payload } = message;

  console.log(`Received event: ${event}`);

  switch (event) {
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
    case "get_room":
      handleGetRoom(client, payload);
      break;
    case "beagleboard_command":
      // Handle BeagleBoard specific commands
      if (payload && payload.command) {
        handleBeagleBoardWSCommand(client, payload);
      }
      break;
    default:
      console.warn(`Unknown event type: ${event}`);
      break;
  }
}

// Handle BeagleBoard commands that come in the old format
function handleBeagleBoardCommand(client: ExtendedWebSocket, message: string) {
  try {
    // Parse BeagleBoard command
    const cmdResult = parseBeagleBoardCommand(message);
    if (!cmdResult) return;

    const { command, deviceId, params } = cmdResult;

    // Store or update client info
    client.deviceId = deviceId;
    beagleBoards.set(deviceId, {
      deviceId,
      client,
    });

    // Process commands
    console.log(`Received command ${command} from device ${deviceId}`);

    switch (command) {
      case "LIST_ROOMS":
        sendRoomListToBeagleBoard(client, deviceId);
        break;

      case "CREATE_ROOM":
        const { RoomID, RoomName, PlayerName } = params;
        if (RoomID && RoomName && PlayerName) {
          createRoomForBeagleBoard(
            client,
            deviceId,
            RoomID,
            RoomName,
            PlayerName
          );
        } else {
          sendResponseToBeagleBoard(
            client,
            "CREATE_ROOM",
            "ERROR",
            "Missing RoomID, RoomName or PlayerName",
            deviceId
          );
        }
        break;

      case "JOIN_ROOM":
        const { RoomID: joinRoomID, PlayerName: joinPlayerName } = params;
        if (joinRoomID && joinPlayerName) {
          joinBeagleBoardToRoom(client, deviceId, joinRoomID, joinPlayerName);
        } else {
          sendResponseToBeagleBoard(
            client,
            "JOIN_ROOM",
            "ERROR",
            "Missing RoomID or PlayerName",
            deviceId
          );
        }
        break;

      case "LEAVE_ROOM":
        if (beagleBoards.has(deviceId)) {
          const board = beagleBoards.get(deviceId)!;
          if (board.roomId) {
            leaveBeagleBoardFromRoom(client, deviceId, board.roomId);
          } else {
            sendResponseToBeagleBoard(
              client,
              "LEAVE_ROOM",
              "ERROR",
              "Not in a room",
              deviceId
            );
          }
        } else {
          sendResponseToBeagleBoard(
            client,
            "LEAVE_ROOM",
            "ERROR",
            "Device not registered",
            deviceId
          );
        }
        break;

      case "SET_READY":
        const { Ready } = params;
        if (beagleBoards.has(deviceId)) {
          const board = beagleBoards.get(deviceId)!;
          if (board.roomId) {
            const isReady = Ready === "true" || Ready === "1";
            setBeagleBoardReady(client, deviceId, board.roomId, isReady);
          } else {
            sendResponseToBeagleBoard(
              client,
              "SET_READY",
              "ERROR",
              "Not in a room",
              deviceId
            );
          }
        } else {
          sendResponseToBeagleBoard(
            client,
            "SET_READY",
            "ERROR",
            "Device not registered",
            deviceId
          );
        }
        break;

      default:
        sendResponseToBeagleBoard(
          client,
          command,
          "ERROR",
          `Unknown command: ${command}`,
          deviceId
        );
    }

    // Broadcast the command to all web clients for monitoring
    broadcastToAll("beagle_board_command", {
      message,
      sender: deviceId,
      timestamp: Date.now(),
    });

    // Update room lists for all clients
    broadcastToAll("room_list", {
      rooms: getRoomList(),
    });
  } catch (error) {
    console.error("Error handling BeagleBoard command:", error);
  }
}

// Handle BeagleBoard commands in WebSocket JSON format
function handleBeagleBoardWSCommand(client: ExtendedWebSocket, payload: any) {
  try {
    const { command, deviceId, ...params } = payload;

    if (!command || !deviceId) {
      console.error("Invalid BeagleBoard command payload", payload);
      return;
    }

    // Convert to old format for processing
    const messageParams = Object.entries(params)
      .map(([key, value]) => `${key}:${value}`)
      .join("|");

    const oldFormatMessage = `CMD:${command}|DeviceID:${deviceId}${
      messageParams ? "|" + messageParams : ""
    }`;

    handleBeagleBoardCommand(client, oldFormatMessage);
  } catch (error) {
    console.error("Error handling BeagleBoard WS command:", error);
  }
}

// Handle BeagleBoard gesture messages
function handleBeagleBoardGesture(client: ExtendedWebSocket, message: string) {
  try {
    const gestureResult = parseGestureMessage(message);
    if (!gestureResult) return;

    const { deviceId, roomId, gestureData } = gestureResult;
    handleGestureData(deviceId, roomId, gestureData);
  } catch (error) {
    console.error("Error handling BeagleBoard gesture:", error);
  }
}

// Helper function to send response to BeagleBoard
function sendResponseToBeagleBoard(
  client: ExtendedWebSocket,
  command: string,
  status: string,
  message: string,
  deviceId: string
) {
  if (client.readyState === WebSocket.OPEN) {
    const response = `RESPONSE:${command}|DeviceID:${deviceId}|status:${status}|message:${message}\n`;
    client.send(response);
  }
}

// Function to send room list to a BeagleBoard
function sendRoomListToBeagleBoard(
  client: ExtendedWebSocket,
  deviceId: string
) {
  const roomList = getRoomList();

  // Make sure format exactly matches what client expects: RESPONSE:LIST_ROOMS|DeviceID:deviceId|Rooms:json
  const response = `RESPONSE:LIST_ROOMS|DeviceID:${deviceId}|Rooms:${JSON.stringify(
    roomList
  )}`;

  console.log(`Sending room list to device ${deviceId}`);

  // Send the response back to the beagle board
  sendResponseToBeagleBoard(
    client,
    "LIST_ROOMS",
    "SUCCESS",
    response,
    deviceId
  );
}

// Function to join a BeagleBoard to a room
function joinBeagleBoardToRoom(
  client: ExtendedWebSocket,
  deviceId: string,
  roomId: string,
  playerName: string
) {
  console.log(
    `BeagleBoard ${deviceId} joining room ${roomId} as ${playerName}`
  );

  // Find the room (case insensitive to be more forgiving with IDs)
  const room = Array.from(rooms.values()).find(
    (r) => r.id.toLowerCase() === roomId.toLowerCase()
  );

  if (!room) {
    console.error(`Room ${roomId} not found for BeagleBoard join request`);
    sendResponseToBeagleBoard(
      client,
      "JOIN_ROOM",
      "ERROR",
      `Room ${roomId} not found`,
      deviceId
    );
    return;
  }

  // Check if room is full (only count BeagleBoard players, not web admins)
  const beagleBoardPlayerCount = room.players.filter(
    (player) => player.playerType === "beagleboard"
  ).length;

  console.log(
    `Room ${roomId} current BeagleBoard player count: ${beagleBoardPlayerCount}/${room.maxPlayers}`
  );

  if (beagleBoardPlayerCount >= room.maxPlayers) {
    console.error(
      `Room ${roomId} is full, cannot add more BeagleBoard players`
    );
    sendResponseToBeagleBoard(
      client,
      "JOIN_ROOM",
      "ERROR",
      "Room is full",
      deviceId
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
    playerType: "beagleboard", // Mark as BeagleBoard player
  };

  room.players.push(newPlayer);

  // If no host set yet, make this player the host
  if (!room.hostId && room.players.length > 0) {
    room.hostId = playerId;
    console.log(`Player ${playerName} set as host of room ${room.id}`);
  }

  // Register the beagle board with the room
  beagleBoards.set(deviceId, {
    deviceId,
    roomId: room.id,
    playerName,
    client,
  });

  // Update the room in the map to ensure latest state
  rooms.set(room.id, room);

  // Log updated player count for verification
  const updatedPlayerCount = room.players.filter(
    (p) => p.playerType === "beagleboard"
  ).length;
  console.log(
    `Room ${room.id} now has ${updatedPlayerCount} BeagleBoard players`
  );
  console.log(
    `Total players in room: ${room.players.length} (including web admins)`
  );
  console.log(
    `Players in room: ${JSON.stringify(
      room.players.map((p) => ({ name: p.name, type: p.playerType }))
    )}`
  );

  // Send success response back to the beagle board
  sendResponseToBeagleBoard(
    client,
    "JOIN_ROOM",
    "SUCCESS",
    `Joined room ${room.id} successfully`,
    deviceId
  );

  try {
    // Broadcast the specific room update to ALL clients
    console.log(`Broadcasting room update for room ${room.id}`);
    broadcastToAll("room_updated", { room });

    // Also broadcast the updated room list
    broadcastToAll("room_list", { rooms: getRoomList() });

    console.log(
      `Successfully broadcast updates for BeagleBoard ${deviceId} joining room ${room.id}`
    );
  } catch (error) {
    console.error(`Error broadcasting room updates: ${error}`);
  }

  console.log(
    `Beagle board ${deviceId} joined room ${room.id} as player ${playerName}`
  );
}

// Function to remove a BeagleBoard from a room
function leaveBeagleBoardFromRoom(
  client: ExtendedWebSocket,
  deviceId: string,
  roomId: string
) {
  if (!rooms.has(roomId)) {
    sendResponseToBeagleBoard(
      client,
      "LEAVE_ROOM",
      "ERROR",
      `Room ${roomId} not found`,
      deviceId
    );
    return;
  }

  const room = rooms.get(roomId)!;
  const board = beagleBoards.get(deviceId);

  if (!board || !board.playerName) {
    sendResponseToBeagleBoard(
      client,
      "LEAVE_ROOM",
      "ERROR",
      "Device not properly registered",
      deviceId
    );
    return;
  }

  // Find the player in the room
  const playerIndex = room.players.findIndex(
    (p) => p.name === board.playerName
  );

  if (playerIndex === -1) {
    sendResponseToBeagleBoard(
      client,
      "LEAVE_ROOM",
      "ERROR",
      `Player ${board.playerName} not found in room`,
      deviceId
    );
    return;
  }

  // Remove the player
  room.players.splice(playerIndex, 1);

  // Update Beagle board record - remove room association
  beagleBoards.set(deviceId, {
    deviceId,
    client,
  });

  // If room is empty, remove it
  if (room.players.length === 0) {
    rooms.delete(roomId);
    console.log(`Room ${roomId} removed as it's now empty`);
  } else {
    // Update room for all clients
    broadcastToAll("room_updated", { room });
  }

  // Update room list for all clients
  broadcastToAll("room_list", {
    rooms: getRoomList(),
  });

  // Send success response to Beagle board
  sendResponseToBeagleBoard(
    client,
    "LEAVE_ROOM",
    "SUCCESS",
    `Left room ${roomId}`,
    deviceId
  );
}

// Function to set BeagleBoard player ready status
function setBeagleBoardReady(
  client: ExtendedWebSocket,
  deviceId: string,
  roomId: string,
  isReady: boolean
) {
  // Check if room exists
  if (!rooms.has(roomId)) {
    sendResponseToBeagleBoard(
      client,
      "SET_READY",
      "ERROR",
      `Room ${roomId} not found`,
      deviceId
    );
    return;
  }

  const room = rooms.get(roomId)!;
  const board = beagleBoards.get(deviceId)!;

  // Find the player in the room
  const player = room.players.find((p) => p.name === board.playerName);

  if (!player) {
    sendResponseToBeagleBoard(
      client,
      "SET_READY",
      "ERROR",
      `Player ${board.playerName} not found in room`,
      deviceId
    );
    return;
  }

  // Update player ready status
  player.isReady = isReady;

  // Send success response to BeagleBoard
  sendResponseToBeagleBoard(
    client,
    "SET_READY",
    "SUCCESS",
    `Player is now ${isReady ? "ready" : "not ready"}`,
    deviceId
  );

  // Notify all clients about the room update
  sendToRoom(roomId, "room_updated", { room });

  // Also broadcast room_updated to ALL clients for better state synchronization
  broadcastToAll("room_updated", { room });

  console.log(
    `Beagle board ${deviceId} (${board.playerName}) in room ${roomId} is now ${
      isReady ? "ready" : "not ready"
    }`
  );
  
  // *** Add game start detection ***
  // Only check for game start when a player becomes ready
  if (isReady) {
    // Check if all players are ready and there are at least 2 players
    const allPlayersReady = room.players.every(p => p.isReady);
    const minPlayersForGame = 2;
    const hasEnoughPlayers = room.players.length >= minPlayersForGame;
    
    if (allPlayersReady && hasEnoughPlayers) {
      console.log(`All players in room ${roomId} are ready! Starting game...`);
      
      // Update room status to playing
      room.status = "playing";
      
      // Send game_starting event to all clients in the room
      sendToRoom(roomId, "game_starting", { 
        roomId: roomId,
        timestamp: Date.now()
      });
      
      // Update room with new status
      sendToRoom(roomId, "room_updated", { room });
      
      // Also broadcast room_updated to ALL clients
      broadcastToAll("room_updated", { room });
    }
  }
}

// Handle gesture data from Beagle board
function handleGestureData(
  deviceId: string,
  roomId: string,
  gestureData: string
) {
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
    const payload = {
      playerId: player.id,
      gesture: gestureJson.gesture,
      confidence: gestureJson.confidence || 1.0,
    };

    // Send the gesture event to all clients in the room
    sendToRoom(roomId, "gesture_event", payload);

    console.log(
      `Processed gesture ${gestureJson.gesture} from device ${deviceId} in room ${roomId}`
    );
  } catch (error) {
    console.error("Error handling gesture data:", error);
  }
}

// Helper function to parse Beagle board command messages
function parseBeagleBoardCommand(message: string): {
  command: string;
  deviceId: string;
  params: Record<string, string>;
} | null {
  try {
    if (!message.startsWith("CMD:")) {
      return null;
    }

    const parts = message.split("|");
    const cmdPart = parts[0].split(":");
    const command = cmdPart[1];

    const deviceIdPart = parts[1].split(":");
    const deviceId = deviceIdPart[1];

    const params: Record<string, string> = {};
    for (let i = 2; i < parts.length; i++) {
      const param = parts[i].split(":");
      if (param.length === 2) {
        params[param[0]] = param[1];
      }
    }

    return { command, deviceId, params };
  } catch (error) {
    console.error("Error parsing Beagle board command:", error);
    return null;
  }
}

// Helper function to parse gesture messages from Beagle boards
function parseGestureMessage(
  message: string
): { deviceId: string; roomId: string; gestureData: string } | null {
  try {
    if (!message.startsWith("GESTURE|")) {
      return null;
    }

    const parts = message.split("|");
    const deviceIdPart = parts[1].split(":");
    const deviceId = deviceIdPart[1];

    const roomIdPart = parts[2].split(":");
    const roomId = roomIdPart[1];

    // Extract the gesture data (everything after the third pipe)
    const gestureData = parts.slice(3).join("|");

    return { deviceId, roomId, gestureData };
  } catch (error) {
    console.error("Error parsing gesture message:", error);
    return null;
  }
}

// Add this as a new function in the file
function createRoomForBeagleBoard(
  client: ExtendedWebSocket,
  deviceId: string,
  roomId: string,
  roomName: string,
  playerName: string
) {
  console.log(
    `BeagleBoard ${deviceId} creating room ${roomId} with name ${roomName}`
  );

  // Check if room already exists
  if (rooms.has(roomId)) {
    console.error(`Room ${roomId} already exists`);
    sendResponseToBeagleBoard(
      client,
      "CREATE_ROOM",
      "ERROR",
      `Room ${roomId} already exists`,
      deviceId
    );
    return;
  }

  // Create a unique player ID for the beagle board
  const playerId = deviceId;

  // Create the room
  const newRoom: Room = {
    id: roomId,
    name: roomName,
    createdAt: Date.now(),
    hostId: playerId, // BeagleBoard is the host
    players: [
      {
        id: playerId,
        name: playerName,
        isReady: false,
        connected: true,
        playerType: "beagleboard",
      },
    ],
    status: "waiting",
    maxPlayers: 4, // Default max players
  };

  // Add room to the rooms map
  rooms.set(roomId, newRoom);

  // Register the beagle board with the room
  beagleBoards.set(deviceId, {
    deviceId,
    roomId: roomId,
    playerName,
    client,
  });

  // Send success response back to the beagle board
  sendResponseToBeagleBoard(
    client,
    "CREATE_ROOM",
    "SUCCESS",
    `Created room ${roomId} successfully`,
    deviceId
  );

  try {
    // Broadcast room updates
    broadcastToAll("room_updated", { room: newRoom });
    broadcastToAll("room_list", { rooms: getRoomList() });

    console.log(
      `Successfully broadcast updates for BeagleBoard ${deviceId} creating room ${roomId}`
    );
  } catch (error) {
    console.error(`Error broadcasting room updates: ${error}`);
  }
}
