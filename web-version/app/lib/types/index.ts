/**
 * Export all types from a single entry point for convenience
 */

// Export from common types
export * from "./common";

// Export from room types
export * from "./room";

// Export from game types
export * from "./game";
export { GESTURES } from "./game";

// Game configuration with consolidated constants
export const GAME_CONFIG = {
  // Room settings
  MAX_PLAYERS: 2,

  // Game settings
  ROUND_DURATION: 10, // seconds
  MAX_ROUNDS: 5,
  TIME_LIMIT_SECONDS: 180, // 3 minutes
  GOAL_HEIGHT_UNITS: 15,
  HAND_SIZE: 5,
  INITIAL_CARDS: 4,

  // Phase timing
  PHASE_DURATIONS: {
    planning: 5, // seconds
    action: 5,
    building: 3,
    climbing: 2,
    drawing: 1,
  },

  // UI dimensions
  TOWER_WIDTH: 300, // pixels
  TOWER_BASE_HEIGHT: 50, // pixels
};

export interface BeagleBoardCommandPayload {
  message: string;
  sender: string;
  port?: number;
  timestamp: number;
}
