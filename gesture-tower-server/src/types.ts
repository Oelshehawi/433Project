import WebSocket from 'ws';

// Client message types
export type ClientEventType =
  | 'create_room'
  | 'join_room'
  | 'leave_room'
  | 'room_list'
  | 'player_ready'
  | 'game_started'
  | 'gesture_event';

// Server message types
export type ServerEventType =
  | 'room_updated'
  | 'room_list'
  | 'player_ready'
  | 'game_started'
  | 'game_ended'
  | 'error'
  | 'gesture_event'
  | 'udp_message'
  | 'beagle_board_command';

// WebSocket client extended with custom properties
export interface ExtendedWebSocket extends WebSocket {
  id: string;
  roomId?: string;
  playerId?: string;
  playerName?: string;
  isAlive: boolean;
}

// Player definition
export interface Player {
  id: string;
  name: string;
  isReady: boolean;
  connected: boolean;
}

// Room definition
export interface Room {
  id: string;
  name: string;
  createdAt: number;
  hostId: string;
  players: Player[];
  status: 'waiting' | 'playing' | 'ended';
  maxPlayers: number;
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

export interface GestureEventPayload {
  playerId: string;
  gesture: GestureType;
  confidence: number;
}

export interface ErrorPayload {
  error: string;
}

// UDP message payload type
export interface UdpMessagePayload {
  message: string;
  timestamp: number;
}

// New Beagle board command payload type
export interface BeagleBoardCommandPayload {
  message: string;
  sender: string;
  port: number;
  timestamp: number;
}
