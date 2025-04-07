import { GameState, Room, Player, GameActionType } from "./types";
import { rooms } from "./roomManager";
import { sendToRoom } from "./messaging";

// Constants for game configuration
const MIN_GOAL_HEIGHT = 5;
const MAX_GOAL_HEIGHT = 10;
const TURN_DURATION_MS = 30000; // 30 seconds

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

  if (beagleBoardPlayers.length < 2) {
    console.error(`Not enough players in room ${roomId}`);
    return false;
  }

  // Create new game state
  const gameState: GameState = {
    towerHeights: new Map(),
    goalHeights: new Map(),
    currentTurn: "",
    turnStartTime: 0,
    turnDuration: TURN_DURATION_MS,
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

  // Randomly select first player
  const startingPlayerIndex = Math.floor(
    Math.random() * beagleBoardPlayers.length
  );
  gameState.currentTurn = beagleBoardPlayers[startingPlayerIndex].id;

  // Save game state to room
  room.gameState = gameState;

  // Start the first turn
  startTurn(roomId);

  return true;
}

// Start a new turn
export function startTurn(roomId: string): boolean {
  if (!rooms.has(roomId)) {
    console.error(`Room ${roomId} not found`);
    return false;
  }

  const room = rooms.get(roomId)!;

  if (!room.gameState) {
    console.error(`Game state not found for room ${roomId}`);
    return false;
  }

  // Set turn start time
  room.gameState.turnStartTime = Date.now();

  // Reset player moves for the new turn
  room.gameState.playerMoves.forEach((_, playerId) => {
    room.gameState!.playerMoves.set(playerId, false);
  });

  // Send turn start event to all players
  sendToRoom(roomId, "turn_start", {
    roomId,
    playerId: room.gameState.currentTurn,
    remainingTime: TURN_DURATION_MS,
  });

  // Set up timer to end turn automatically after TURN_DURATION_MS
  setTimeout(() => {
    // Check if the turn is still active
    if (rooms.has(roomId) && room.gameState?.turnStartTime) {
      const currentTime = Date.now();
      const elapsedTime = currentTime - room.gameState.turnStartTime;

      // Only end the turn if enough time has passed
      if (elapsedTime >= TURN_DURATION_MS) {
        // End turn automatically if time is up
        endTurn(roomId);
      }
    }
  }, TURN_DURATION_MS + 100); // Add 100ms buffer

  return true;
}

// End the current turn and start the next one
export function endTurn(roomId: string): boolean {
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

  // Find the current player's index
  const currentPlayerIndex = beagleBoardPlayers.findIndex(
    (player) => player.id === room.gameState!.currentTurn
  );

  // Determine the next player
  const nextPlayerIndex = (currentPlayerIndex + 1) % beagleBoardPlayers.length;
  const nextPlayerId = beagleBoardPlayers[nextPlayerIndex].id;

  // Update current turn
  room.gameState.currentTurn = nextPlayerId;

  // Reset player shields for the next turn
  room.gameState.playerShields.forEach((_, playerId) => {
    room.gameState!.playerShields.set(playerId, false);
  });

  // Send turn end event
  sendToRoom(roomId, "turn_end", {
    roomId,
    nextPlayerId,
    gameState: room.gameState,
  });

  // Check for win condition
  const winner = checkWinCondition(roomId);
  if (winner) {
    // End the game
    endGame(roomId, winner);
    return true;
  }

  // Start next turn
  startTurn(roomId);

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

  return null;
}

// End the game with a winner
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

  // Update game state
  room.gameState.winner = winnerId;
  room.status = "ended";

  // Send game ended event
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

  // Get the opponent's player ID
  const beagleBoardPlayers = room.players.filter(
    (player) => player.playerType === "beagleboard"
  );
  const opponentPlayer = beagleBoardPlayers.find(
    (player) => player.id !== playerId
  );

  if (!opponentPlayer) {
    console.error(`Opponent not found for player ${playerId}`);
    return false;
  }

  const opponentId = opponentPlayer.id;

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

  // Check if all players have made their moves
  let allMovesMade = true;
  room.gameState.playerMoves.forEach((moveMade) => {
    if (!moveMade) allMovesMade = false;
  });

  // If all players have made their moves, end the turn early
  if (allMovesMade) {
    endTurn(roomId);
  }

  return true;
}
