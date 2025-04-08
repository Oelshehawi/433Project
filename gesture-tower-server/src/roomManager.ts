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
  BeagleBoard,
  GameState,
} from "./types";
import {
  broadcastToAll,
  sendToClient,
  sendToRoom,
  clients,
  beagleBoards,
} from "./messaging";
import { broadcastToAllClients } from "./server";
import { initializeCardsForRoom } from "./cardManager";
import {
  initializeGameState,
  processAction,
  endRound,
  MIN_REQUIRED_PLAYERS, // Import the constant
} from "./gameManager";
import { v4 as uuidv4 } from "uuid";

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
    console.log(
      "handleCreateRoom called with payload:",
      JSON.stringify(payload)
    );
    const { room } = payload;

    // Validate data
    if (!room) {
      console.error("Missing room data in create_room payload");
      return sendToClient(client, "error", {
        error: "Missing required data",
      } as ErrorPayload);
    }

    // Validate room data
    if (!room || !room.id || !room.name) {
      console.error("Invalid room data in create_room payload", room);
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

    // Check if this client is a BeagleBoard client creating the room
    const hostPlayer = newRoom.players.find(
      (player) => player.id === newRoom.hostId
    );
    if (
      hostPlayer &&
      (hostPlayer.id === client.playerId ||
        hostPlayer.playerType === "beagleboard")
    ) {
      console.log(`\n=========== BEAGLEBOARD CLIENT CREATING ROOM ===========`);
      console.log(`Room ID: ${newRoom.id}`);
      console.log(`Host ID: ${newRoom.hostId}`);

      // Update client properties to ensure it's properly registered
      client.roomId = newRoom.id;
      client.playerId = hostPlayer.id;
      client.playerName = hostPlayer.name;
      client.playerType = "beagleboard";

      console.log(
        `Set client properties: roomId=${client.roomId}, playerId=${client.playerId}, playerType=${client.playerType}`
      );

      // Register this client in the beagleBoards map
      const beagleBoard: BeagleBoard = {
        deviceId: hostPlayer.id,
        roomId: newRoom.id,
        client: client,
      };

      beagleBoards.set(client.id, beagleBoard);
      console.log(
        `Added BeagleBoard client to beagleBoards map with key ${client.id}`
      );
      console.log(`BeagleBoard map now has ${beagleBoards.size} entries`);

      // Log all BeagleBoard entries for debugging
      beagleBoards.forEach((bb, key) => {
        console.log(
          `  Entry ${key}: deviceId=${bb.deviceId}, roomId=${bb.roomId}`
        );
      });

      console.log(`============================================\n`);
    }

    // Notify the client
    sendToClient(client, "room_updated", { room: newRoom });

    // Update room list for all clients
    broadcastToAll("room_list", {
      rooms: getRoomList(),
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
    console.log("handleJoinRoom called with payload:", JSON.stringify(payload));
    const { roomId, playerId, playerName } = payload;

    // Validate data
    if (!roomId || !playerId || !playerName) {
      console.error("Missing required data in join_room payload", {
        roomId,
        playerId,
        playerName,
      });
      return sendToClient(client, "error", {
        error: "Missing required data",
      } as ErrorPayload);
    }

    // Explicitly check for BeagleBoard client based on ID
    const isBeagleBoard =
      playerId.startsWith("bb_") ||
      (!playerId.startsWith("admin-") && !playerId.startsWith("viewer-"));

    if (isBeagleBoard) {
      console.log(`\n=========== BEAGLEBOARD JOIN REQUEST ===========`);
      console.log(`BeagleBoard client joining room: ${roomId}`);
      console.log(`Player ID: ${playerId}`);
      console.log(`Current client.id: ${client.id}`);
      console.log(`Current readyState: ${client.readyState}`);

      // Check if client is already in beagleBoards map
      let beagleBoardExists = false;
      beagleBoards.forEach((bb, key) => {
        if (bb.deviceId === playerId) {
          beagleBoardExists = true;
          console.log(`BeagleBoard already exists in map with key ${key}`);
          // Update the existing entry
          bb.roomId = roomId;
          bb.client = client;
          console.log(
            `Updated existing BeagleBoard entry with new roomId: ${roomId}`
          );
        }
      });

      if (!beagleBoardExists) {
        // Add to beagleBoards map
        const beagleBoard: BeagleBoard = {
          deviceId: playerId,
          roomId: roomId,
          client: client,
        };
        beagleBoards.set(client.id, beagleBoard);
        console.log(`Added NEW BeagleBoard to map with key ${client.id}`);
      }

      console.log(`BeagleBoard map now has ${beagleBoards.size} entries`);

      // Debug output for all BeagleBoard entries
      beagleBoards.forEach((bb, key) => {
        console.log(
          `  Entry ${key}: deviceId=${bb.deviceId}, roomId=${bb.roomId}`
        );
      });
    }

    // Store the room ID and player ID in the client object
    client.roomId = roomId;
    client.playerId = playerId;
    client.playerName = playerName;

    // Set playerType based on ID format
    if (isBeagleBoard) {
      client.playerType = "beagleboard";
      console.log(`Set client.playerType = "beagleboard" for ${playerId}`);
    } else {
      client.playerType = "webviewer";
    }

    console.log(
      `Client ${client.id} updated with roomId=${client.roomId}, playerId=${client.playerId}, playerType=${client.playerType}`
    );

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
    // Use our previously declared isBeagleBoard variable
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
    broadcastToAll("room_list", {
      rooms: getRoomList(),
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
      broadcastToAll("room_list", {
        rooms: getRoomList(),
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
    broadcastToAll("room_updated", { room });

    // Update room list for all clients
    broadcastToAll("room_list", {
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
      // Check if all players are ready and there is at least the minimum required players
      const allPlayersReady = room.players.every((p) => p.isReady);

      // Count BeagleBoard players for the minimum requirement check
      const beagleBoardPlayers = room.players.filter(
        (p) => p.playerType === "beagleboard"
      ).length;

      // Use the constant for minimum players
      const hasEnoughPlayers = beagleBoardPlayers >= MIN_REQUIRED_PLAYERS;

      // Log test mode status based on the constant
      if (MIN_REQUIRED_PLAYERS === 1) {
        console.log(
          `Room has ${beagleBoardPlayers} BeagleBoard player(s). TEST MODE: Starting with ${MIN_REQUIRED_PLAYERS} player.`
        );
      } else {
        console.log(
          `Room has ${beagleBoardPlayers} BeagleBoard player(s). Minimum required: ${MIN_REQUIRED_PLAYERS}.`
        );
      }

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
        broadcastToAll("room_updated", { room });

        // Initialize cards but DON'T send them yet - they will be sent in startRound
        console.log(`PRE-INITIALIZING CARDS for room ${effectiveRoomId}`);
        const cardsInitialized = initializeCardsForRoom(effectiveRoomId);
        if (!cardsInitialized) {
          console.error(
            `Failed to pre-initialize cards for room ${effectiveRoomId}`
          );
        } else {
          console.log(
            `Cards pre-initialized successfully for room ${effectiveRoomId}`
          );

          // Initialize game state and start the first round immediately
          // This will trigger startRound which will send the cards with round_start event
          initializeGameState(effectiveRoomId);
        }
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
    console.log(`Handling game start request for room ${roomId}`);

    // Validate data
    if (!roomId) {
      console.error("Missing roomId in game start request");
      return sendToClient(client, "error", {
        error: "Missing room ID",
      } as ErrorPayload);
    }

    // Check if room exists
    if (!rooms.has(roomId)) {
      console.error(`Room ${roomId} not found for game start`);
      return sendToClient(client, "error", {
        error: "Room not found",
      } as ErrorPayload);
    }

    const room = rooms.get(roomId)!;
    console.log(`Room status: ${room.status}, Players: ${room.players.length}`);

    // Check if we have minimum required players ready (based on MIN_REQUIRED_PLAYERS)
    const readyBeagleBoardPlayers = room.players.filter(
      (player) => player.playerType === "beagleboard" && player.isReady
    );

    console.log(
      `Ready BeagleBoard players: ${readyBeagleBoardPlayers.length}/${
        room.players.filter((p) => p.playerType === "beagleboard").length
      }`
    );

    if (readyBeagleBoardPlayers.length < MIN_REQUIRED_PLAYERS) {
      console.error(`Not enough ready BeagleBoard players to start game`);
      return sendToClient(client, "error", {
        error: `At least ${MIN_REQUIRED_PLAYERS} BeagleBoard player(s) must be ready to start${
          MIN_REQUIRED_PLAYERS === 1 ? " (TEST MODE)" : ""
        }`,
      } as ErrorPayload);
    }

    // Log mode (test or normal)
    if (MIN_REQUIRED_PLAYERS === 1) {
      console.log(
        `TEST MODE: Starting game with ${readyBeagleBoardPlayers.length} BeagleBoard player(s)`
      );
    } else {
      console.log(
        `Starting game with ${readyBeagleBoardPlayers.length} BeagleBoard players`
      );
    }

    // Set room status to playing
    room.status = "playing";

    // Initialize cards for the room
    console.log(`Initializing cards for room ${roomId}`);
    const cardsInitialized = initializeCardsForRoom(roomId);
    if (!cardsInitialized) {
      console.error(`Failed to initialize cards for room ${roomId}`);
      // Continue anyway, the game can still start without cards
    } else {
      console.log(`Cards successfully initialized for room ${roomId}`);
    }

    // Send a countdown to all clients in the room
    console.log(`Sending game_starting event to room ${roomId}`);
    sendToRoom(roomId, "game_starting", { countdown: 3 });

    // Delay the actual game start to allow for countdown animation
    setTimeout(() => {
      // First, initialize game state with goal heights and turn order
      // This will also start the first round and send cards via round_start
      console.log(`Initializing game state for room ${roomId}`);
      const gameStateInitialized = initializeGameState(roomId);
      if (!gameStateInitialized) {
        console.error(`Failed to initialize game state for room ${roomId}`);
        // This is more serious, but we'll continue and try to recover
      } else {
        console.log(`Game state successfully initialized for room ${roomId}`);
      }

      // Notify all clients that the game has started - SEND THIS EXPLICITLY
      console.log(`Broadcasting game_started event to room ${roomId}`);
      sendToRoom(roomId, "game_started", {
        roomId,
        timestamp: Date.now(),
      });

      // No need to send cards here anymore as they're sent by startRound inside initializeGameState

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

    // Get the current round number from the game state
    const currentRound = room.gameState?.roundNumber || 0;

    // Log current game state info for debugging
    console.log(`Current game state - Round: ${currentRound}`);
    console.log(
      `Player move status for ${playerId}: ${room.gameState?.playerMoves.get(
        playerId
      )}`
    );

    // Debug: Print all player move statuses
    if (room.gameState?.playerMoves) {
      console.log(`All player move statuses for round ${currentRound}:`);
      room.gameState.playerMoves.forEach((hasMoved, pid) => {
        console.log(
          `  - Player ${pid}: ${hasMoved ? "has moved" : "has not moved"}`
        );
      });
    }

    // Check if the player has already moved this round
    if (room.gameState && room.gameState.playerMoves.get(playerId)) {
      // Player has already moved this round
      console.log(
        `Player ${playerId} has already moved this round (${currentRound})`
      );

      // Send a message back to this specific client indicating their move wasn't processed
      sendToClient(client, "move_status", {
        status: "rejected",
        reason: "already_moved",
        roundNumber: currentRound,
      });

      return;
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

        // Mark this player's move as complete
        room.gameState.playerMoves.set(playerId, true);
        console.log(
          `Marked player ${playerId} as having moved in round ${currentRound}`
        );

        // Check if all players have moved after this action
        let allPlayersMoved = true;
        room.gameState.playerMoves.forEach((hasMoved) => {
          if (!hasMoved) {
            allPlayersMoved = false;
          }
        });

        // If all players have moved, end the round automatically
        if (allPlayersMoved) {
          console.log(
            `All players have submitted gestures in room ${roomId}, ending round ${currentRound}`
          );
          endRound(roomId);
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
      roundNumber: currentRound, // Include the round number in the broadcast
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
