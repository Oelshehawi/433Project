import {
  GameState,
  GameActionType,
  ServerEventType,
} from './types';
import { rooms, webClientNextRoundReadyRooms } from './roomManager';
import { sendToRoom} from './messaging';
import WebSocket from 'ws';

// Constants for game configuration
const MIN_GOAL_HEIGHT = 5;
const MAX_GOAL_HEIGHT = 10;
// Normal gameplay requires 2 players
export const MIN_REQUIRED_PLAYERS = 2;

// Track pending gestures for each room and round
interface PendingGesture {
  playerId: string;
  gesture: GameActionType;
  confidence: number;
  cardId?: string;
}

// Map of roomId -> roundNumber -> array of pending gestures
const pendingGestures = new Map<string, Map<number, PendingGesture[]>>();

// Initialize game state for a room
export function initializeGameState(roomId: string): boolean {
  if (!rooms.has(roomId)) {
    console.error(`Room ${roomId} not found`);
    return false;
  }

  const room = rooms.get(roomId)!;

  // Only initialize if game is starting
  if (room.status !== 'playing') {
    console.error(`Room ${roomId} is not in playing state`);
    return false;
  }

  // Get only beagleboard players
  const beagleBoardPlayers = room.players.filter(
    (player) => player.playerType === 'beagleboard'
  );

  // Check if we have enough players
  if (beagleBoardPlayers.length < MIN_REQUIRED_PLAYERS) {
    console.error(
      `Not enough players in room ${roomId}. Minimum ${MIN_REQUIRED_PLAYERS} player(s) required.`
    );
    return false;
  }

  // Create new game state
  const gameState: GameState = {
    towerHeights: new Map(),
    goalHeights: new Map(),
    roundNumber: 1,
    playerShields: new Map(),
    playerMoves: new Map(),
  };

  console.log(`\n=== INITIALIZING GAME STATE FOR ROOM ${roomId} ===`);
  console.log(
    `MIN_GOAL_HEIGHT: ${MIN_GOAL_HEIGHT}, MAX_GOAL_HEIGHT: ${MAX_GOAL_HEIGHT}`
  );

  console.log(`beagleBoardPlayers: ${beagleBoardPlayers}`);
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

  // Save game state to room
  room.gameState = gameState;

  // Send initial game state update to all clients
  console.log(`Sending initial game state update for room ${roomId}`);

  // Convert Maps to objects for sending over WebSocket
  const gameStateForSending = {
    towerHeights: Object.fromEntries(gameState.towerHeights),
    goalHeights: Object.fromEntries(gameState.goalHeights),
    roundNumber: gameState.roundNumber,
    playerShields: Object.fromEntries(gameState.playerShields),
    playerMoves: Object.fromEntries(gameState.playerMoves),
  };

  sendToRoom(roomId, 'game_state_update', {
    roomId,
    gameState: gameStateForSending,
    message: 'Game initialized, waiting for web client ready signal',
  });

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

 
  // First, create a new empty Map
  room.gameState.playerMoves = new Map();

  // Get all players
  const beagleBoardPlayers = room.players.filter(
    (player) => player.playerType === 'beagleboard'
  );

  // Initialize all real players as not having moved
  beagleBoardPlayers.forEach((player) => {
    console.log(
      `Resetting move status for player ${player.id} to false for round ${room?.gameState?.roundNumber}`
    );
    room.gameState!.playerMoves.set(player.id, false);
  });

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
      playerShields: Object.fromEntries(room.gameState.playerShields),
      playerMoves: Object.fromEntries(room.gameState.playerMoves),
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
  sendToRoom(roomId, 'round_start', payload);
  console.log(`Sent round_start with included cards for room ${roomId}`);


  console.log(
    `=========== ROUND ${room.gameState.roundNumber} STARTED ===========\n`
  );

  return true;
}

// End the current round and check if the game should continue
export function endRound(roomId: string): boolean {
  if (!rooms.has(roomId)) {
    console.error(`[gameManager.ts] Room ${roomId} not found`);
    return false;
  }

  const room = rooms.get(roomId)!;

  if (!room.gameState) {
    console.error(`[gameManager.ts] Game state not found for room ${roomId}`);
    return false;
  }

  console.log(
    `[gameManager.ts] Ending round ${room.gameState.roundNumber} in room ${roomId}`
  );

  // Check if anyone has reached their goal
  const { winningPlayerId, shouldContinue } = checkWinCondition(roomId);

  console.log(
    `[gameManager.ts] Sending round_end event for round ${room.gameState.roundNumber}`
  );


  console.log(
    `[gameManager.ts] Not sending round_end to web clients - they only handle round_end_ack`
  );

  // If the game should continue, start the next round
  if (shouldContinue) {
    // Increment round number for the next round
    room.gameState.roundNumber++;
    const nextRoundNumber = room.gameState.roundNumber;

    console.log(
      `[gameManager.ts] Preparing for round ${nextRoundNumber} in room ${roomId}`
    );

    // Check if the web client is already ready for the next round
    if (
      webClientNextRoundReadyRooms.has(roomId) &&
      webClientNextRoundReadyRooms.get(roomId) === nextRoundNumber
    ) {
      console.log(
        `[gameManager.ts] Web client already ready for round ${nextRoundNumber}, starting immediately`
      );
      // Web client is already ready, start the round immediately
      webClientNextRoundReadyRooms.delete(roomId);
      startRound(roomId);
    } else {
      // Web client is not ready yet, wait for the next_round_ready event
      console.log(
        `[gameManager.ts] Waiting for web client to be ready for round ${nextRoundNumber}`
      );

      // Send a notification that server is waiting for web client
      sendToRoom(roomId, 'game_state_update' as ServerEventType, {
        roomId,
        gameState: {
          towerHeights: Object.fromEntries(room.gameState.towerHeights),
          goalHeights: Object.fromEntries(room.gameState.goalHeights),
          roundNumber: room.gameState.roundNumber,
          playerShields: Object.fromEntries(room.gameState.playerShields),
          playerMoves: Object.fromEntries(room.gameState.playerMoves),
        },
        message: `Waiting for web client to be ready for round ${nextRoundNumber}`,
        waitingForNextRound: true,
      });
    }
  } else {
    // Game has ended with a winner
    if (winningPlayerId) {
      console.log(
        `[gameManager.ts] Game ended with winner: ${winningPlayerId}`
      );
      endGame(roomId, winningPlayerId);
    } else {
      console.error(
        `[gameManager.ts] Game ended without a winner in room ${roomId}`
      );
    }
  }

  return true;
}

// Check if any player has reached their goal height
export function checkWinCondition(roomId: string): {
  winningPlayerId: string | null;
  shouldContinue: boolean;
} {
  if (!rooms.has(roomId)) {
    console.error(`Room ${roomId} not found`);
    return { winningPlayerId: null, shouldContinue: false };
  }

  const room = rooms.get(roomId)!;

  if (!room.gameState) {
    console.error(`Game state not found for room ${roomId}`);
    return { winningPlayerId: null, shouldContinue: false };
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
      return { winningPlayerId: playerId, shouldContinue: true };
    }
  }

  // Nobody has reached their goal height yet
  return { winningPlayerId: null, shouldContinue: true };
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
  room.status = 'completed';

  // Get winner's name
  let winnerName = 'Unknown Player';
  const winner = room.players.find((player) => player.id === winnerId);
  if (winner) {
    winnerName = winner.name;
  }

  console.log(
    `[gameManager.ts] Game ended in room ${roomId}. Winner: ${winnerName} (${winnerId})`
  );

  // Convert game state Maps to objects for sending
  const gameStateForSending = {
    towerHeights: Object.fromEntries(room.gameState.towerHeights),
    goalHeights: Object.fromEntries(room.gameState.goalHeights),
    roundNumber: room.gameState.roundNumber,
  };

  // Send game_ended event to all players
  sendToRoom(roomId, 'game_ended', {
    roomId,
    winnerId,
    winnerName,
    gameState: gameStateForSending,
  });

  // After 30 seconds, reset the room to waiting state for a new game
  setTimeout(() => {
    if (rooms.has(roomId)) {
      const currentRoom = rooms.get(roomId)!;

      console.log(`[gameManager.ts] Resetting room ${roomId} to waiting state`);

      // Reset all player ready states
      currentRoom.players.forEach((player) => {
        player.isReady = false;
      });

      // Clear game state
      currentRoom.gameState = undefined;
      currentRoom.playerCards = undefined;

      // Set status back to waiting
      currentRoom.status = 'waiting';

      // Update room in the map
      rooms.set(roomId, currentRoom);

      // Notify all clients about the room reset
      sendToRoom(roomId, 'room_updated', { room: currentRoom });
    }
  }, 30000); // 30 seconds

  return true;
}

// Process a gesture action from a player
export function processAction(
  roomId: string,
  playerId: string,
  action: GameActionType,
  confidence: number,
  cardId?: string
): boolean {
  if (!rooms.has(roomId)) {
    console.error(`[gameManager.ts] Room ${roomId} not found`);
    return false;
  }

  const room = rooms.get(roomId)!;

  if (!room.gameState) {
    console.error(`[gameManager.ts] Game state not found for room ${roomId}`);
    return false;
  }

  const currentRound = room.gameState.roundNumber;
  console.log(
    `[gameManager.ts] Processing action for player ${playerId} in room ${roomId}, round ${currentRound}`
  );

  // Add gesture to pending gestures
  if (!pendingGestures.has(roomId)) {
    pendingGestures.set(roomId, new Map());
  }

  const roomGestures = pendingGestures.get(roomId)!;

  if (!roomGestures.has(currentRound)) {
    roomGestures.set(currentRound, []);
  }

  const roundGestures = roomGestures.get(currentRound)!;

  // Check if this player already submitted a gesture for this round
  const existingGestureIdx = roundGestures.findIndex(
    (g) => g.playerId === playerId
  );

  // Create the gesture object
  const gestureData: PendingGesture = {
    playerId,
    gesture: action,
    confidence,
    cardId,
  };

  // If the player already submitted a gesture, replace it
  if (existingGestureIdx >= 0) {
    roundGestures[existingGestureIdx] = gestureData;
    console.log(
      `[gameManager.ts] Updated gesture for player ${playerId} in round ${currentRound}`
    );
  } else {
    // Otherwise add the new gesture
    roundGestures.push(gestureData);
    console.log(
      `[gameManager.ts] Added new gesture for player ${playerId} in round ${currentRound}`
    );
  }

  // Get the expected number of gestures based on players in the room
  const beagleBoardPlayers = room.players.filter(
    (player) => player.playerType === 'beagleboard'
  );

  // We expect one gesture from each real player
  const expectedGestures = beagleBoardPlayers.length;

  console.log(
    `[gameManager.ts] Have ${roundGestures.length}/${expectedGestures} gestures for round ${currentRound}`
  );

  // If we've received all expected gestures, process them all at once
  if (roundGestures.length >= expectedGestures) {
    console.log(
      `[gameManager.ts] All ${expectedGestures} gestures received for round ${currentRound}, processing actions`
    );

    // Track players who already moved in this round
    const playersMoved = new Set<string>();
    // Store all gesture details for reference
    const gestureDetails = [] as Array<{
      playerId: string;
      gesture: string;
      confidence: number;
      cardId?: string;
      timestamp: number;
    }>;

    // Process all gestures
    roundGestures.forEach((gesture) => {
      // Apply gameplay mechanics
      applyGestureEffect(
        roomId,
        gesture.playerId,
        gesture.gesture,
        gesture.cardId
      );

      // Mark this player as having moved
      playersMoved.add(gesture.playerId);

      // Save gesture details for reference
      gestureDetails.push({
        playerId: gesture.playerId,
        gesture: gesture.gesture,
        confidence: gesture.confidence,
        cardId: gesture.cardId,
        timestamp: Date.now(), // Add timestamp
      });
    });

    // Log all the gestures received and processed
    console.log(
      `[gameManager.ts] Processed gestures for round ${currentRound}:`,
      gestureDetails
    );

    // Mark all players who moved
    playersMoved.forEach((playerId) => {
      room.gameState!.playerMoves.set(playerId, true);
    });

    sendToRoom(roomId, 'gesture_batch' as ServerEventType, {
      roomId,
      roundNumber: currentRound,
      gestures: gestureDetails,
      timestamp: Date.now(),
    });

    // Send updated game state to clients with detailed gesture information
    sendToRoom(roomId, 'game_state_update' as ServerEventType, {
      roomId,
      gameState: {
        towerHeights: Object.fromEntries(room.gameState.towerHeights),
        goalHeights: Object.fromEntries(room.gameState.goalHeights),
        roundNumber: room.gameState.roundNumber,
        playerShields: Object.fromEntries(room.gameState.playerShields),
        playerMoves: Object.fromEntries(room.gameState.playerMoves),
      },
      message: 'All players have submitted their gestures',
      allGesturesReceived: true,
      playerGestureSummary: gestureDetails,
    });

    // Check if all players have moved
    const allPlayersCompleted = Array.from(
      room.gameState.playerMoves.values()
    ).every((moved) => moved);

    // The web client will send round_end after receiving and processing all gestures
    if (allPlayersCompleted) {
      console.log(
        `[gameManager.ts] All players have moved in round ${currentRound}, waiting for web client to signal round_end`
      );
    }

    return true;
  }

  // If not all gestures are collected yet, return true but don't process actions yet
  return true;
}

function applyGestureEffect(
  roomId: string,
  playerId: string,
  action: GameActionType,
  cardId?: string
): void {
  if (!rooms.has(roomId)) {
    console.error(`[gameManager.ts] Room ${roomId} not found`);
    return;
  }

  const room = rooms.get(roomId)!;

  if (!room.gameState) {
    console.error(`[gameManager.ts] Game state not found for room ${roomId}`);
    return;
  }

  console.log(
    `[gameManager.ts] Applying effect for ${action} from player ${playerId}`
  );

  // Get all players
  const beagleBoardPlayers = room.players.filter(
    (player) => player.playerType === 'beagleboard'
  );

  // Get the target player ID (the opponent)
  let targetPlayerId: string | null = null;

  // Find the opponent (the player that isn't the current player)
  targetPlayerId =
    beagleBoardPlayers.find((p) => p.id !== playerId)?.id || null;

  if (!targetPlayerId) {
    console.error(
      `[gameManager.ts] No target player found for action from ${playerId}`
    );
    return;
  }

  // Apply the action based on type
  switch (action) {
    case 'attack':
      // If target has a shield, attack is blocked
      if (room.gameState.playerShields.get(targetPlayerId)) {
        console.log(
          `[gameManager.ts] Attack blocked by shield for player ${targetPlayerId}`
        );
        // The shield blocks the attack and is consumed
        room.gameState.playerShields.set(targetPlayerId, false);
      } else {
        // If no shield, reduce target's tower height by 1 (minimum 0)
        const currentHeight =
          room.gameState.towerHeights.get(targetPlayerId) || 0;
        const newHeight = Math.max(0, currentHeight - 1);
        room.gameState.towerHeights.set(targetPlayerId, newHeight);
        console.log(
          `[gameManager.ts] Reduced tower height for ${targetPlayerId} from ${currentHeight} to ${newHeight}`
        );
      }
      break;

    case 'defend':
      // Activate shield for the player
      room.gameState.playerShields.set(playerId, true);
      console.log(`[gameManager.ts] Shield activated for player ${playerId}`);
      break;

    case 'build':
      // Increase tower height by 1
      const currentHeight = room.gameState.towerHeights.get(playerId) || 0;
      const newHeight = currentHeight + 1;
      room.gameState.towerHeights.set(playerId, newHeight);
      console.log(
        `[gameManager.ts] Increased tower height for ${playerId} from ${currentHeight} to ${newHeight}`
      );
      break;

    default:
      console.warn(`[gameManager.ts] Unknown action type: ${action}`);
  }
}
