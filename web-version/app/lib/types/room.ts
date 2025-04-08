/**
 * Room and lobby related types
 */
import { Player } from './common';

// Room status enum
export type RoomStatus = 'waiting' | 'playing' | 'ended';

// Full room interface with all details
export interface Room {
  id: string;
  name: string;
  hostId: string;
  maxPlayers: number;
  players: Player[];
  status: RoomStatus;
  createdAt: number;
}

// Simplified room data for room listings
export interface RoomListItem {
  id: string;
  name: string;
  playerCount: number;
  maxPlayers: number;
  status: RoomStatus;
}

// Parameters for room actions
export interface CreateRoomParams {
  name: string;
  playerName?: string;
}

export interface JoinRoomParams {
  roomId: string;
  playerName: string;
  playerType?: 'webviewer' | 'beagleboard';
}

// WebSocket events and payloads for room operations
export type RoomSocketEventType =
  | 'create_room'
  | 'join_room'
  | 'leave_room'
  | 'room_list'
  | 'room_updated'
  | 'player_ready'
  | 'game_started'
  | 'game_starting';

export interface RoomUpdatedPayload {
  room: Room;
}

export interface RoomListPayload {
  rooms: Room[];
}

export interface PlayerReadyPayload {
  roomId: string;
  playerId: string;
  isReady: boolean;
}

export interface GameStartedPayload {
  roomId: string;
}

export interface LeaveRoomPayload {
  roomId: string;
}

export interface RoomStore {
  // Room state
  currentRoom: Room | null;
  availableRooms: RoomListItem[];
  loading: boolean;
  error: string | null;
  gameStarting: boolean;
  gameStartTimestamp: number | null;

  // Room actions
  initialize: () => Promise<boolean>;
  createRoom: (params: CreateRoomParams) => Promise<void>;
  joinRoom: (params: JoinRoomParams) => Promise<void>;
  leaveRoom: () => Promise<void>;
  setPlayerReady: (isReady: boolean) => Promise<void>;
  fetchRooms: () => Promise<void>;
  startGame: () => Promise<void>;
  clearError: () => void;
}
