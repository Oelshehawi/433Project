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
  GameActionType,
} from "./types";
import { broadcastToAll, sendToClient, sendToRoom, clients } from "./messaging";
import { broadcastToAllClients } from "./server";
import { initializeCardsForRoom } from "./cardManager";
import { initializeGameState, processAction } from "./gameManager";

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
      // Get player name before removing for logging
      const playerName = room.players[playerIndex].name || playerId;

      // Remove the player
      room.players.splice(playerIndex, 1);

      console.log(`Player ${playerName} left room ${room.name} (${roomId})`);

      // Clear client properties
      client.roomId = undefined;
      client.playerId = undefined;
      client.playerName = undefined;

      // Notify remaining clients in the room if it still exists
      if (rooms.has(roomId)) {
        // Send updates to all clients in the room
        sendToRoom(roomId, "room_updated", { room });
      } else {
        // If the room was deleted, send room_list update to refresh UI for all clients
        broadcastToAll("room_list", {
          rooms: getRoomList(),
        });
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

    // *** Add game start detection ***
    // Only check for game start when a player becomes ready
    if (isReady) {
      // Check if all players are ready and there are at least 2 players
      const allPlayersReady = room.players.every((p) => p.isReady);
      // Changing back to 2 players minimum for game start
      const minPlayersForGame = 2; // Changed from 1 to 2 for proper multiplayer
      const hasEnoughPlayers = room.players.length >= minPlayersForGame;

      if (allPlayersReady && hasEnoughPlayers) {
        console.log(
          `All players in room ${effectiveRoomId} are ready! Starting game...`
        );

        // Update room status to playing
        room.status = "playing";

        // Send game_starting event to all clients in the room
        sendToRoom(effectiveRoomId, "game_starting", {
          roomId: effectiveRoomId,
          timestamp: Date.now(),
        });

        // Update room with new status
        sendToRoom(effectiveRoomId, "room_updated", { room });

        // Also broadcast room_updated to ALL clients for better state synchronization
        broadcastToAllClients({
          event: "room_updated",
          payload: { room },
        });
      }
    }
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

    // Check if at least 2 players are ready
    const readyBeagleBoardPlayers = room.players.filter(
      (player) => player.playerType === "beagleboard" && player.isReady
    );

    if (readyBeagleBoardPlayers.length < 2) {
      return sendToClient(client, "error", {
        error: "At least 2 BeagleBoard players must be ready to start",
      } as ErrorPayload);
    }

    // Set room status to playing
    room.status = "playing";

    // Initialize cards for the room
    const cardsInitialized = initializeCardsForRoom(roomId);
    if (!cardsInitialized) {
      console.error(`Failed to initialize cards for room ${roomId}`);
      // Continue anyway, the game can still start without cards
    }

    // Send a countdown to all clients in the room
    sendToRoom(roomId, "game_starting", { countdown: 3 });

    // Delay the actual game start to allow for countdown animation
    setTimeout(() => {
      // Notify all clients that the game has started
      sendToRoom(roomId, "game_started", { roomId });

      // For each BeagleBoard player, send their initial cards
      if (room.playerCards) {
        room.players
          .filter((player) => player.playerType === "beagleboard")
          .forEach((player) => {
            const playerCards = room.playerCards!.get(player.id);

            if (playerCards) {
              // Find the client for this player
              const playerClient = Array.from(clients.values()).find(
                (c: ExtendedWebSocket) => c.playerId === player.id
              );

              if (playerClient) {
                sendToClient(playerClient, "beagle_board_command", {
                  command: "CARDS",
                  cards: playerCards.cards,
                });
              }
            }
          });
      }

      // Initialize game state with goal heights and turn order
      const gameStateInitialized = initializeGameState(roomId);
      if (!gameStateInitialized) {
        console.error(`Failed to initialize game state for room ${roomId}`);
        // This is more serious, but we'll continue and try to recover
      }

      // Update room list
      broadcastToAllClients({
        event: "room_list",
        payload: {
          rooms: getRoomList(),
        },
      });
    }, 3000); // 3 second countdown

    console.log(`Game started in room ${roomId}`);
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
    const { playerId, gesture, confidence, cardId } = payload;
    const roomId = client.roomId;

    // Validate data
    if (!playerId || !gesture || !roomId) {
      return;
    }

    // Check if room exists and is playing
    if (!rooms.has(roomId) || rooms.get(roomId)!.status !== "playing") {
      return;
    }

    const room = rooms.get(roomId)!;

    console.log(
      `Gesture event: ${gesture} from player ${playerId} (conf: ${confidence})`
    );

    // Check if it's this player's turn or if we allow simultaneous play
    if (room.gameState && room.gameState.currentTurn !== playerId) {
      // If it's not the player's turn, check if they have already moved this turn
      if (room.gameState.playerMoves.get(playerId)) {
        // Player has already moved this turn
        console.log(`Player ${playerId} has already moved this turn`);
        return;
      }
    }

    // If this is a game action (attack, defend, build)
    if (gesture === "attack" || gesture === "defend" || gesture === "build") {
      // Process the action in the game state
      if (room.gameState) {
        const actionProcessed = processAction(
          roomId,
          playerId,
          gesture as GameActionType
        );
        if (!actionProcessed) {
          console.error(
            `Failed to process action ${gesture} for player ${playerId}`
          );
        }
      }

      // If there's a card ID, process card usage
      if (cardId && room.playerCards && room.playerCards.has(playerId)) {
        // Process card action
        const playerCards = room.playerCards.get(playerId);

        if (playerCards) {
          // Find the card
          const cardIndex = playerCards.cards.findIndex(
            (card) => card.id === cardId
          );

          if (cardIndex !== -1) {
            const card = playerCards.cards[cardIndex];

            // Check if card type matches the gesture
            if (card.type === gesture) {
              // Remove the used card
              playerCards.cards.splice(cardIndex, 1);

              // Draw a new card - use basic types only
              const newCard = {
                id: `new-${Date.now()}`,
                type: ["attack", "defend", "build"][
                  Math.floor(Math.random() * 3)
                ] as GameActionType,
                name: `Basic ${
                  gesture.charAt(0).toUpperCase() + gesture.slice(1)
                }`,
                description: `A basic ${gesture} card`,
              };

              playerCards.cards.push(newCard);

              // Send the updated cards back to the player
              const playerClient = Array.from(clients.values()).find(
                (c: ExtendedWebSocket) => c.playerId === playerId
              );

              if (playerClient) {
                sendToClient(playerClient, "beagle_board_command", {
                  command: "CARDS",
                  cards: playerCards.cards,
                });
              }
            }
          }
        }
      }
    }

    // Broadcast gesture event to all players in the room
    sendToRoom(roomId, "gesture_event", {
      playerId,
      gesture,
      confidence,
      cardId,
    });
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
