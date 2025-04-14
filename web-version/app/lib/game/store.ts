import { create } from 'zustand';
import {
  GameStore,
  AnimationState,
  PlayerMove,
  PlayerAnimationState,
} from '../types/game';
import {
  initializeSocket,
  sendMessage,
  getSocketStatus,
  signalNextRoundReady,
  isSocketHealthy,
  refreshConnectionStatus,
} from '../websocket';

// Import socket directly to use in debugging
import '../websocket';

// Function to create a GameStore
export const useGameStore = create<GameStore>((set, get) => ({
  // Initial game state
  gameState: null,
  gameStatus: 'waiting',
  roundData: {
    roundNumber: 1,
    timeRemaining: 30,
    isTransitioning: false,
  },
  players: [],
  currentRoom: null,
  player1Name: 'Player 1',
  player2Name: 'Player 2',
  player1TowerHeight: 0,
  player2TowerHeight: 0,
  player1GoalHeight: 5,
  player2GoalHeight: 5,
  player1ShieldActive: false,
  player2ShieldActive: false,
  player1CardPlayed: '',
  player2CardPlayed: '',
  isGameEnded: false,
  winner: null,
  roundEndMessage: '',

  // Animation states
  animationState: {
    showTitleAnimation: true,
    showRulesAnimation: false,
    titleAnimationComplete: false,
    rulesAnimationComplete: false,
    animationComplete: false,
    isAnimating: false,
    gameReadySent: false,
  },
  moveAnimations: [],
  pendingRoundNumber: null,

  // Track animations played in current round
  animationsPlayedInCurrentRound: {
    player1: {
      attack: false,
      shield: false,
      build: false,
    },
    player2: {
      attack: false,
      shield: false,
      build: false,
    },
  },

  // Player character animation states
  player1Animation: 'idle',
  player2Animation: 'idle',
  player1JumpHeight: 0,
  player2JumpHeight: 0,

  // Event logs
  eventLogs: [],
  showDebugLogs: false, // Debug logs hidden by default

  // Loading state
  loading: false,
  error: null,
  socketConnected: false,

  // Notification
  notification: null,

  // Initialize game with room ID
  initialize: async (roomId: string) => {
    try {
      console.log('[game/store] Initializing game store for room:', roomId);
      set({ loading: true, error: null, currentRoom: roomId });

      // Check if socket is already connected and healthy
      if (isSocketHealthy()) {
        console.log(
          '[game/store] Socket is already healthy, using existing connection'
        );
        set({ socketConnected: true });
      } else {
        console.log(
          '[game/store] Socket is not healthy, initializing new connection'
        );
        // Initialize WebSocket if not already connected
        initializeSocket();

        // Wait for connection to be established with a timeout
        if (getSocketStatus() !== 'connected') {
          console.log('[game/store] Waiting for WebSocket connection...');
          await new Promise<void>((resolve, reject) => {
            const connectTimeout = setTimeout(() => {
              reject(new Error('Connection timeout'));
            }, 7000);

            const handleConnected = () => {
              clearTimeout(connectTimeout);
              resolve();
            };

            const handleError = () => {
              clearTimeout(connectTimeout);
              reject(new Error('Connection error'));
            };

            window.addEventListener('ws_connected', handleConnected, {
              once: true,
            });
            window.addEventListener('ws_connection_error', handleError, {
              once: true,
            });
            window.addEventListener('ws_connection_failed', handleError, {
              once: true,
            });

            // Force a refresh of connection status
            refreshConnectionStatus();
          });
        }
      }

      // Add structured error handling to separate connection issues from game state issues
      try {
        console.log(
          '[game/store] Joining room as webviewer before requesting game state'
        );
        await sendMessage('join_room', {
          roomId,
          playerId: crypto.randomUUID(), // Generate a unique ID for this client
          playerName: 'Web Client',
        });
        console.log('[game/store] Successfully joined room as webviewer');

        // Don't request game state here - will be requested after user clicks X and round_start is sent
      } catch (error) {
        // Don't fail initialization for game state issues - we'll recover via events
        console.warn('[game/store] Failed to join room:', error);
      }

      // Initialize the game state
      set({
        loading: false,
        gameStatus: 'waiting',
        roundData: {
          roundNumber: 1,
          timeRemaining: 30,
          isTransitioning: false,
        },
        animationState: {
          showTitleAnimation: true,
          showRulesAnimation: false,
          titleAnimationComplete: false,
          rulesAnimationComplete: false,
          animationComplete: false,
          isAnimating: false,
          gameReadySent: false,
        },
      });

      // Add an event log
      get().addEventLog('Game initialized', 'System');

      return true;
    } catch (error) {
      console.error('[game/store] Error initializing game:', error);
      set({ error: (error as Error).message, loading: false });
      return false;
    }
  },

  // Animation control
  setAnimationComplete: (type: keyof AnimationState, value: boolean) => {
    const state = get();
    const animationState = { ...state.animationState };

    animationState[type] = value;

    // If title animation completes, show rules
    if (type === 'titleAnimationComplete' && value === true) {
      animationState.showRulesAnimation = true;
      animationState.showTitleAnimation = false;
    }

    // If rules animation completes, mark entire animation as complete
    if (type === 'rulesAnimationComplete' && value === true) {
      animationState.showRulesAnimation = false;
      animationState.animationComplete = true;

      // Only send game_ready signal if game state is still in waiting mode
      if (
        state.currentRoom &&
        state.gameStatus === 'waiting' &&
        !animationState.gameReadySent
      ) {
        console.log(
          '[game/store] Rules animation completed, sending game_ready signal'
        );

        // Set flag to prevent multiple sends
        animationState.gameReadySent = true;

        // Make multiple attempts to send game_ready signal
        const sendGameReady = () => {
          if (state.gameStatus !== 'playing') {
            // Only send if not already playing
            sendMessage('game_ready', { roomId: state.currentRoom }).catch(
              (error) => {
                console.error('[game/store] Error sending game_ready:', error);
              }
            );
          }
        };

        // First attempt
        sendGameReady();

        // Second attempt after 1 second
        setTimeout(() => {
          // Check if we're already in playing state before sending again
          if (get().gameStatus !== 'playing') {
            console.log('[game/store] Second attempt to send game_ready');
            sendGameReady();
          }
        }, 1000);

        get().addEventLog('Sent game_ready signal to server', 'Animation');
      }
    }

    set({ animationState });
  },

  // Set player animation states
  setPlayerAnimation: (
    player: 'player1' | 'player2',
    animation: PlayerAnimationState
  ) => {
    if (player === 'player1') {
      set({ player1Animation: animation });
    } else {
      set({ player2Animation: animation });
    }

    // Define animation durations
    const duration: Record<PlayerAnimationState, number> = {
      idle: 0, // No duration for idle
      jump: 800,
      hurt: 600,
      die: 1000,
    };

    // If not a permanent animation (like die), reset to idle after animation
    if (animation !== 'die') {
      setTimeout(() => {
        if (player === 'player1') {
          set({ player1Animation: 'idle' });
        } else {
          set({ player2Animation: 'idle' });
        }
      }, duration[animation]);
    }
  },

  // Handle attack animations
  animateAttack: (attackingPlayer: 'player1' | 'player2') => {
    const state = get();
    const defendingPlayer =
      attackingPlayer === 'player1' ? 'player2' : 'player1';
    const defenderShieldActive =
      attackingPlayer === 'player1'
        ? state.player2ShieldActive
        : state.player1ShieldActive;

    // Set attacker to jump animation
    get().setPlayerAnimation(attackingPlayer, 'jump');

    // Animate jump height
    if (attackingPlayer === 'player1') {
      // Jump up
      set({ player1JumpHeight: 30 });

      // After 400ms, start coming down
      setTimeout(() => {
        set({ player1JumpHeight: 15 });

        // Land completely after another 400ms
        setTimeout(() => {
          set({ player1JumpHeight: 0 });
        }, 400);
      }, 400);
    } else {
      // Jump up
      set({ player2JumpHeight: 30 });

      // After 400ms, start coming down
      setTimeout(() => {
        set({ player2JumpHeight: 15 });

        // Land completely after another 400ms
        setTimeout(() => {
          set({ player2JumpHeight: 0 });
        }, 400);
      }, 400);
    }

    // After 1 second, check if defender should be hurt (no shield)
    setTimeout(() => {
      if (!defenderShieldActive) {
        // Set defender to hurt animation
        get().setPlayerAnimation(defendingPlayer, 'hurt');

        // If tower height is now 0, change to die animation
        const defenderTowerHeight =
          defendingPlayer === 'player1'
            ? state.player1TowerHeight
            : state.player2TowerHeight;

        if (defenderTowerHeight <= 1) {
          // 1 because we haven't decremented yet
          setTimeout(() => {
            get().setPlayerAnimation(defendingPlayer, 'die');
          }, 600); // Wait for hurt animation to finish
        }
      }
    }, 1000);
  },

  // Start the game
  startGame: async () => {
    try {
      const { currentRoom } = get();
      if (!currentRoom) {
        throw new Error('Not in a room');
      }

      console.log('[game/store] Starting game');
      set({ loading: true, error: null });

      // Send game start message
      await sendMessage('game_start', {
        roomId: currentRoom,
      });

      set({ gameStatus: 'playing', loading: false });
      get().addEventLog('Game started', 'System');
    } catch (error) {
      console.error('[game/store] Failed to start game:', error);
      set({ error: (error as Error).message, loading: false });
    }
  },

  // Acknowledge player moves are complete for the round
  acknowledgeMoves: async () => {
    try {
      const { currentRoom, roundData } = get();
      if (!currentRoom) {
        throw new Error('Not in a room');
      }

      console.log('[game/store] Acknowledging round moves complete');

      // Send round_end_ack message
      await sendMessage('round_end_ack', {
        roomId: currentRoom,
        roundNumber: roundData.roundNumber,
      });

      get().addEventLog(
        `Round ${roundData.roundNumber} acknowledged complete`,
        'System'
      );
    } catch (error) {
      console.error('[game/store] Failed to acknowledge moves:', error);
    }
  },

  // Signal ready for next round
  readyForNextRound: async (roundNumber: number) => {
    try {
      const { currentRoom } = get();
      if (!currentRoom) {
        throw new Error('Not in a room');
      }

      console.log(`[game/store] Signaling ready for round ${roundNumber}`);

      // Make multiple attempts to send next_round_ready signal
      const sendNextRoundReady = () => {
        if (isSocketHealthy()) {
          console.log(
            `[game/store] Sending next_round_ready for round ${roundNumber}`
          );
          signalNextRoundReady(currentRoom, roundNumber);
        } else {
          console.warn(
            '[game/store] Socket not healthy when trying to signal next round ready'
          );
          refreshConnectionStatus();
        }
      };

      // First attempt
      sendNextRoundReady();

      // Second attempt after 1 second
      setTimeout(sendNextRoundReady, 1000);

      // Third attempt after 3 seconds
      setTimeout(sendNextRoundReady, 3000);

      get().addEventLog(`Signaled ready for round ${roundNumber}`, 'System');
    } catch (error) {
      console.error('[game/store] Failed to signal next round ready:', error);
    }
  },

  // Reset game state
  resetGame: () => {
    set({
      gameState: null,
      gameStatus: 'waiting',
      roundData: {
        roundNumber: 1,
        timeRemaining: 30,
        isTransitioning: false,
      },
      player1TowerHeight: 0,
      player2TowerHeight: 0,
      player1ShieldActive: false,
      player2ShieldActive: false,
      player1CardPlayed: '',
      player2CardPlayed: '',
      isGameEnded: false,
      winner: null,
      roundEndMessage: '',
      animationState: {
        showTitleAnimation: true,
        showRulesAnimation: false,
        titleAnimationComplete: false,
        rulesAnimationComplete: false,
        animationComplete: false,
        isAnimating: false,
        gameReadySent: false,
      },
      moveAnimations: [],
      pendingRoundNumber: null,
      animationsPlayedInCurrentRound: {
        player1: {
          attack: false,
          shield: false,
          build: false,
        },
        player2: {
          attack: false,
          shield: false,
          build: false,
        },
      },
    });
    get().addEventLog('Game reset', 'System');
  },

  // Request game state after round_start
  requestGameState: async () => {
    try {
      const { currentRoom } = get();
      if (!currentRoom) {
        console.error(
          '[game/store] Cannot request game state: No current room'
        );
        return;
      }

      console.log(
        '[game/store] Requesting game data after round start for room:',
        currentRoom
      );

      // Use get_game_state instead of get_room to request game state directly
      await sendMessage('get_game_state', { roomId: currentRoom });
      console.log('[game/store] Game state requested for room:', currentRoom);

      get().addEventLog('Game state requested after round start', 'System');
    } catch (error) {
      console.error('[game/store] Failed to request game state:', error);
    }
  },

  // Add event log
  addEventLog: (message: string, source: string = 'UI') => {
    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    set((state) => {
      const formattedMessage = `${timestamp} [${source}] ${message}`;
      const maxEventLogs = 10;
      const newLogs = [
        formattedMessage,
        ...state.eventLogs.slice(0, maxEventLogs - 1),
      ];
      return { eventLogs: newLogs };
    });
  },

  // Clear event logs
  clearEventLogs: () => {
    set({ eventLogs: [] });
    get().addEventLog('Logs cleared', 'UI');
  },

  // Find where the other notification-related functions are defined and add this function
  resetNotification: () => set({ notification: null }),

  // Debug function to check event listeners
  debugCheckEventListeners: () => {
    const state = useGameStore.getState();
    console.log('Debug - Event Listeners:');
    console.log('Current room:', state.currentRoom);
    console.log('Current round:', state.gameState?.roundNumber);
  },

  // Check if an animation has already been played in the current round
  hasAnimationPlayedInCurrentRound: (
    player: 'player1' | 'player2',
    animationType: 'attack' | 'shield' | 'build'
  ): boolean => {
    const state = get();
    return state.animationsPlayedInCurrentRound[player][animationType];
  },

  // Mark an animation as played in the current round
  markAnimationAsPlayed: (
    player: 'player1' | 'player2',
    animationType: 'attack' | 'shield' | 'build'
  ): void => {
    set((state) => {
      const updatedAnimationsPlayed = {
        ...state.animationsPlayedInCurrentRound,
        [player]: {
          ...state.animationsPlayedInCurrentRound[player],
          [animationType]: true,
        },
      };

      return {
        animationsPlayedInCurrentRound: updatedAnimationsPlayed,
      };
    });

    get().addEventLog(
      `Animation ${animationType} marked as played for ${player}`,
      'Animation'
    );
  },

  // Reset animations played in a round (call this at round start/end)
  resetAnimationsPlayedInRound: (): void => {
    set({
      animationsPlayedInCurrentRound: {
        player1: {
          attack: false,
          shield: false,
          build: false,
        },
        player2: {
          attack: false,
          shield: false,
          build: false,
        },
      },
    });

    get().addEventLog('Reset animations played in round', 'Animation');
  },

  // Toggle debug logs visibility
  toggleDebugLogs: (): void => {
    set((state) => ({
      showDebugLogs: !state.showDebugLogs,
    }));
  },
}));

// Set up event listeners for game events
if (typeof window !== 'undefined') {
  // WebSocket connection status
  window.addEventListener('ws_connected', () => {
    useGameStore.setState({ socketConnected: true });
    useGameStore.getState().addEventLog('WebSocket connected', 'Connection');
  });

  window.addEventListener('ws_connection_closed', () => {
    useGameStore.setState({ socketConnected: false });
    useGameStore.getState().addEventLog('WebSocket disconnected', 'Connection');
  });

  window.addEventListener('ws_connection_error', () => {
    useGameStore.setState({
      socketConnected: false,
      error: 'WebSocket connection error',
    });
    useGameStore.getState().addEventLog('WebSocket error', 'Connection');
  });

  // Game state update event
  window.addEventListener('game_state_update', (event: CustomEventInit) => {
    try {
      const { gameState, message, allGesturesReceived, playerGestureSummary } =
        event.detail || {};
      console.log('[game/store] Game state update received:', gameState);
      console.log('[game/store] Message:', message);

      if (allGesturesReceived) {
        console.log(
          '[game/store] All gestures received:',
          playerGestureSummary
        );

        // If we've received all gestures in a game state update, we can proceed with sending next_round_ready
        // after a short delay to allow animations to complete
        if (playerGestureSummary && playerGestureSummary.length >= 2) {
          const state = useGameStore.getState();

          if (state.currentRoom && !state.roundData.isTransitioning) {
            // Send next_round_ready signal to server after animations have completed
            setTimeout(() => {
              console.log(
                '[game/store] Sending next_round_ready signal after receiving all gestures'
              );
              import('../websocket').then(({ sendMessage }) => {
                sendMessage('next_round_ready', {
                  roomId: state.currentRoom,
                  roundNumber: state.roundData.roundNumber,
                }).catch((err) => {
                  console.error(
                    '[game/store] Failed to send next_round_ready:',
                    err
                  );
                });
              });

              // Mark as transitioning to prevent duplicate signals
              useGameStore.setState({
                roundData: {
                  ...state.roundData,
                  isTransitioning: true,
                },
              });
            }, 3000); // Delay to allow animations to complete
          }
        }
      }

      if (gameState) {
        const state = useGameStore.getState();

        // Update game state data
        useGameStore.setState({ gameState });

        // Extract player tower heights and goal heights
        if (gameState.towerHeights && gameState.goalHeights) {
          // Get player IDs from the towerHeights object
          const playerIds = Object.keys(gameState.towerHeights);

          if (playerIds.length >= 1) {
            useGameStore.setState({
              player1TowerHeight: gameState.towerHeights[playerIds[0]] || 0,
              player1GoalHeight: gameState.goalHeights[playerIds[0]] || 5,
            });
          }

          if (playerIds.length >= 2) {
            useGameStore.setState({
              player2TowerHeight: gameState.towerHeights[playerIds[1]] || 0,
              player2GoalHeight: gameState.goalHeights[playerIds[1]] || 5,
            });
          }
        }

        // Update round data
        if (gameState.roundNumber) {
          useGameStore.setState({
            roundData: {
              ...state.roundData,
              roundNumber: gameState.roundNumber,
            },
          });
        }

        // Update shield status if provided
        if (gameState.playerShields) {
          const playerIds = Object.keys(gameState.playerShields);
          if (playerIds.length >= 1) {
            useGameStore.setState({
              player1ShieldActive:
                gameState.playerShields[playerIds[0]] || false,
            });
          }
          if (playerIds.length >= 2) {
            useGameStore.setState({
              player2ShieldActive:
                gameState.playerShields[playerIds[1]] || false,
            });
          }
        }

        // Log the state update
        state.addEventLog(
          `Game state updated: Round ${gameState.roundNumber}`,
          'Server'
        );

        // If there's a message, add it to the logs
        if (message) {
          state.addEventLog(message, 'Server');
        }
      }
    } catch (error) {
      console.error(
        '[game/store] Error processing game state update:',
        error
      );
    }
  });

  // Round start event
  window.addEventListener('round_start', (event: CustomEventInit) => {
    try {
      const { roundNumber, gameState } = event.detail || {};
      console.log(
        '[game/store] ===== ROUND START EVENT RECEIVED =====',
        event.detail
      );
      console.log(
        '[game/store] Round number:',
        roundNumber,
        'Current game status:',
        useGameStore.getState().gameStatus
      );

      const state = useGameStore.getState();
      const currentStatus = state.gameStatus;

      // VALIDATE: Ensure the round number is valid - don't accept round numbers
      // less than the current round number (avoid regression)
      if (
        state.roundData.roundNumber > 1 &&
        roundNumber < state.roundData.roundNumber
      ) {
        console.error(
          `[game/store] INVALID ROUND START: Server sent round ${roundNumber} but we're already on round ${state.roundData.roundNumber}`
        );
        return; // Reject invalid round transitions
      }

      // CRITICAL FIX: Force transition to playing state
      console.log(
        '[game/store] TRANSITIONING FROM',
        currentStatus,
        'TO "playing" STATE'
      );

      // Update round data
      useGameStore.setState({
        roundData: {
          roundNumber: roundNumber || 1,
          timeRemaining: 30, // Reset timer
          isTransitioning: false,
        },
        pendingRoundNumber: null, // Clear pending round since we're starting it
        gameStatus: 'playing', // FORCE playing state
      });

      // If game state is provided, update it
      if (gameState) {
        useGameStore.setState({ gameState });

        // Extract player tower heights and goal heights
        if (gameState.towerHeights && gameState.goalHeights) {
          const playerIds = Object.keys(gameState.towerHeights);

          if (playerIds.length >= 1) {
            useGameStore.setState({
              player1TowerHeight: gameState.towerHeights[playerIds[0]] || 0,
              player1GoalHeight: gameState.goalHeights[playerIds[0]] || 5,
            });
          }

          if (playerIds.length >= 2) {
            useGameStore.setState({
              player2TowerHeight: gameState.towerHeights[playerIds[1]] || 0,
              player2GoalHeight: gameState.goalHeights[playerIds[1]] || 5,
            });
          }
        }
      }

      // Reset card played state
      useGameStore.setState({
        player1CardPlayed: '',
        player2CardPlayed: '',
      });

      state.addEventLog(`Round ${roundNumber} started`, 'Server');

      // Verify state was updated correctly
      setTimeout(() => {
        const newState = useGameStore.getState();
        console.log('[game/store] STATE AFTER ROUND START:', {
          gameStatus: newState.gameStatus,
          roundNumber: newState.roundData.roundNumber,
          isTransitioning: newState.roundData.isTransitioning,
        });
      }, 100);

      console.log(
        '[game/store] ===== ROUND START PROCESSING COMPLETE ====='
      );
    } catch (error) {
      console.error(
        '[game/store] Error processing round start event:',
        error
      );
    }
  });

  // Gesture event (keep for backward compatibility, but most gestures will now come as batch)
  window.addEventListener('gesture_event', (event: CustomEventInit) => {
    try {
      const { playerId, gesture, cardId } = event.detail || {};
      console.log(
        '[game/store] Individual gesture event received:',
        event.detail
      );

      // Process single gesture (reuse existing code)
      processGesture(playerId, gesture, cardId);
    } catch (error) {
      console.error('[game/store] Error processing gesture event:', error);
    }
  });

  // New batch gesture event handler
  window.addEventListener('gesture_batch', (event: CustomEventInit) => {
    try {
      const { gestures, roundNumber } = event.detail || {};
      console.log('[game/store] Gesture batch received:', gestures);

      const state = useGameStore.getState();

      // Verify we're processing the right round
      if (state.roundData.roundNumber !== roundNumber) {
        console.warn(
          `[game/store] Round mismatch: received gestures for round ${roundNumber} but current round is ${state.roundData.roundNumber}`
        );
        return;
      }

      // Process each gesture in the batch
      if (Array.isArray(gestures)) {
        // Reset animation state before processing batch
        useGameStore.setState({
          moveAnimations: [],
          animationState: {
            ...state.animationState,
            isAnimating: true,
          },
        });

        // Process each gesture
        gestures.forEach(({ playerId, gesture, cardId }) => {
          processGesture(playerId, gesture, cardId);
        });

        // No need to trigger round transition here - it will be handled by the game_state_update handler
        // that includes allGesturesReceived flag
      }
    } catch (error) {
      console.error('[game/store] Error processing gesture batch:', error);
    }
  });

  // Helper function to process a single gesture
  function processGesture(playerId: string, gesture: string, cardId?: string) {
    const state = useGameStore.getState();

    // Update the player's card played state
    const isPlayer1 =
      Object.keys(state.gameState?.towerHeights || {})[0] === playerId;

    // Normalize gesture name to handle different casings (Attack, ATTACK, attack)
    const normalizedGesture = gesture.toLowerCase();
    const displayGesture =
      normalizedGesture.charAt(0).toUpperCase() + normalizedGesture.slice(1); // Capitalize first letter

    if (isPlayer1) {
      useGameStore.setState({ player1CardPlayed: displayGesture });

      // Set appropriate animation based on gesture
      if (normalizedGesture === 'attack') {
        // Check if this animation has already been played in the current round
        if (!state.hasAnimationPlayedInCurrentRound('player1', 'attack')) {
          // Trigger attack animation with AttackAnimation component
          state.setPlayerAnimation('player1', 'jump'); // Use 'jump' for attack

          // Trigger the attack animation after a short delay
          setTimeout(() => {
            // Set attack animation visible flag
            useGameStore.setState((prevState) => ({
              ...prevState,
              player1AttackVisible: true,
            }));
          }, 200);

          // Mark this animation as played for this round
          state.markAnimationAsPlayed('player1', 'attack');
        } else {
          state.addEventLog(
            'Attack animation already played for player1 this round, skipping',
            'Animation'
          );
        }
      } else if (normalizedGesture === 'defend') {
        // Check if this animation has already been played in the current round
        if (!state.hasAnimationPlayedInCurrentRound('player1', 'shield')) {
          state.setPlayerAnimation('player1', 'idle'); // No special animation for defend

          // Activate shield
          useGameStore.setState({ player1ShieldActive: true });

          // Mark this animation as played for this round
          state.markAnimationAsPlayed('player1', 'shield');
        } else {
          state.addEventLog(
            'Shield animation already played for player1 this round, skipping',
            'Animation'
          );
        }
      } else if (normalizedGesture === 'build') {
        // Check if this animation has already been played in the current round
        if (!state.hasAnimationPlayedInCurrentRound('player1', 'build')) {
          state.setPlayerAnimation('player1', 'jump'); // Use jump animation for build

          // Add jump effect for building
          useGameStore.setState({ player1JumpHeight: 20 });

          // After a delay, reset jump height and increase tower height
          setTimeout(() => {
            useGameStore.setState({
              player1JumpHeight: 0,
              // Tower height increase will be handled by game state update
            });
          }, 500);

          // Mark this animation as played for this round
          state.markAnimationAsPlayed('player1', 'build');
        } else {
          state.addEventLog(
            'Build animation already played for player1 this round, skipping',
            'Animation'
          );
        }
      }
    } else {
      useGameStore.setState({ player2CardPlayed: displayGesture });

      // Set appropriate animation based on gesture
      if (normalizedGesture === 'attack') {
        // Check if this animation has already been played in the current round
        if (!state.hasAnimationPlayedInCurrentRound('player2', 'attack')) {
          // Trigger attack animation with AttackAnimation component
          state.setPlayerAnimation('player2', 'jump'); // Use 'jump' for attack

          // Trigger the attack animation after a short delay
          setTimeout(() => {
            // Set attack animation visible flag
            useGameStore.setState((prevState) => ({
              ...prevState,
              player2AttackVisible: true,
            }));
          }, 200);

          // Mark this animation as played for this round
          state.markAnimationAsPlayed('player2', 'attack');
        } else {
          state.addEventLog(
            'Attack animation already played for player2 this round, skipping',
            'Animation'
          );
        }
      } else if (normalizedGesture === 'defend') {
        // Check if this animation has already been played in the current round
        if (!state.hasAnimationPlayedInCurrentRound('player2', 'shield')) {
          state.setPlayerAnimation('player2', 'idle'); // No special animation for defend

          // Activate shield
          useGameStore.setState({ player2ShieldActive: true });

          // Mark this animation as played for this round
          state.markAnimationAsPlayed('player2', 'shield');
        } else {
          state.addEventLog(
            'Shield animation already played for player2 this round, skipping',
            'Animation'
          );
        }
      } else if (normalizedGesture === 'build') {
        // Check if this animation has already been played in the current round
        if (!state.hasAnimationPlayedInCurrentRound('player2', 'build')) {
          state.setPlayerAnimation('player2', 'jump'); // Use jump animation for build

          // Add jump effect for building
          useGameStore.setState({ player2JumpHeight: 20 });

          // After a delay, reset jump height and increase tower height
          setTimeout(() => {
            useGameStore.setState({
              player2JumpHeight: 0,
              // Tower height increase will be handled by game state update
            });
          }, 500);

          // Mark this animation as played for this round
          state.markAnimationAsPlayed('player2', 'build');
        } else {
          state.addEventLog(
            'Build animation already played for player2 this round, skipping',
            'Animation'
          );
        }
      }
    }

    // Add the move to animations
    const newMove: PlayerMove = {
      playerId,
      gesture: displayGesture, // Use normalized gesture
      cardId,
    };

    useGameStore.setState((state) => ({
      moveAnimations: [...state.moveAnimations, newMove],
      animationState: {
        ...state.animationState,
        isAnimating: true,
      },
    }));

    state.addEventLog(`Player ${playerId} played ${displayGesture}`, 'Gesture');
  }

  // Game ended event
  window.addEventListener('game_ended', (event: CustomEventInit) => {
    try {
      const { winnerId } = event.detail || {};
      console.log('[game/store] Game ended event received:', event.detail);

      const state = useGameStore.getState();

      // Update game state
      useGameStore.setState({
        gameStatus: 'ended',
        isGameEnded: true,
        winner: winnerId,
        roundEndMessage: winnerId
          ? `Game over! ${
              winnerId === Object.keys(state.gameState?.towerHeights || {})[0]
                ? state.player1Name
                : state.player2Name
            } wins!`
          : 'Game over!',
      });

      state.addEventLog(`Game ended - Winner: ${winnerId || 'None'}`, 'Server');
    } catch (error) {
      console.error('[game/store] Error processing game ended event:', error);
    }
  });

  // Round end acknowledgment event
  window.addEventListener('round_end_ack', (event: CustomEventInit) => {
    try {
      const { roomId, playerId, roundNumber } = event.detail || {};
      console.log('[game/store] Round end acknowledgment received:', {
        roomId,
        playerId,
        roundNumber,
        timestamp: new Date().toISOString(),
      });

      const state = useGameStore.getState();

      // Check if this is for our current room
      if (roomId !== state.currentRoom) {
        console.warn(
          '[game/store] Received round_end_ack for different room, ignoring'
        );
        return;
      }

      // Check if we're in the correct round
      if (roundNumber !== state.roundData.roundNumber) {
        console.warn(
          `[game/store] Round number mismatch: received ${roundNumber}, current is ${state.roundData.roundNumber}`
        );
        return;
      }

      state.addEventLog(
        `Player ${playerId} acknowledged round ${roundNumber} end`,
        'System'
      );

      // Let the page component handle sending round_start for next round
      // We just need to update our internal state to be ready for it

      // Calculate the next round number
      const nextRoundNumber = roundNumber + 1;

      // Reset card played states for next round
      useGameStore.setState({
        player1CardPlayed: undefined,
        player2CardPlayed: undefined,
        roundData: {
          ...state.roundData,
          isTransitioning: true, // Set transitioning to prevent duplicate round starts
        },
      });

      state.addEventLog(
        `Round ${roundNumber} complete, waiting for round ${nextRoundNumber}`,
        'System'
      );
    } catch (error) {
      console.error(
        '[game/store] Error processing round end acknowledgment:',
        error
      );
    }
  });

  // Game starting event
  window.addEventListener('game_starting', (event: CustomEventInit) => {
    try {
      const { countdown } = event.detail || {};
      console.log('[game/store] Game starting event received:', event.detail);

      const state = useGameStore.getState();

      // Update game state to starting
      useGameStore.setState({
        gameStatus: 'playing',
      });

      state.addEventLog(
        `Game starting${countdown ? ` - Countdown: ${countdown}` : ''}`,
        'Server'
      );
    } catch (error) {
      console.error(
        '[game/store] Error processing game starting event:',
        error
      );
    }
  });

  // Room data event
  window.addEventListener('room_data', (event: CustomEventInit) => {
    try {
      const { room } = event.detail || {};
      console.log('[game/store] Room data received:', room);

      if (room && room.gameState) {
        const state = useGameStore.getState();

        // Make sure we're in the same room
        if (state.currentRoom !== room.id) {
          console.log(
            `[game/store] Received room data for room ${room.id} but we're in room ${state.currentRoom}`
          );
          return;
        }

        console.log('[game/store] Updating game state from room data');

        // Convert the gameState from the server format to our format
        const gameState = {
          towerHeights: room.gameState.towerHeights || {},
          goalHeights: room.gameState.goalHeights || {},
          roundNumber: room.gameState.roundNumber || 1,
          playerShields: room.gameState.playerShields || {},
          roundStartTime: Date.now(),
        };

        // Update game state
        useGameStore.setState({ gameState });

        // Extract player tower heights and goal heights
        if (gameState.towerHeights && gameState.goalHeights) {
          const playerIds = Object.keys(gameState.towerHeights);

          if (playerIds.length >= 1) {
            useGameStore.setState({
              player1TowerHeight: gameState.towerHeights[playerIds[0]] || 0,
              player1GoalHeight: gameState.goalHeights[playerIds[0]] || 5,
            });
          }

          if (playerIds.length >= 2) {
            useGameStore.setState({
              player2TowerHeight: gameState.towerHeights[playerIds[1]] || 0,
              player2GoalHeight: gameState.goalHeights[playerIds[1]] || 5,
            });
          }
        }

        // Update round data
        if (gameState.roundNumber) {
          useGameStore.setState({
            roundData: {
              ...state.roundData,
              roundNumber: gameState.roundNumber,
            },
          });
        }

        // Log the update
        state.addEventLog(
          `Game state updated from room data: Round ${gameState.roundNumber}`,
          'Server'
        );
      }
    } catch (error) {
      console.error('[game/store] Error processing room data:', error);
    }
  });

  // Round start event - reset animation tracking
  window.addEventListener('round_start', (event: CustomEventInit) => {
    try {
      const { roomId, roundNumber } = event.detail || {};
      console.log('[game/store] Round start received:', {
        roomId,
        roundNumber,
        timestamp: new Date().toISOString(),
      });

      const state = useGameStore.getState();

      // Reset animations played for the new round
      state.resetAnimationsPlayedInRound();
      state.addEventLog(
        `Reset animations for new round ${roundNumber}`,
        'Animation'
      );
    } catch (error) {
      console.error('[game/store] Error handling round start event:', error);
    }
  });

  // Round end event - reset animation tracking
  window.addEventListener('round_end', (event: CustomEventInit) => {
    try {
      const { roomId, roundNumber } = event.detail || {};
      console.log('[game/store] Round end received:', {
        roomId,
        roundNumber,
        timestamp: new Date().toISOString(),
      });

      const state = useGameStore.getState();

      // Reset animations played for the round that just ended
      state.resetAnimationsPlayedInRound();
      state.addEventLog(
        `Reset animations at end of round ${roundNumber}`,
        'Animation'
      );
    } catch (error) {
      console.error('[game/store] Error handling round end event:', error);
    }
  });
}
