import { create } from 'zustand';
import { getRandomCards, generateId } from './constants';
import {
  GAME_CONFIG,
  GameState,
  Player,
  GameStatus,
  PlayerHand,
  PlayerTowerState,
  GamePhase,
  GestureEvent,
} from './types/index';

interface GameStore {
  // Game state
  gameState: GameState;
  playerHands: PlayerHand[];
  playerTowers: PlayerTowerState[];
  currentPhase: GamePhase;
  gameTimer: number;
  phaseTimer: number;
  lastGestureEvents: GestureEvent[];

  // Actions
  setGameStatus: (status: GameStatus) => void;
  addPlayer: (name: string) => void;
  removePlayer: (playerId: string) => void;
  setPlayerReady: (playerId: string, isReady: boolean) => void;
  startGame: () => void;
  endGame: () => void;
  resetGame: () => void;
  drawCard: (playerId: string) => void;
  processGestureEvent: (event: GestureEvent) => void;
  nextPhase: () => void;
  setPhaseTimer: (time: number) => void;
  setGameTimer: (time: number) => void;
}

// Initial empty tower state
const createEmptyTowerState = (playerId: string): PlayerTowerState => ({
  playerId,
  pieces: [],
  totalHeight: 0,
  hasShield: false,
  isStabilized: false,
  foundationReinforced: false,
  weatherProtected: false,
});

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  gameState: {
    status: 'waiting',
    players: [],
    currentTurn: 0,
    timeRemaining: GAME_CONFIG.TIME_LIMIT_SECONDS,
    maxPlayers: GAME_CONFIG.MAX_PLAYERS,
  },
  playerHands: [],
  playerTowers: [],
  currentPhase: 'planning',
  gameTimer: GAME_CONFIG.TIME_LIMIT_SECONDS,
  phaseTimer: GAME_CONFIG.PHASE_DURATIONS.planning,
  lastGestureEvents: [],

  // Actions
  setGameStatus: (status: GameStatus) =>
    set((state) => ({
      gameState: { ...state.gameState, status },
    })),

  addPlayer: (name: string) => {
    const { gameState, playerHands, playerTowers } = get();

    // Check if max players is reached
    if (gameState.players.length >= GAME_CONFIG.MAX_PLAYERS) {
      return;
    }

    // Create new player
    const newPlayer: Player = {
      id: generateId(),
      name,
      isReady: false,
      connected: true,
    };

    // Create initial hand for player
    const initialCards = getRandomCards(GAME_CONFIG.INITIAL_CARDS);
    const newHand: PlayerHand = {
      playerId: newPlayer.id,
      cards: initialCards,
    };

    // Create empty tower state for player
    const newTowerState = createEmptyTowerState(newPlayer.id);

    // Update state
    set({
      gameState: {
        ...gameState,
        players: [...gameState.players, newPlayer],
      },
      playerHands: [...playerHands, newHand],
      playerTowers: [...playerTowers, newTowerState],
    });
  },

  removePlayer: (playerId: string) => {
    const { gameState, playerHands, playerTowers } = get();

    set({
      gameState: {
        ...gameState,
        players: gameState.players.filter((player) => player.id !== playerId),
      },
      playerHands: playerHands.filter((hand) => hand.playerId !== playerId),
      playerTowers: playerTowers.filter((tower) => tower.playerId !== playerId),
    });
  },

  setPlayerReady: (playerId: string, isReady: boolean) => {
    const { gameState } = get();

    set({
      gameState: {
        ...gameState,
        players: gameState.players.map((player) =>
          player.id === playerId ? { ...player, isReady } : player
        ),
      },
    });
  },

  startGame: () => {
    set((state) => ({
      gameState: {
        ...state.gameState,
        status: 'playing',
        currentTurn: 1,
        timeRemaining: GAME_CONFIG.TIME_LIMIT_SECONDS,
      },
      currentPhase: 'planning',
      gameTimer: GAME_CONFIG.TIME_LIMIT_SECONDS,
      phaseTimer: GAME_CONFIG.PHASE_DURATIONS.planning,
    }));
  },

  endGame: () => {
    set((state) => ({
      gameState: {
        ...state.gameState,
        status: 'ended',
      },
    }));
  },

  resetGame: () => {
    const { gameState } = get();

    // Keep players but reset their ready status
    const resetPlayers = gameState.players.map((player) => ({
      ...player,
      isReady: false,
    }));

    // Reset hands for all players
    const resetHands = resetPlayers.map((player) => ({
      playerId: player.id,
      cards: getRandomCards(GAME_CONFIG.INITIAL_CARDS),
    }));

    // Reset tower states for all players
    const resetTowers = resetPlayers.map((player) =>
      createEmptyTowerState(player.id)
    );

    // Update state
    set({
      gameState: {
        status: 'waiting',
        players: resetPlayers,
        currentTurn: 0,
        timeRemaining: GAME_CONFIG.TIME_LIMIT_SECONDS,
        maxPlayers: GAME_CONFIG.MAX_PLAYERS,
      },
      playerHands: resetHands,
      playerTowers: resetTowers,
      currentPhase: 'planning',
      gameTimer: GAME_CONFIG.TIME_LIMIT_SECONDS,
      phaseTimer: GAME_CONFIG.PHASE_DURATIONS.planning,
      lastGestureEvents: [],
    });
  },

  drawCard: (playerId: string) => {
    const { playerHands } = get();

    // Find player's hand
    const playerHand = playerHands.find((hand) => hand.playerId === playerId);

    if (!playerHand) return;

    // Check if hand is already at max size
    if (playerHand.cards.length >= GAME_CONFIG.HAND_SIZE) return;

    // Draw a random card
    const newCard = getRandomCards(1)[0];

    // Update player's hand
    set({
      playerHands: playerHands.map((hand) =>
        hand.playerId === playerId
          ? { ...hand, cards: [...hand.cards, newCard] }
          : hand
      ),
    });
  },

  processGestureEvent: (event: GestureEvent) => {
    const { lastGestureEvents } = get();

    // Store the gesture event
    set({
      lastGestureEvents: [...lastGestureEvents, event],
    });

    // Further processing of the gesture will be implemented in the next milestone
  },

  nextPhase: () => {
    const { currentPhase, gameState } = get();

    console.log(gameState);
    // Determine the next phase
    let nextPhase: GamePhase;
    switch (currentPhase) {
      case 'planning':
        nextPhase = 'action';
        break;
      case 'action':
        nextPhase = 'building';
        break;
      case 'building':
        nextPhase = 'climbing';
        break;
      case 'climbing':
        nextPhase = 'drawing';
        break;
      case 'drawing':
        // If drawing phase ends, start a new turn with planning phase
        nextPhase = 'planning';
        set((state) => ({
          gameState: {
            ...state.gameState,
            currentTurn: state.gameState.currentTurn + 1,
          },
        }));
        break;
      default:
        nextPhase = 'planning';
    }

    // Set the new phase and reset the phase timer
    set({
      currentPhase: nextPhase,
      phaseTimer: GAME_CONFIG.PHASE_DURATIONS[nextPhase],
    });
  },

  setPhaseTimer: (time: number) => set({ phaseTimer: time }),

  setGameTimer: (time: number) =>
    set((state) => ({
      gameTimer: time,
      gameState: {
        ...state.gameState,
        timeRemaining: time,
      },
    })),
}));
