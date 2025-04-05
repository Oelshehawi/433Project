/**
 * Common types shared across the application
 */

// Basic player information
export interface Player {
  id: string;
  name: string;
  isReady: boolean;
  connected: boolean;
  playerType?: "beagleboard" | "webviewer";
}

// Basic event types for custom events
export interface NavigationEvent extends CustomEvent {
  detail: {
    roomId: string;
  };
}

export interface NavigateToRoomEvent extends NavigationEvent {
  detail: {
    roomId: string;
    playerId: string;
    playerName: string;
  };
}

// Standard API response shape
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Custom event types for WebSocket
export type WebSocketEventName =
  | "room_updated"
  | "room_list"
  | "player_ready"
  | "game_started"
  | "game_starting"
  | "error"
  | "gesture_event"
  | "navigate_to_room"
  | "navigate_to_game";

export interface ErrorPayload {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}
