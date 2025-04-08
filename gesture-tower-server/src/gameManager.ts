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
  });

  // In TEST MODE, set up virtual opponent
  if (useTestMode) {
    const virtualOpponentId = "virtual_opponent";
    gameState.towerHeights.set(virtualOpponentId, 0);
    gameState.goalHeights.set(
      virtualOpponentId,
      Math.floor(
        Math.random() * (MAX_GOAL_HEIGHT - MIN_GOAL_HEIGHT + 1) +
          MIN_GOAL_HEIGHT
      )
    );
    gameState.playerShields.set(virtualOpponentId, false);
    gameState.playerMoves.set(virtualOpponentId, false);

    console.log(
      `Virtual opponent initialized with goal height: ${gameState.goalHeights.get(
        virtualOpponentId
      )}`
    );
  }

  // Save game state to room
  room.gameState = gameState;

  // Start the first round - this will also send cards via round_start
  console.log(`Starting first round for room ${roomId}`);
  startRound(roomId);

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

  // Reset player moves for the new round
  room.gameState.playerMoves.forEach((_, playerId) => {
    room.gameState!.playerMoves.set(playerId, false);
  });

  // Get BeagleBoard players
  const beagleBoardPlayers = room.players.filter(
    (player) => player.playerType === "beagleboard"
  );

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
    console.error(
      `ERROR: room.playerCards is not initialized for room ${roomId}!`
    );
  }

  // Debug: Log the payload we're about to send
  const payload = {
    roomId,
    roundNumber: room.gameState.roundNumber,
    playerCards: playerCards,
  };

  console.log(
    `Creating round_start payload with size ~${
      JSON.stringify(payload).length
    } bytes`
  );
  console.log(
    `Payload contains cards for ${Object.keys(playerCards).length} players`
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

  // Check if any player has reached their goal height
  for (const [playerId, towerHeight] of room.gameState.towerHeights.entries()) {
    const goalHeight = room.gameState.goalHeights.get(playerId) || 0;
    if (towerHeight >= goalHeight) {
      return playerId;
    }
  }

  // Get real players (not virtual opponent)
  const beagleBoardPlayers = room.players.filter(
    (player) => player.playerType === "beagleboard"
  );

  // TESTING MODE: Handle virtual opponent for tower reduction to 0
  if (beagleBoardPlayers.length === 1) {
    const realPlayer = beagleBoardPlayers[0];
    const realPlayerHeight =
      room.gameState.towerHeights.get(realPlayer.id) || 0;
    const virtualOpponentHeight =
      room.gameState.towerHeights.get("virtual_opponent") || 0;

    // If real player's tower is reduced to 0, virtual opponent wins
    if (realPlayerHeight <= 0) {
      console.log(
        `TESTING MODE: Player ${realPlayer.name} lost - tower height is 0`
      );
      return "virtual_opponent";
    }

    // If virtual opponent's tower is reduced to 0, real player wins
    if (virtualOpponentHeight <= 0) {
      console.log(`TESTING MODE: Virtual opponent lost - tower height is 0`);
      return realPlayer.id;
    }

    return null;
  }

  // Regular multiplayer mode - check if any player's tower has been reduced to 0
  for (const player of beagleBoardPlayers) {
    const towerHeight = room.gameState.towerHeights.get(player.id) || 0;
    if (towerHeight <= 0) {
      // The player with the remaining tower wins
      const opponent = beagleBoardPlayers.find((p) => p.id !== player.id);
      if (opponent) {
        return opponent.id;
      }
    }
  }

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

  // Mark this player's move as complete
  room.gameState.playerMoves.set(playerId, true);
  console.log(`Player ${playerId} submitted action: ${action}`);

  // Get the opponent's player ID
  const beagleBoardPlayers = room.players.filter(
    (player) => player.playerType === "beagleboard"
  );

  let opponentId: string;
  let isSinglePlayerMode = false;

  if (beagleBoardPlayers.length >= 2) {
    // Regular multiplayer mode
    const opponentPlayer = beagleBoardPlayers.find(
      (player) => player.id !== playerId
    );

    if (!opponentPlayer) {
      console.error(`Opponent not found for player ${playerId}`);
      return false;
    }

    opponentId = opponentPlayer.id;
  } else {
    // TESTING MODE: Single player with virtual opponent
    opponentId = "virtual_opponent";
    isSinglePlayerMode = true;
    console.log(`TESTING MODE: Using virtual opponent for player ${playerId}`);
  }

  // Process action based on type
  switch (action) {
    case "attack":
      // If opponent has a shield, attack is blocked
      if (!room.gameState.playerShields.get(opponentId)) {
        // Attack reduces opponent's tower height by 1
        const currentHeight = room.gameState.towerHeights.get(opponentId) || 0;
        if (currentHeight > 0) {
          room.gameState.towerHeights.set(opponentId, currentHeight - 1);
        }
      }
      break;

    case "defend":
      // Set player's shield to true
      room.gameState.playerShields.set(playerId, true);
      break;

    case "build":
      // Build adds 1 to the player's tower height
      const currentHeight = room.gameState.towerHeights.get(playerId) || 0;
      room.gameState.towerHeights.set(playerId, currentHeight + 1);
      break;
  }

  // TESTING MODE: Make virtual opponent respond if in single player mode
  if (isSinglePlayerMode) {
    // Choose a random action for the virtual opponent
    const actions: GameActionType[] = ["attack", "defend", "build"];
    const randomIndex = Math.floor(Math.random() * actions.length);
    const opponentAction = actions[randomIndex];

    console.log(`TESTING MODE: Virtual opponent chooses: ${opponentAction}`);

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
          }
        }
        break;

      case "defend":
        // Set opponent's shield to true
        room.gameState.playerShields.set(opponentId, true);
        break;

      case "build":
        // Build adds 1 to the opponent's tower height
        const opponentHeight = room.gameState.towerHeights.get(opponentId) || 0;
        room.gameState.towerHeights.set(opponentId, opponentHeight + 1);
        break;
    }
  }

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
