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

// Game action types from server
export type GameActionType = 'attack' | 'defend' | 'build';

// Game state for the store
export interface GameStateData {
  towerHeights: { [playerId: string]: number };
  goalHeights: { [playerId: string]: number };
  roundNumber: number;
  roundStartTime: number;
  playerShields?: { [playerId: string]: boolean };
}

// Round data for current round
export interface RoundData {
  roundNumber: number;
  timeRemaining: number;
  isTransitioning: boolean;
}

// Types for animations
export interface AnimationState {
  showTitleAnimation: boolean;
  showRulesAnimation: boolean;
  titleAnimationComplete: boolean;
  rulesAnimationComplete: boolean;
  animationComplete: boolean;
  isAnimating: boolean;
  gameReadySent: boolean; // Flag to track if game_ready signal has been sent
}

// Player move information
export interface PlayerMove {
  playerId: string;
  gesture: string;
  cardId?: string;
}

// Animation types for player characters
export type PlayerAnimationState = 'idle' | 'jump' | 'hurt' | 'die';

// Game store interface for Zustand
export interface GameStore {
  // Game state
  gameState: GameStateData | null;
  gameStatus: GameStatus;
  roundData: RoundData;
  players: Player[];
  currentRoom: string | null;
  player1Name: string;
  player2Name: string;
  player1TowerHeight: number;
  player2TowerHeight: number;
  player1GoalHeight: number;
  player2GoalHeight: number;
  player1ShieldActive: boolean;
  player2ShieldActive: boolean;
  player1CardPlayed: string;
  player2CardPlayed: string;
  isGameEnded: boolean;
  winner: string | null;
  roundEndMessage: string;

  // Notification
  notification: { message: string; type: string } | null;

  // Animation states
  animationState: AnimationState;
  moveAnimations: PlayerMove[];
  pendingRoundNumber: number | null;

  // Track animations played in current round to prevent duplicates
  animationsPlayedInCurrentRound: {
    player1: {
      attack: boolean;
      shield: boolean;
      build: boolean;
    };
    player2: {
      attack: boolean;
      shield: boolean;
      build: boolean;
    };
  };

  // Character animation states
  player1Animation: PlayerAnimationState;
  player2Animation: PlayerAnimationState;
  player1JumpHeight: number;
  player2JumpHeight: number;

  // Debug state
  eventLogs: string[];
  showDebugLogs: boolean; // New property to toggle debug logs visibility

  // Loading state
  loading: boolean;
  error: string | null;
  socketConnected: boolean;

  // Game actions
  initialize: (roomId: string) => Promise<boolean>;
  setAnimationComplete: (type: keyof AnimationState, value: boolean) => void;
  setPlayerAnimation: (
    player: 'player1' | 'player2',
    animation: PlayerAnimationState
  ) => void;
  animateAttack: (attackingPlayer: 'player1' | 'player2') => void;
  startGame: () => Promise<void>;
  acknowledgeMoves: () => Promise<void>;
  readyForNextRound: (roundNumber: number) => Promise<void>;
  resetGame: () => void;
  resetNotification: () => void;
  debugCheckEventListeners: () => void;
  requestGameState: () => Promise<void>;

  // New method to check if an animation has already been played
  hasAnimationPlayedInCurrentRound: (
    player: 'player1' | 'player2',
    animationType: 'attack' | 'shield' | 'build'
  ) => boolean;

  // New method to mark an animation as played
  markAnimationAsPlayed: (
    player: 'player1' | 'player2',
    animationType: 'attack' | 'shield' | 'build'
  ) => void;

  // New method to reset animations played in a round
  resetAnimationsPlayedInRound: () => void;

  // Method to toggle debug logs visibility
  toggleDebugLogs: () => void;

  // Utility functions
  addEventLog: (message: string, source?: string) => void;
  clearEventLogs: () => void;
}
