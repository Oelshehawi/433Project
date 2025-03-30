import {
  ExtendedWebSocket,
  Room,
  RoomListItem,
  Player,
  ErrorPayload,
  CreateRoomPayload,
  JoinRoomPayload,
  LeaveRoomPayload,
  PlayerReadyPayload,
  GameStartedPayload,
  GestureEventPayload,
} from "./types";
import { broadcastToAll, sendToClient, sendToRoom } from "./messaging";
import { broadcastToAllClients } from "./server";

// Store active rooms
export const rooms: Map<string, Room> = new Map();

// Generate room list for clients
export const getRoomList = (): RoomListItem[] => {
  const roomList = Array.from(rooms.values()).map((room) => ({
    id: room.id,
    name: room.name,
    // Only count BeagleBoard players, not web admin clients
    playerCount: room.players.filter(
      (player) => player.playerType === "beagleboard"
    ).length,
    maxPlayers: room.maxPlayers,
    status: room.status,
  }));

  return roomList;
};

// Handle creating a new room
export const handleCreateRoom = (
  client: ExtendedWebSocket,
  payload: CreateRoomPayload
) => {
  try {
    const { room } = payload;

    // Validate data
    if (!room) {
      return sendToClient(client, "error", {
        error: "Missing required data",
      } as ErrorPayload);
    }

    // Validate room data
    if (!room || !room.id || !room.name) {
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

    // Create the room (with empty players array if not provided)
    const newRoom: Room = {
      ...room,
      createdAt: Date.now(),
      status: "waiting",
      players: room.players || [], // Use empty array if no players provided
    };

    // Make sure all players have the playerType field set
    newRoom.players.forEach((player) => {
      if (!player.playerType) {
        player.playerType = "webviewer"; // Assume any existing players are web viewers
      }
    });

    // Add room to storage
    rooms.set(newRoom.id, newRoom);

    console.log(`Room created: ${newRoom.id} - ${newRoom.name}`);

    // Notify the client
    sendToClient(client, "room_updated", { room: newRoom });

    // Update room list for all clients
    broadcastToAllClients({
      event: "room_list",
      payload: {
        rooms: getRoomList(),
      },
    });
  } catch (error) {
    console.error("Error creating room:", error);
    sendToClient(client, "error", {
      error: "Failed to create room",
    } as ErrorPayload);
  }
};

// Handle joining an existing room
export const handleJoinRoom = (
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

    // Check if room is full - only count actual BeagleBoard players
    const beagleboardPlayerCount = room.players.filter(
      (p) => p.playerType === "beagleboard"
    ).length;
    if (beagleboardPlayerCount >= room.maxPlayers) {
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

    // Add player to room - identify BeagleBoard players by ID format
    // BeagleBoard device IDs typically start with "bb_" or similar prefix
    const isBeagleBoard =
      playerId.startsWith("bb_") ||
      (!playerId.startsWith("admin-") && !playerId.startsWith("viewer-"));

    const newPlayer: Player = {
      id: playerId,
      name: playerName,
      isReady: false,
      connected: true,
      playerType: isBeagleBoard ? "beagleboard" : "webviewer",
    };

    room.players.push(newPlayer);

    console.log(`Player ${playerName} joined room ${room.name} (${roomId})`);

    // Notify all clients in the room
    sendToRoom(roomId, "room_updated", { room });

    // Also broadcast to ALL clients to ensure web clients see the update
    broadcastToAll("room_updated", { room });

    // Update room list for all clients
    broadcastToAllClients({
      event: "room_list",
      payload: {
        rooms: getRoomList(),
      },
    });
  } catch (error) {
    console.error("Error joining room:", error);
    sendToClient(client, "error", {
      error: "Failed to join room",
    } as ErrorPayload);
  }
};

// Handle leaving a room
export const handleLeaveRoom = (
  client: ExtendedWebSocket,
  payload: LeaveRoomPayload
) => {
  try {
    const { roomId, playerId: payloadPlayerId } = payload;
    // Use payload's playerId if available, otherwise fall back to client.playerId
    const playerId = payloadPlayerId || client.playerId;

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
        `Player ${client.playerName || playerId} left room ${
          room.name
        } (${roomId})`
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
      broadcastToAllClients({
        event: "room_list",
        payload: {
          rooms: getRoomList(),
        },
      });
    }
  } catch (error) {
    console.error("Error leaving room:", error);
  }
};

// Handle player ready status
export const handlePlayerReady = (
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

    // Also broadcast room_updated to ALL clients for better state synchronization
    broadcastToAllClients({
      event: "room_updated",
      payload: { room },
    });

    // Update room list for all clients
    broadcastToAllClients({
      event: "room_list",
      payload: {
        rooms: getRoomList(),
      },
    });

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
export const handleGameStart = (
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
    broadcastToAllClients({
      event: "room_list",
      payload: {
        rooms: getRoomList(),
      },
    });
  } catch (error) {
    console.error("Error starting game:", error);
    sendToClient(client, "error", {
      error: "Failed to start game",
    } as ErrorPayload);
  }
};

// Handle gesture events
export const handleGestureEvent = (
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

// Handle room list request
export const handleRoomList = (client: ExtendedWebSocket) => {
  try {
    sendToClient(client, "room_list", {
      rooms: getRoomList(),
    });
  } catch (error) {
    console.error("Error sending room list:", error);
    sendToClient(client, "error", {
      error: "Failed to retrieve room list",
    } as ErrorPayload);
  }
};

// Handle get room request
export const handleGetRoom = (
  client: ExtendedWebSocket,
  payload: { roomId: string }
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
        code: "room_not_found",
        error: "Room not found",
      } as ErrorPayload);
    }

    const room = rooms.get(roomId)!;

    // Send room data to the client
    sendToClient(client, "room_data", { room });

    console.log(`Room data sent for room ${roomId} to ${client.id}`);
  } catch (error) {
    console.error("Error getting room:", error);
    sendToClient(client, "error", {
      error: "Failed to retrieve room",
    } as ErrorPayload);
  }
};
