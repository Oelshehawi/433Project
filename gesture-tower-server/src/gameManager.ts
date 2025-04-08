import {
  GameState,
  Room,
  Player,
  GameActionType,
  ExtendedWebSocket,
} from "./types";
import { rooms } from "./roomManager";
import { sendToRoom } from "./messaging";

// Constants for game configuration
const MIN_GOAL_HEIGHT = 5;
const MAX_GOAL_HEIGHT = 10;
// Set to 1 for TEST MODE (single player), or 2 for normal gameplay
export const MIN_REQUIRED_PLAYERS = 1; // TOGGLE: 1 = test mode, 2 = normal mode
// Removed ROUND_DURATION_MS as we'll let clients handle timing

// Initialize game state for a room
export function initializeGameState(roomId: string): boolean {
  if (!rooms.has(roomId)) {
    console.error(`Room ${roomId} not found`);
    return false;
  }

  const room = rooms.get(roomId)!;

  // Only initialize if game is starting
  if (room.status !== "playing") {
    console.error(`Room ${roomId} is not in playing state`);
    return false;
  }

  // Get only beagleboard players
  const beagleBoardPlayers = room.players.filter(
    (player) => player.playerType === "beagleboard"
  );

  // Check if we have enough players based on MIN_REQUIRED_PLAYERS constant
  if (beagleBoardPlayers.length < MIN_REQUIRED_PLAYERS) {
    console.error(
      `Not enough players in room ${roomId}. Minimum ${MIN_REQUIRED_PLAYERS} player(s) required.`
    );
    return false;
  }

  // Test mode is active if only 1 player and MIN_REQUIRED_PLAYERS is 1
  const useTestMode =
    beagleBoardPlayers.length === 1 && MIN_REQUIRED_PLAYERS === 1;
  if (useTestMode) {
    console.log(
      `TEST MODE: Only 1 player detected. Creating virtual opponent.`
    );
  }

  // Create new game state
  const gameState: GameState = {
    towerHeights: new Map(),
    goalHeights: new Map(),
    roundNumber: 1,
    roundStartTime: Date.now(), // Keep track of when rounds start, but clients handle timing
    roundDuration: 0, // Not used by server anymore
    playerShields: new Map(),
    playerMoves: new Map(),
  };

  console.log(`\n=== INITIALIZING GAME STATE FOR ROOM ${roomId} ===`);
  console.log(
    `MIN_GOAL_HEIGHT: ${MIN_GOAL_HEIGHT}, MAX_GOAL_HEIGHT: ${MAX_GOAL_HEIGHT}`
  );

  // Initialize player tower heights and goal heights
  beagleBoardPlayers.forEach((player) => {
    gameState.towerHeights.set(player.id, 0);

    // Generate random goal height between MIN_GOAL_HEIGHT and MAX_GOAL_HEIGHT
    const goalHeight = Math.floor(
      Math.random() * (MAX_GOAL_HEIGHT - MIN_GOAL_HEIGHT + 1) + MIN_GOAL_HEIGHT
    );
    gameState.goalHeights.set(player.id, goalHeight);

    // Initialize shield status to false
    gameState.playerShields.set(player.id, false);

    // Initialize player moves to false
    gameState.playerMoves.set(player.id, false);

    console.log(
      `Player ${player.name} (${player.id}) - Initial Tower: 0, Goal: ${goalHeight}`
    );
  });

  // In TEST MODE, set up virtual opponent
  if (useTestMode) {
    const virtualOpponentId = "virtual_opponent";
    gameState.towerHeights.set(virtualOpponentId, 0);
    const opponentGoalHeight = Math.floor(
      Math.random() * (MAX_GOAL_HEIGHT - MIN_GOAL_HEIGHT + 1) + MIN_GOAL_HEIGHT
    );
    gameState.goalHeights.set(virtualOpponentId, opponentGoalHeight);
    gameState.playerShields.set(virtualOpponentId, false);
    gameState.playerMoves.set(virtualOpponentId, false);

    console.log(
      `Virtual opponent - Initial Tower: 0, Goal: ${opponentGoalHeight}`
    );
  }

  // Save game state to room
  room.gameState = gameState;

  // Send initial game state update to all clients
  console.log(`Sending initial game state update for room ${roomId}`);

  // Convert Maps to objects for sending over WebSocket
  const gameStateForSending = {
    towerHeights: Object.fromEntries(gameState.towerHeights),
    goalHeights: Object.fromEntries(gameState.goalHeights),
    roundNumber: gameState.roundNumber,
    roundStartTime: gameState.roundStartTime,
  };

  sendToRoom(roomId, "game_state_update", {
    roomId,
    gameState: gameStateForSending,
    message: "Game initialized, waiting for web client ready signal",
  });

  // Don't start the first round automatically
  // It will be started when the web client sends the game_ready signal
  console.log(
    `Game state initialized for room ${roomId}. Waiting for web client to be ready before starting first round.`
  );

  return true;
}

// Start a new round
export function startRound(roomId: string): boolean {
  if (!rooms.has(roomId)) {
    console.error(`Room ${roomId} not found`);
    return false;
  }

  const room = rooms.get(roomId)!;

  if (!room.gameState) {
    console.error(`Game state not found for room ${roomId}`);
    return false;
  }

  console.log(
    `\n=========== STARTING ROUND ${room.gameState.roundNumber} IN ROOM ${roomId} ===========`
  );

  // Set round start time
  room.gameState.roundStartTime = Date.now();

  // ENHANCED RESET: Completely reinitialize the playerMoves Map to ensure a clean state
  // First, create a new empty Map
  room.gameState.playerMoves = new Map();

  // Get all players (both real and virtual)
  const beagleBoardPlayers = room.players.filter(
    (player) => player.playerType === "beagleboard"
  );

  // Initialize all real players as not having moved
  beagleBoardPlayers.forEach((player) => {
    console.log(
      `Resetting move status for player ${player.id} to false for round ${room?.gameState?.roundNumber}`
    );
    room.gameState!.playerMoves.set(player.id, false);
  });

  // Reset virtual opponent if in test mode
  if (beagleBoardPlayers.length === 1 && MIN_REQUIRED_PLAYERS === 1) {
    console.log(
      `Resetting move status for virtual_opponent to false for round ${
        room.gameState!.roundNumber
      }`
    );
    room.gameState!.playerMoves.set("virtual_opponent", false);
  }

  console.log(`Room has ${beagleBoardPlayers.length} BeagleBoard players`);
  beagleBoardPlayers.forEach((player) => {
    console.log(
      `  - Player: ${player.name} (${player.id}), Ready: ${player.isReady}`
    );
  });

  console.log(`Client will manage 30-second round timer`);

  // Prepare card data for each player to include in the round_start event
  const playerCards: { [playerId: string]: any } = {};

  if (room.playerCards) {
    console.log(
      `Preparing cards for ${room.playerCards.size} players from playerCards map`
    );

    beagleBoardPlayers.forEach((player) => {
      const cards = room.playerCards?.get(player.id);
      if (cards) {
        playerCards[player.id] = cards.cards;
        console.log(
          `Prepared ${cards.cards.length} cards for player ${player.name} (${player.id}) to include in round_start`
        );

        // Log the first card for debugging
        if (cards.cards.length > 0) {
          console.log(
            `  First card type: ${cards.cards[0].type}, id: ${cards.cards[0].id}`
          );
        }
      } else {
        console.log(
          `WARNING: No cards found for player ${player.name} (${player.id})`
        );
      }
    });
  } else {
    console.error(`No player cards initialized for room ${roomId}`);
    return false;
  }

  // Create payload with card data
  const payload = {
    roomId,
    roundNumber: room.gameState.roundNumber,
    playerCards,
    // Convert Maps to objects for sending over WebSocket
    gameState: {
      towerHeights: Object.fromEntries(room.gameState.towerHeights),
      goalHeights: Object.fromEntries(room.gameState.goalHeights),
      roundNumber: room.gameState.roundNumber,
      roundStartTime: room.gameState.roundStartTime,
    },
  };

  console.log(`Payload size: ~${JSON.stringify(payload).length} bytes`);

  console.log(
    `Payload contains cards for ${Object.keys(playerCards).length} players`
  );
  console.log(
    `Payload contains goal heights for ${
      Object.keys(Object.fromEntries(room.gameState.goalHeights)).length
    } players`
  );

  // Send round start event to all players with cards included for each player
  console.log(`Calling sendToRoom(${roomId}, "round_start", payload) now...`);
  sendToRoom(roomId, "round_start", payload);
  console.log(`Sent round_start with included cards for room ${roomId}`);

  // We no longer need to send separate beagle_board_command events for cards
  // as they're now included in the round_start event
  console.log(
    `=========== ROUND ${room.gameState.roundNumber} STARTED ===========\n`
  );

  return true;
}

// End the current round and start the next one
export function endRound(roomId: string): boolean {
  if (!rooms.has(roomId)) {
    console.error(`Room ${roomId} not found`);
    return false;
  }

  const room = rooms.get(roomId)!;

  if (!room.gameState) {
    console.error(`Game state not found for room ${roomId}`);
    return false;
  }

  // Get BeagleBoard players
  const beagleBoardPlayers = room.players.filter(
    (player) => player.playerType === "beagleboard"
  );

  // Increment the round number
  room.gameState.roundNumber += 1;

  // Reset player shields at the end of the round
  room.gameState.playerShields.forEach((_, playerId) => {
    room.gameState!.playerShields.set(playerId, false);
  });

  // Send round end event
  sendToRoom(roomId, "round_end", {
    roomId,
    roundNumber: room.gameState.roundNumber - 1,
    gameState: room.gameState,
  });

  // Check for win condition
  const winner = checkWinCondition(roomId);
  if (winner) {
    // End the game
    endGame(roomId, winner);
    return true;
  }

  // Start next round
  startRound(roomId);

  return true;
}

// Check if any player has reached their goal height
export function checkWinCondition(roomId: string): string | null {
  if (!rooms.has(roomId)) {
    console.error(`Room ${roomId} not found`);
    return null;
  }

  const room = rooms.get(roomId)!;

  if (!room.gameState) {
    console.error(`Game state not found for room ${roomId}`);
    return null;
  }

  // Log current tower heights and goal heights for all players
  console.log(`\n=== CHECKING WIN CONDITION FOR ROOM ${roomId} ===`);
  for (const [playerId, towerHeight] of room.gameState.towerHeights.entries()) {
    const goalHeight = room.gameState.goalHeights.get(playerId) || 0;
    console.log(
      `Player ${playerId}: Tower Height = ${towerHeight}, Goal Height = ${goalHeight}`
    );
  }

  // Check if any player has reached their goal height
  for (const [playerId, towerHeight] of room.gameState.towerHeights.entries()) {
    const goalHeight = room.gameState.goalHeights.get(playerId) || 0;
    if (towerHeight >= goalHeight) {
      console.log(
        `WIN: Player ${playerId} has reached goal height: ${towerHeight} >= ${goalHeight}`
      );
      return playerId;
    }
  }

  // Get real players (not virtual opponent)
  const beagleBoardPlayers = room.players.filter(
    (player) => player.playerType === "beagleboard"
  );

  // TESTING MODE: Handle virtual opponent for single player mode
  if (beagleBoardPlayers.length === 1) {
    const realPlayer = beagleBoardPlayers[0];
    const realPlayerTowerHeight =
      room.gameState.towerHeights.get(realPlayer.id) || 0;
    const realPlayerGoalHeight =
      room.gameState.goalHeights.get(realPlayer.id) || 0;
    const virtualOpponentTowerHeight =
      room.gameState.towerHeights.get("virtual_opponent") || 0;
    const virtualOpponentGoalHeight =
      room.gameState.goalHeights.get("virtual_opponent") || 0;

    console.log(
      `TESTING MODE: Player ${realPlayer.name} - Tower: ${realPlayerTowerHeight}/${realPlayerGoalHeight}`
    );
    console.log(
      `TESTING MODE: Virtual opponent - Tower: ${virtualOpponentTowerHeight}/${virtualOpponentGoalHeight}`
    );

    // Only return a winner if a player has reached their goal height
    // Do NOT end the game if tower height is 0 - that's the starting value!
    if (realPlayerTowerHeight >= realPlayerGoalHeight) {
      console.log(
        `TESTING MODE: Player ${realPlayer.name} won by reaching goal height!`
      );
      return realPlayer.id;
    }

    if (virtualOpponentTowerHeight >= virtualOpponentGoalHeight) {
      console.log(
        `TESTING MODE: Virtual opponent won by reaching goal height!`
      );
      return "virtual_opponent";
    }

    return null;
  }

  // Regular multiplayer mode
  // We should remove the old logic that ends the game if a player's tower is 0
  // since that's the starting height - makes no sense!

  return null;
}

// End the game and declare a winner
export function endGame(roomId: string, winnerId: string): boolean {
  if (!rooms.has(roomId)) {
    console.error(`Room ${roomId} not found`);
    return false;
  }

  const room = rooms.get(roomId)!;

  if (!room.gameState) {
    console.error(`Game state not found for room ${roomId}`);
    return false;
  }

  // Set game status to completed
  room.status = "completed";

  // Send game_ended event to all players
  sendToRoom(roomId, "game_ended", {
    roomId,
    winnerId,
    gameState: room.gameState,
  });

  return true;
}

// Process a player's action
export function processAction(
  roomId: string,
  playerId: string,
  action: GameActionType
): boolean {
  if (!rooms.has(roomId)) {
    console.error(`Room ${roomId} not found`);
    return false;
  }

  const room = rooms.get(roomId)!;

  if (!room.gameState) {
    console.error(`Game state not found for room ${roomId}`);
    return false;
  }

  console.log(
    `\n=== PROCESSING ACTION: ${action} for player ${playerId} in room ${roomId} ===`
  );

  // Get BeagleBoard players
  const beagleBoardPlayers = room.players.filter(
    (player) => player.playerType === "beagleboard"
  );

  // Mark this player's move as made
  room.gameState.playerMoves.set(playerId, true);

  // Determine who the opponent is
  let opponentId: string;

  // TESTING MODE: In single player mode, the opponent is the virtual one
  const isSinglePlayerMode = beagleBoardPlayers.length === 1;
  if (isSinglePlayerMode) {
    opponentId = "virtual_opponent";
    console.log(`TESTING MODE: Using virtual opponent for player ${playerId}`);
  } else {
    // Find opponent in multiplayer mode (first player that isn't the current one)
    const opponent = beagleBoardPlayers.find(
      (player) => player.id !== playerId
    );
    if (!opponent) {
      console.error(`No opponent found for player ${playerId}`);
      return false;
    }
    opponentId = opponent.id;
  }

  // Log current tower heights before the action
  const playerTowerHeight = room.gameState.towerHeights.get(playerId) || 0;
  const playerGoalHeight = room.gameState.goalHeights.get(playerId) || 0;
  const opponentTowerHeight = room.gameState.towerHeights.get(opponentId) || 0;
  const opponentGoalHeight = room.gameState.goalHeights.get(opponentId) || 0;

  console.log(`Before action:`);
  console.log(
    `- Player ${playerId}: Tower=${playerTowerHeight}/${playerGoalHeight}, Shield=${room.gameState.playerShields.get(
      playerId
    )}`
  );
  console.log(
    `- Opponent ${opponentId}: Tower=${opponentTowerHeight}/${opponentGoalHeight}, Shield=${room.gameState.playerShields.get(
      opponentId
    )}`
  );

  // Process action based on type
  switch (action) {
    case "attack":
      // If opponent has a shield, attack is blocked
      if (!room.gameState.playerShields.get(opponentId)) {
        // Attack reduces opponent's tower height by 1
        const currentHeight = room.gameState.towerHeights.get(opponentId) || 0;
        if (currentHeight > 0) {
          room.gameState.towerHeights.set(opponentId, currentHeight - 1);
          console.log(
            `Attack successful! Opponent ${opponentId}'s tower reduced from ${currentHeight} to ${
              currentHeight - 1
            }`
          );
        } else {
          console.log(
            `Attack had no effect - opponent's tower is already at 0`
          );
        }
      } else {
        console.log(`Attack blocked by opponent's shield!`);
      }
      break;

    case "defend":
      // Set player's shield to true
      room.gameState.playerShields.set(playerId, true);
      console.log(`Player ${playerId} activated shield`);
      break;

    case "build":
      // Build adds 1 to the player's tower height
      const currentHeight = room.gameState.towerHeights.get(playerId) || 0;
      room.gameState.towerHeights.set(playerId, currentHeight + 1);
      console.log(
        `Build successful! Player ${playerId}'s tower increased from ${currentHeight} to ${
          currentHeight + 1
        }`
      );
      break;
  }

  // TESTING MODE: Make virtual opponent respond if in single player mode
  if (isSinglePlayerMode) {
    // Choose a random action for the virtual opponent
    const actions: GameActionType[] = ["attack", "defend", "build"];
    const randomIndex = Math.floor(Math.random() * actions.length);
    const opponentAction = actions[randomIndex];

    console.log(`\nTESTING MODE: Virtual opponent chooses: ${opponentAction}`);

    // Mark the virtual opponent's move as complete
    room.gameState.playerMoves.set(opponentId, true);

    // Process the virtual opponent's action
    switch (opponentAction) {
      case "attack":
        // If player has a shield, attack is blocked
        if (!room.gameState.playerShields.get(playerId)) {
          // Attack reduces player's tower height by 1
          const playerHeight = room.gameState.towerHeights.get(playerId) || 0;
          if (playerHeight > 0) {
            room.gameState.towerHeights.set(playerId, playerHeight - 1);
            console.log(
              `Virtual opponent attack successful! Player ${playerId}'s tower reduced from ${playerHeight} to ${
                playerHeight - 1
              }`
            );
          }
        } else {
          console.log(`Virtual opponent attack blocked by player's shield!`);
        }
        break;

      case "defend":
        // Set opponent's shield to true
        room.gameState.playerShields.set(opponentId, true);
        console.log(`Virtual opponent activated shield`);
        break;

      case "build":
        // Build adds 1 to the opponent's tower height
        const opponentHeight = room.gameState.towerHeights.get(opponentId) || 0;
        room.gameState.towerHeights.set(opponentId, opponentHeight + 1);
        console.log(
          `Virtual opponent build successful! Tower increased from ${opponentHeight} to ${
            opponentHeight + 1
          }`
        );
        break;
    }
  }

  // Log the updated tower heights after actions
  const updatedPlayerTowerHeight =
    room.gameState.towerHeights.get(playerId) || 0;
  const updatedOpponentTowerHeight =
    room.gameState.towerHeights.get(opponentId) || 0;

  console.log(`\nAfter all actions:`);
  console.log(
    `- Player ${playerId}: Tower=${updatedPlayerTowerHeight}/${playerGoalHeight}, Shield=${room.gameState.playerShields.get(
      playerId
    )}`
  );
  console.log(
    `- Opponent ${opponentId}: Tower=${updatedOpponentTowerHeight}/${opponentGoalHeight}, Shield=${room.gameState.playerShields.get(
      opponentId
    )}`
  );

  // Send immediate update of game state to all clients
  sendToRoom(roomId, "game_state_update", {
    roomId,
    gameState: room.gameState,
  });

  // Check if all players have made their moves
  let allMovesMade = true;
  room.gameState.playerMoves.forEach((moveMade) => {
    if (!moveMade) allMovesMade = false;
  });

  // If all players have made their moves, end the round early
  if (allMovesMade) {
    console.log(
      `All players have submitted gestures in room ${roomId}, ending round`
    );

    endRound(roomId);
  }

  return true;
}
