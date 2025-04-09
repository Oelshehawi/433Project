import WebSocket from 'ws';
import net from 'net';

// Client message types
export type ClientEventType =
  | 'create_room'
  | 'join_room'
  | 'leave_room'
  | 'room_list'
  | 'player_ready'
  | 'game_started'
  | 'gesture_event'
  | 'beagleboard_command'
  | 'get_room'
  | 'get_game_state'
  | 'round_end_ack'
  | 'next_round_ready'
  | 'game_ready';

// Server message types
export type ServerEventType =
  | 'room_updated'
  | 'room_list'
  | 'room_data'
  | 'player_ready'
  | 'game_started'
  | 'game_starting'
  | 'game_ended'
  | 'error'
  | 'gesture_event'
  | 'gesture_batch'
  | 'turn_start'
  | 'turn_end'
  | 'round_start'
  | 'round_end'
  | 'game_state_update'
  | 'beagle_board_command'
  | 'move_status'
  | 'round_end_ack'
  | 'next_round_ready'
  | 'room_created'
  | 'room_joined'
  | 'room_left'
  | 'pong';

// WebSocket client extended with custom properties
export interface ExtendedWebSocket extends WebSocket {
  id: string;
  isAlive: boolean;
  roomId?: string;
  playerId?: string;
  playerName?: string;
  deviceId?: string;
  playerType?: string;
  pingTimeout?: NodeJS.Timeout;
}

// Player definition
export interface Player {
  id: string;
  name: string;
  isReady: boolean;
  connected: boolean;
  playerType: 'beagleboard' | 'webviewer';
}

// Room definition
export interface Room {
  id: string;
  name: string;
  createdAt: number;
  hostId: string;
  players: Player[];
  status: 'waiting' | 'playing' | 'ended' | 'completed';
  maxPlayers: number;
  playerCards?: Map<string, PlayerCards>; // Map player IDs to their cards
  gameState?: GameState; // Game state for tower building game
  currentTurn?: string; // Player ID whose turn it is
}

// Room list item for summary information
export interface RoomListItem {
  id: string;
  name: string;
  playerCount: number;
  maxPlayers: number;
  status: Room['status'];
}

// Gesture types
export type GestureType =
  | 'rightHandRaise'
  | 'tPose'
  | 'handsAboveHead'
  | 'diagonalArms'
  | 'handWave'
  | 'armsCrossed'
  | 'pushMotion'
  | 'punchMotion'
  | 'karateChop'
  | 'circularArm'
  | 'clapHands'
  | 'squatMotion'
  | 'weatherShield'
  | 'spinAround'
  | 'Thumbs Up'
  | 'Thumbs Down'
  | 'Wave';

// WebSocket message format
export interface WebSocketMessage {
  event: ClientEventType | ServerEventType;
  payload: any;
}

// Payload types for different messages
export interface CreateRoomPayload {
  room: Room;
  playerId: string;
}

export interface JoinRoomPayload {
  roomId: string;
  playerId: string;
  playerName: string;
  playerType?: string;
}

export interface LeaveRoomPayload {
  roomId: string;
  playerId?: string;
}

export interface PlayerReadyPayload {
  roomId: string;
  playerId: string;
  isReady: boolean;
}

export interface GameStartedPayload {
  roomId: string;
}

// Game action types for gesture recognition
export type GameActionType = 'attack' | 'defend' | 'build';

// Game state for tower building game
export interface GameState {
  towerHeights: Map<string, number>;
  goalHeights: Map<string, number>;
  playerShields: Map<string, boolean>;
  playerMoves: Map<string, boolean>;
  roundNumber: number;
}

// Card definition
export interface Card {
  id: string;
  type: GameActionType;
  name: string;
  description: string;
}

// Player cards
export interface PlayerCards {
  playerId: string;
  cards: Card[];
}

// Add new payload types for card actions
export interface CardDistributionPayload {
  playerId: string;
  cards: Card[];
}

export interface CardActionPayload {
  playerId: string;
  cardId: string;
  action: GameActionType;
}

// Update GestureEventPayload
export interface GestureEventPayload {
  playerId: string;
  gesture: GameActionType | GestureType;
  confidence: number;
  cardId?: string; // Optional card ID used for the gesture
  roomId: string; // Add roomId property
  roundNumber?: number; // Add optional roundNumber property
  timestamp?: number; // Add optional timestamp property
}

// New gesture batch payload
export interface GestureBatchPayload {
  roomId: string;
  roundNumber: number;
  gestures: {
    playerId: string;
    gesture: GameActionType | GestureType;
    confidence: number;
    cardId?: string;
    timestamp: number;
  }[];
  timestamp: number;
}

export interface ErrorPayload {
  error: string;
}

// New Beagle board command payload type
export interface BeagleBoardCommandPayload {
  message: string;
  sender: string;
  port: number;
  timestamp: number;
}

export type BeagleBoard = {
  deviceId: string;
  roomId?: string;
  playerName?: string;
  socket?: net.Socket;
  client?: ExtendedWebSocket;
};

// Update the beagleBoards map type
export type BeagleBoardsMap = Map<string, BeagleBoard>;

// Add new payload types for game state events
export interface TurnStartPayload {
  roomId: string;
  playerId: string; // Player whose turn it is
  remainingTime: number; // Time in milliseconds
}

export interface TurnEndPayload {
  roomId: string;
  nextPlayerId: string; // Next player's turn
  gameState: GameState; // Updated game state
}

export interface GameEndedPayload {
  roomId: string;
  winnerId: string;
  gameState: GameState;
}

// Add a new payload type for move status responses
export interface MoveStatusPayload {
  status: 'accepted' | 'rejected';
  reason?: string;
  roundNumber: number;
}

// Add a new payload type for next round ready signal
export interface NextRoundReadyPayload {
  roomId: string;
  roundNumber: number; // To ensure we're talking about the correct round
}

// Add new payload type
export interface RoundEndAckPayload {
  roomId: string;
  playerId: string;
  roundNumber: number;
}
