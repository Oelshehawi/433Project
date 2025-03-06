/**
 * Game mechanics and gesture types
 */
import { Player } from './common';

export type GestureType = string; 

// More specific gesture types for reference
export const GESTURES = {
  // Basic building gestures
  RIGHT_HAND_RAISE: 'rightHandRaise', // Small block (1 unit)
  T_POSE: 'tPose', // Medium block (2 units)
  HANDS_ABOVE_HEAD: 'handsAboveHead', // Tall column (3 units)
  DIAGONAL_ARMS: 'diagonalArms', // Bridge block (horizontal)

  // Special abilities
  HAND_WAVE: 'handWave', // Jump boost
  ARMS_CROSSED: 'armsCrossed', // Defensive shield
  PUSH_MOTION: 'pushMotion', // Stabilize tower
  PUNCH_MOTION: 'punchMotion', // Attack: removes 1 unit
  KARATE_CHOP: 'karateChop', // Attack: weakens next block
  CIRCULAR_ARM: 'circularArm', // Attack: wind gust
  CLAP_HANDS: 'clapHands', // Wild card
  SQUAT_MOTION: 'squatMotion', // Foundation reinforcement
  WEATHER_SHIELD: 'weatherShield', // Environmental protection
  SPIN_AROUND: 'spinAround', // Lucky draw

  // Simple gameplay
  ROCK: 'rock',
  PAPER: 'paper',
  SCISSORS: 'scissors',
  NONE: 'none',
} as const;

// Game status
export type GameStatus = 'waiting' | 'playing' | 'ended';

// Core game state
export interface GameState {
  status: GameStatus;
  players: Player[];
  currentTurn: number;
  timeRemaining: number;
  maxPlayers: number;
}

// Game phases for turn structure
export type GamePhase =
  | 'planning' // Players mentally select which gesture/card to use
  | 'action' // Players perform their chosen gesture simultaneously
  | 'building' // Tower pieces appear based on successful gestures
  | 'climbing' // Characters climb to the top of their current tower
  | 'drawing'; // Players draw one new card

// Building card type for constructing towers
export interface BuildingCard {
  id: string;
  gesture: GestureType;
  name: string;
  description: string;
  effect: string;
  buildTime: number; // in seconds
  buildHeight: number; // in units
  imageSrc: string;
}

// Tower-related types
export interface TowerPiece {
  id: string;
  height: number;
  width: number;
  position: {
    x: number;
    y: number;
  };
  stability: number; // 0-100
  isWeakened: boolean;
}

export interface PlayerTowerState {
  playerId: string;
  pieces: TowerPiece[];
  totalHeight: number;
  hasShield: boolean;
  isStabilized: boolean;
  foundationReinforced: boolean;
  weatherProtected: boolean;
}

// Player's hand of cards
export interface PlayerHand {
  playerId: string;
  cards: BuildingCard[];
}

// Gesture event from Beagle
export interface GestureEvent {
  playerId: string;
  gesture: GestureType;
  confidence: number; // 0-100
  timestamp: number;
}

export interface GestureEventPayload {
  playerId: string;
  gesture: string;
  confidence: number;
}
