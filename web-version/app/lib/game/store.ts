import { create } from 'zustand';
import { GameStore, AnimationState, PlayerMove } from '../types/game';
import {
  initializeSocket,
  sendMessage,
  getSocketStatus,
  signalNextRoundReady,
  isSocketHealthy,
  refreshConnectionStatus,
} from '../websocket';

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

  // Event logs
  eventLogs: [],

  // Loading state
  loading: false,
  error: null,
  socketConnected: false,

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
        // Fetch game state from server using the current room
        await sendMessage('get_game_state', { roomId });
        console.log('[game/store] Game state requested for room:', roomId);
      } catch (error) {
        // Don't fail initialization for game state issues - we'll recover via events
        console.warn('[game/store] Failed to request game state:', error);

        // Register a one-time event listener to try again in 2 seconds if socket is connected
        if (isSocketHealthy()) {
          setTimeout(() => {
            if (isSocketHealthy() && get().currentRoom === roomId) {
              console.log('[game/store] Retrying game state request');
              sendMessage('get_game_state', { roomId }).catch((err) =>
                console.warn(
                  '[game/store] Retry game state request failed:',
                  err
                )
              );
            }
          }, 2000);
        }
      }

      // Ensure we're connected to the room
      try {
        // Send a get_room request to make sure our connection is registered with the server
        await sendMessage('get_room', { roomId });
        console.log('[game/store] Room data requested for room:', roomId);
      } catch (error) {
        console.warn('[game/store] Failed to request room data:', error);
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
    });
    get().addEventLog('Game reset', 'System');
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
      const { gameState, message, waitingForNextRound } = event.detail || {};
      console.log('🟣 [game/store] Game state update received:', gameState);
      console.log(
        '🟣 [game/store] Message:',
        message,
        'Waiting for next round:',
        waitingForNextRound
      );

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

        // If waiting for next round, set the pendingRoundNumber
        if (waitingForNextRound) {
          console.log(
            '🟣 [game/store] Server waiting for next round ready signal for round',
            gameState.roundNumber
          );

          useGameStore.setState({
            pendingRoundNumber: gameState.roundNumber,
          });

          // Immediately try to signal readiness if we're in a non-transitioning state
          if (!state.roundData.isTransitioning) {
            console.log(
              '🟣 [game/store] Not transitioning, immediately signaling ready for round',
              gameState.roundNumber
            );
            state.readyForNextRound(gameState.roundNumber);
          }
        }
      }
    } catch (error) {
      console.error(
        '🔴 [game/store] Error processing game state update:',
        error
      );
    }
  });

  // Round start event
  window.addEventListener('round_start', (event: CustomEventInit) => {
    try {
      const { roundNumber, gameState } = event.detail || {};
      console.log(
        '🔵 [game/store] ===== ROUND START EVENT RECEIVED =====',
        event.detail
      );
      console.log(
        '🔵 [game/store] Round number:',
        roundNumber,
        'Current game status:',
        useGameStore.getState().gameStatus
      );

      const state = useGameStore.getState();
      const currentStatus = state.gameStatus;

      // CRITICAL FIX: Force transition to playing state
      console.log(
        '🔵 [game/store] 🚨 TRANSITIONING FROM',
        currentStatus,
        'TO "playing" STATE 🚨'
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
        console.log('🔵 [game/store] STATE AFTER ROUND START:', {
          gameStatus: newState.gameStatus,
          roundNumber: newState.roundData.roundNumber,
          isTransitioning: newState.roundData.isTransitioning,
        });
      }, 100);

      console.log(
        '🔵 [game/store] ===== ROUND START PROCESSING COMPLETE ====='
      );
    } catch (error) {
      console.error(
        '🔴 [game/store] Error processing round start event:',
        error
      );
    }
  });

  // Gesture event
  window.addEventListener('gesture_event', (event: CustomEventInit) => {
    try {
      const { playerId, gesture, cardId } = event.detail || {};
      console.log('[game/store] Gesture event received:', event.detail);

      const state = useGameStore.getState();

      // Update the player's card played state
      const isPlayer1 =
        Object.keys(state.gameState?.towerHeights || {})[0] === playerId;

      if (isPlayer1) {
        useGameStore.setState({ player1CardPlayed: gesture });
      } else {
        useGameStore.setState({ player2CardPlayed: gesture });
      }

      // Add the move to animations
      const newMove: PlayerMove = {
        playerId,
        gesture,
        cardId,
      };

      useGameStore.setState({
        moveAnimations: [...state.moveAnimations, newMove],
        animationState: {
          ...state.animationState,
          isAnimating: true,
        },
      });

      state.addEventLog(`Player ${playerId} played ${gesture}`, 'Gesture');
    } catch (error) {
      console.error('[game/store] Error processing gesture event:', error);
    }
  });

  // Round end event
  window.addEventListener('round_end', (event: CustomEventInit) => {
    try {
      const { roundNumber, gameState, winnerId, shouldContinue } =
        event.detail || {};
      console.log(
        '🟠 [game/store] ===== ROUND END EVENT RECEIVED =====',
        event.detail
      );
      console.log(
        '🟠 [game/store] Round:',
        roundNumber,
        'Continue:',
        shouldContinue,
        'Winner:',
        winnerId
      );

      const state = useGameStore.getState();

      // Update game state
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

      // Set round transition state
      useGameStore.setState({
        roundData: {
          ...state.roundData,
          isTransitioning: true,
        },
      });

      // Update winner if provided
      if (winnerId) {
        useGameStore.setState({
          winner: winnerId,
          isGameEnded: !shouldContinue,
          roundEndMessage: `Round ${roundNumber} complete. ${
            winnerId === Object.keys(state.gameState?.towerHeights || {})[0]
              ? state.player1Name
              : state.player2Name
          } wins!`,
        });
      } else {
        useGameStore.setState({
          roundEndMessage: `Round ${roundNumber} complete. No winner yet.`,
        });
      }

      // Log the round end
      state.addEventLog(
        `Round ${roundNumber} ended${winnerId ? ` - Winner: ${winnerId}` : ''}`,
        'Server'
      );

      // If game should continue, prepare for next round immediately
      if (shouldContinue) {
        const nextRound = (roundNumber || 1) + 1;
        console.log(`🟠 [game/store] Preparing for round ${nextRound}`);

        useGameStore.setState({
          pendingRoundNumber: nextRound,
        });

        // Signal ready for next round immediately and with retries
        const signalReady = () => {
          console.log(
            `🟠 [game/store] Signaling ready for round ${nextRound} from round_end handler`
          );
          if (state.currentRoom && isSocketHealthy()) {
            // Use direct import to ensure we get the fresh version
            import('../websocket').then(({ signalNextRoundReady }) => {
              console.log(
                `🟠 [game/store] Calling signalNextRoundReady for round ${nextRound}`
              );
              signalNextRoundReady(state.currentRoom!, nextRound);
            });
          } else {
            console.warn(
              `🟠 [game/store] Cannot signal ready: room=${
                state.currentRoom
              }, socketHealthy=${isSocketHealthy()}`
            );
          }
        };

        // First attempt - immediate
        signalReady();

        // Retry after 1s, 3s, and 5s to ensure server receives the signal
        setTimeout(signalReady, 1000);
        setTimeout(signalReady, 3000);
        setTimeout(signalReady, 5000);

        // Reset transition state after all retries
        setTimeout(() => {
          console.log(
            `🟠 [game/store] Resetting transition state after 6 seconds`
          );
          useGameStore.setState({
            roundData: {
              ...useGameStore.getState().roundData,
              isTransitioning: false,
            },
          });
        }, 6000);
      }

      console.log('🟠 [game/store] ===== ROUND END PROCESSING COMPLETE =====');
    } catch (error) {
      console.error('🔴 [game/store] Error processing round end event:', error);
    }
  });

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
}
