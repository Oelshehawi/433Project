'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useRoomStore } from '../../lib/room/store';
import { useGameStore } from '../../lib/game/store';
import {
  refreshConnectionStatus,
  isSocketHealthy,
  sendMessage,
} from '../../lib/websocket';
import { useSoundManager, SoundEffect } from '../../lib/utils/SoundManager';

// Import CSS animations
import '../../styles/animations.css';

// Import game components
import GameBackground from '../../components/game/GameBackground';
import CenterDivider from '../../components/game/CenterDivider';
import RoomInfo from '../../components/game/RoomInfo';
import BackButton from '../../components/game/BackButton';
import TowerBlocks from '../../components/game/TowerBlocks';
import RulesButton from '../../components/game/RulesButton';
import GameAnimation from '../../components/game/GameAnimation';
import GameLoader from '../../components/game/GameLoader';
import EventLogger from '../../components/game/EventLogger';
import RoundDisplay from '../../components/game/RoundDisplay';
import PlayerGestureDisplay from '../../components/game/PlayerGestureDisplay';
import Player from '../../components/game/Player';
import GameStateDisplay from '../../components/game/GameStateDisplay';
import GameControls from '../../components/game/GameControls';
import DebugControls from '../../components/game/DebugControls';

// Animation State Manager - Copied from DebugControls.tsx for game functionality
const createAnimationStateManager = () => {
  // Track animations in progress
  const animationsInProgress = new Map<string, boolean>();

  // Generate a unique key for each animation type and player
  const getAnimationKey = (
    type: 'attack' | 'shield' | 'build',
    player: 'player1' | 'player2'
  ): string => {
    return `${type}_${player}`;
  };

  // Check if an animation is already in progress
  const isAnimationInProgress = (
    type: 'attack' | 'shield' | 'build',
    player: 'player1' | 'player2'
  ): boolean => {
    const key = getAnimationKey(type, player);
    return !!animationsInProgress.get(key);
  };

  // Mark an animation as started
  const startAnimation = (
    type: 'attack' | 'shield' | 'build',
    player: 'player1' | 'player2'
  ): boolean => {
    const key = getAnimationKey(type, player);

    // If animation is already in progress, don't start a new one
    if (animationsInProgress.get(key)) {
      console.log(
        `[Game] ${type} animation for ${player} already in progress, ignoring request`
      );
      return false;
    }

    // Mark animation as in progress
    animationsInProgress.set(key, true);
    console.log(`[Game] Starting ${type} animation for ${player}`);
    return true;
  };

  // Mark an animation as completed
  const completeAnimation = (
    type: 'attack' | 'shield' | 'build',
    player: 'player1' | 'player2'
  ): void => {
    const key = getAnimationKey(type, player);
    animationsInProgress.set(key, false);
    console.log(`[Game] Completed ${type} animation for ${player}`);
  };

  return {
    isAnimationInProgress,
    startAnimation,
    completeAnimation,
  };
};

export default function GamePage() {
  const params = useParams();
  const roomId = params.id as string;
  const { currentRoom, error: roomError } = useRoomStore();
  const [connectionRetries, setConnectionRetries] = useState(0);
  const [forceLoader, setForceLoader] = useState(false);
  const [roundStartSent, setRoundStartSent] = useState(false);

  // Create animation state manager for the game
  const animationManagerRef = useRef(createAnimationStateManager());
  const animationManager = animationManagerRef.current;

  // Track animation states for PlayerGestureDisplay synchronization
  const [player1AttackVisible, setPlayer1AttackVisible] = useState(false);
  const [player2AttackVisible, setPlayer2AttackVisible] = useState(false);
  const [player1Explosion, setPlayer1Explosion] = useState(false);
  const [player2Explosion, setPlayer2Explosion] = useState(false);

  // Add objects to track when game_ready should be sent
  const gameReadySent = { current: false };
  const userClickedX = { current: false };

  // Add these to track round state
  const roundStartMap = { current: new Map() }; // Map to track which rounds we've already sent start events for
  const processingRoundStart = { current: false }; // Flag to prevent concurrent round_start processing

  // Move the useSoundManager hook to the top level of the component
  const { playBackgroundMusic, stopBackgroundMusic, playSound } =
    useSoundManager();

  // Use the game store
  const {
    initialize,
    socketConnected,
    error: gameError,
    gameStatus,
    animationState,
    setAnimationComplete,
    player1Name,
    player2Name,
    player1TowerHeight,
    player2TowerHeight,
    player1GoalHeight,
    player2GoalHeight,
    player1ShieldActive,
    player2ShieldActive,
    player1CardPlayed,
    player2CardPlayed,
    roundData,
    isGameEnded,
    winner,
    roundEndMessage,
    eventLogs,
    clearEventLogs,
    pendingRoundNumber,
    requestGameState,
    // Get animation states from the store
    player1Animation,
    player2Animation,
    player1JumpHeight,
    player2JumpHeight,
    // Set player animations
    setPlayerAnimation,
    // Get debug state from game store
    showDebugLogs,
    toggleDebugLogs,
    // Add event logs
    addEventLog,
  } = useGameStore();

  // Handle animation triggers from server events or other sources
  const triggerAnimation = (
    type: 'attack' | 'shield' | 'build',
    player: 'player1' | 'player2'
  ) => {
    // Check if animation is already in progress
    if (animationManager.isAnimationInProgress(type, player)) {
      console.log(
        `[Game] ${type} animation for ${player} already in progress, ignoring request`
      );
      return;
    }

    // Mark animation as started in the manager
    if (!animationManager.startAnimation(type, player)) {
      return;
    }

    // Add debug log
    if (showDebugLogs) {
      addEventLog(`Triggering ${type} animation for ${player}`, 'Animation');
    }

    // Handle animation based on type
    if (type === 'attack') {
      // Play attack sound
      playSound(SoundEffect.ATTACK);

      // Set player animation
      setPlayerAnimation(player, 'jump');

      // Show the attack animation based on which player
      if (player === 'player1') {
        setPlayer1AttackVisible(true);
      } else {
        setPlayer2AttackVisible(true);
      }

      // Attack animation will trigger completion in PlayerGestureDisplay component
    } else if (type === 'shield') {
      // Play shield sound
      playSound(SoundEffect.SHIELD);

      // Shield doesn't have a special animation, just update the shield state in UI
      // PlayerGestureDisplay will handle showing the shield effect

      // Complete the animation after a delay
      setTimeout(() => {
        animationManager.completeAnimation(type, player);
      }, 2000);
    } else if (type === 'build') {
      // Play build sound
      playSound(SoundEffect.BUILD);

      // Set player animation
      setPlayerAnimation(player, 'jump');

      // Add jump effect for building
      if (player === 'player1') {
        useGameStore.setState({ player1JumpHeight: 20 });

        // Reset jump height after a delay
        setTimeout(() => {
          useGameStore.setState({ player1JumpHeight: 0 });
          setPlayerAnimation(player, 'idle');

          // Mark animation as complete
          animationManager.completeAnimation(type, player);
        }, 500);
      } else {
        useGameStore.setState({ player2JumpHeight: 20 });

        // Reset jump height after a delay
        setTimeout(() => {
          useGameStore.setState({ player2JumpHeight: 0 });
          setPlayerAnimation(player, 'idle');

          // Mark animation as complete
          animationManager.completeAnimation(type, player);
        }, 500);
      }
    }
  };

  // Handler for attack animation completion from PlayerGestureDisplay
  const handleAttackAnimationComplete = (player: 'player1' | 'player2') => {
    console.log(`[Game] Attack animation completed for ${player}`);

    // Reset player animation to idle
    setPlayerAnimation(player, 'idle');

    // Mark animation as completed in the manager
    animationManager.completeAnimation('attack', player);
  };

  // Create a centralized function to send round_start events
  const sendRoundStart = async (roomId: string, roundNumber: number) => {
    // Prevent duplicate/concurrent requests for the same round
    if (
      processingRoundStart.current ||
      roundStartMap.current.has(roundNumber)
    ) {
      console.log(
        `[GamePage] Already sent/processing round_start for round ${roundNumber}`
      );
      return;
    }

    try {
      console.log(`[GamePage] Sending round_start for round ${roundNumber}`);
      processingRoundStart.current = true;

      // Mark this round as being started
      roundStartMap.current.set(roundNumber, true);

      // For round 1, also update roundStartSent state
      if (roundNumber === 1) {
        setRoundStartSent(true);
      }

      // Import and use the sendMessage function
      const { sendMessage } = await import('../../lib/websocket');
      await sendMessage('round_start', { roomId, roundNumber });

      console.log(
        `[GamePage] round_start for round ${roundNumber} sent successfully`
      );

      // After round_start is sent successfully for round 1, request game state
      if (roundNumber === 1) {
        setTimeout(() => {
          console.log('[GamePage] Requesting game state after round_start');
          requestGameState();
        }, 500);
      }
    } catch (err) {
      console.error(
        `[GamePage] Error sending round_start for round ${roundNumber}:`,
        err
      );
      // Remove from map so we can retry
      roundStartMap.current.delete(roundNumber);
    } finally {
      processingRoundStart.current = false;
    }
  };

  // Custom handler for rules animation completion
  const handleRulesAnimationComplete = () => {
    console.log('[GamePage] User clicked X to close rules animation');
    userClickedX.current = true;
    setAnimationComplete('rulesAnimationComplete', true);

    // Send game_ready directly when the user clicks X
    if (isSocketHealthy() && !gameReadySent.current && roomId) {
      console.log(
        '[GamePage] Sending game_ready immediately after user click'
      );
      gameReadySent.current = true;

      import('../../lib/websocket').then(({ sendMessage }) => {
        sendMessage('game_ready', { roomId })
          .then(() => {
            console.log(
              '[GamePage] game_ready sent successfully on modal close'
            );
            // Add a small delay before sending round_start
            setTimeout(() => {
              // Only send round_start if not already sent
              if (!roundStartSent) {
                console.log('[GamePage] Sending initial round_start event');
                sendMessage('round_start', { roomId, roundNumber: 1 })
                  .then(() => {
                    console.log('[GamePage] round_start sent successfully');
                    setRoundStartSent(true);

                    // Request game state after round_start is sent
                    setTimeout(() => {
                      console.log(
                        '[GamePage] Requesting game state after round_start'
                      );
                      requestGameState();
                    }, 500);
                  })
                  .catch((err) => {
                    console.error(
                      '[GamePage] Error sending round_start:',
                      err
                    );
                  });
              }
            }, 500);
          })
          .catch((err) => {
            console.error('[GamePage] Error sending game_ready:', err);
            // If we failed to send, allow retrying
            gameReadySent.current = false;
          });
      });
    }
  };

  // Immediately verify connection status when page loads
  useEffect(() => {
    console.log('[GamePage] Mounted, verifying connection state');

    // Helper function to wait for socket to be healthy and then signal game ready
    const ensureConnectionAndSignalReady = async () => {
      try {
        // Wait up to 5 seconds for the socket to be healthy
        let attempts = 0;
        while (!isSocketHealthy() && attempts < 5) {
          console.log(
            `[GamePage] Waiting for socket to be healthy (attempt ${
              attempts + 1
            })`
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
          refreshConnectionStatus();
          attempts++;
        }

        // If socket is healthy, signal ready for game/next round
        if (isSocketHealthy()) {
          console.log('[GamePage] Socket is healthy, signaling readiness');
          useGameStore.setState({ socketConnected: true });

          // If we have a pending round, signal ready for it
          const state = useGameStore.getState();
          if (state.pendingRoundNumber && !state.roundData.isTransitioning) {
            console.log(
              `[GamePage] Signaling ready for pending round ${state.pendingRoundNumber}`
            );
            state.readyForNextRound(state.pendingRoundNumber);
          } else if (
            state.gameStatus === 'waiting' &&
            state.animationState.rulesAnimationComplete
          ) {
            // If we're just starting the game, send game_ready
            console.log('[GamePage] Signaling game_ready');
            sendMessage('game_ready', { roomId }).catch(console.error);
          }
        } else {
          console.error(
            '[GamePage] Failed to establish healthy socket connection'
          );
          setForceLoader(true);
        }
      } catch (error) {
        console.error('[GamePage] Error in connection setup:', error);
      }
    };

    // Check if socket is already healthy
    if (isSocketHealthy()) {
      console.log('[GamePage] Socket is already healthy');
      // Force the game store to acknowledge it
      useGameStore.setState({ socketConnected: true });
    } else {
      console.log('[GamePage] Refreshing connection status');
      // Refresh connection status to ensure events are properly dispatched
      refreshConnectionStatus();

      // Set a brief force loader to avoid flickering UI during connection recovery
      setForceLoader(true);

      // Clear the loader after a short delay
      setTimeout(() => {
        setForceLoader(false);
      }, 1500);

      // Try to establish connection
      ensureConnectionAndSignalReady();
    }

    // Connection recovery interval
    const recoveryInterval = setInterval(() => {
      if (!isSocketHealthy()) {
        console.log(
          '[GamePage] Recovery interval: Socket not healthy, attempting to refresh'
        );
        refreshConnectionStatus();
        ensureConnectionAndSignalReady();
      }
    }, 10000);

    // Cleanup interval on unmount
    return () => {
      clearInterval(recoveryInterval);
    };
  }, [roomId]);

  // Initialize game when component mounts
  useEffect(() => {
    if (roomId) {
      console.log('[GamePage] Initializing game for room:', roomId);
      initialize(roomId).catch((error) => {
        console.error('[GamePage] Error initializing game:', error);
        setConnectionRetries((prev) => prev + 1);
      });

      // Add event listener for round_end_ack to send round_start
      const handleRoundEndAck = (event: CustomEventInit) => {
        try {
          const { roomId, roundNumber } = event.detail || {};
          console.log(
            '[GamePage] Received round_end_ack event:',
            event.detail
          );

          // Calculate next round number - EXPLICITLY add 1 to current round
          const nextRoundNumber = roundNumber + 1;

          console.log(
            `[GamePage] Sending round_start for round ${nextRoundNumber}`
          );

          // Use imported sendMessage to ensure it's available
          import('../../lib/websocket').then(({ sendMessage }) => {
            // Send round_start event for the next round - ENSURE THE ROUND NUMBER IS INCREMENTED
            sendMessage('round_start', {
              roomId,
              roundNumber: nextRoundNumber, // This is the key fix - always use nextRoundNumber
            }).catch((err) => {
              console.error('[GamePage] Error sending round_start:', err);
            });
          });
        } catch (error) {
          console.error('[GamePage] Error handling round_end_ack:', error);
        }
      };

      // Register the event listener
      window.addEventListener('round_end_ack', handleRoundEndAck);

      // Clean up the event listener when component unmounts
      return () => {
        window.removeEventListener('round_end_ack', handleRoundEndAck);
      };
    }
  }, [roomId, initialize, connectionRetries, requestGameState]);

  // Handle player name updates when room data is available
  useEffect(() => {
    if (currentRoom && currentRoom.players.length > 0) {
      // Find BeagleBoard players
      const beagleBoardPlayers = currentRoom.players.filter(
        (p) => p.playerType === 'beagleboard'
      );

      // Set player names based on the order they appear in the array
      if (beagleBoardPlayers.length >= 1) {
        useGameStore.setState({ player1Name: beagleBoardPlayers[0].name });
      }

      if (beagleBoardPlayers.length >= 2) {
        useGameStore.setState({ player2Name: beagleBoardPlayers[1].name });
      }
    }
  }, [currentRoom]);

  // Handle pending round transitions
  useEffect(() => {
    if (pendingRoundNumber && !roundData.isTransitioning) {
      console.log(
        `[GamePage] Ready for round ${pendingRoundNumber}, sending round_start`
      );
      // Send round_start for the pending round
      if (roomId) {
        sendRoundStart(roomId, pendingRoundNumber);
      }
    }
  }, [pendingRoundNumber, roundData.isTransitioning, roomId]);

  // Modify the useEffect that was handling game_ready to remove the duplicate sends
  useEffect(() => {
    console.log(
      `[GamePage] Game status: ${gameStatus}, Round: ${roundData.roundNumber}`
    );
    console.log(
      `[GamePage] Transition state: ${roundData.isTransitioning}, Pending round: ${pendingRoundNumber}`
    );
  }, [gameStatus, roundData, pendingRoundNumber]);

  // Add automatic connection retry
  useEffect(() => {
    if (!socketConnected && connectionRetries < 3) {
      const retryTimer = setTimeout(() => {
        console.log(
          `[GamePage] Connection retry attempt #${connectionRetries + 1}`
        );
        refreshConnectionStatus();
        setConnectionRetries((prev) => prev + 1);
      }, 1500 * (connectionRetries + 1)); // Increasing delay with each retry

      return () => clearTimeout(retryTimer);
    }
  }, [socketConnected, connectionRetries]);

  // Find the useEffect hook that handles game state changes
  useEffect(() => {
    if (
      gameStatus === 'playing' &&
      !isGameEnded &&
      !animationState.isAnimating
    ) {
      // If animations are complete, make sure to play background music
      if (animationState.animationComplete) {
        playBackgroundMusic();
      }
    }
  }, [
    gameStatus,
    isGameEnded,
    animationState.isAnimating,
    animationState.animationComplete,
    playBackgroundMusic,
  ]);

  // Add cleanup for background music when component unmounts
  useEffect(() => {
    // Clean up when component unmounts
    return () => {
      stopBackgroundMusic();
    };
  }, [stopBackgroundMusic]);

  // Stop background music when game ends
  useEffect(() => {
    if (isGameEnded) {
      stopBackgroundMusic();
    }
  }, [isGameEnded, stopBackgroundMusic]);

  // Add effect to trigger animations based on player cards
  useEffect(() => {
    // Check for player1 attack card
    if (
      player1CardPlayed?.toLowerCase() === 'attack' &&
      !player1AttackVisible
    ) {
      triggerAnimation('attack', 'player1');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player1CardPlayed]);

  // Add effect to trigger animations based on player cards
  useEffect(() => {
    // Check for player2 attack card
    if (
      player2CardPlayed?.toLowerCase() === 'attack' &&
      !player2AttackVisible
    ) {
      triggerAnimation('attack', 'player2');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player2CardPlayed]);

  // Add effect to trigger animations for shield
  useEffect(() => {
    if (
      player1ShieldActive &&
      !animationManager.isAnimationInProgress('shield', 'player1')
    ) {
      triggerAnimation('shield', 'player1');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player1ShieldActive]);

  // Add effect to trigger animations for shield
  useEffect(() => {
    if (
      player2ShieldActive &&
      !animationManager.isAnimationInProgress('shield', 'player2')
    ) {
      triggerAnimation('shield', 'player2');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player2ShieldActive]);

  // Helper function to get player name by ID
  const getPlayerNameById = (playerId: string): string => {
    if (!currentRoom) return playerId;
    const player = currentRoom.players.find((p) => p.id === playerId);
    return player ? player.name : playerId;
  };

  // We will always render everything, but show/hide based on game state
  return (
    <>
      {!socketConnected || !currentRoom || forceLoader ? (
        <GameLoader
          isConnecting={!socketConnected}
          isLoading={socketConnected && !currentRoom}
          connectionErrorMessage={gameError || roomError || undefined}
        />
      ) : (
        <div className='min-h-screen flex flex-col items-center justify-center overflow-hidden'>
          {/* Game Arena */}
          <div className='relative w-full h-screen flex overflow-hidden'>
            {/* Background */}
            <GameBackground />

            {/* Game Animation Component for Title and Rules */}
            <GameAnimation
              showTitleAnimation={
                gameStatus === 'waiting' && animationState.showTitleAnimation
              }
              showRulesAnimation={
                gameStatus === 'waiting' && animationState.showRulesAnimation
              }
              onTitleAnimationComplete={() =>
                setAnimationComplete('titleAnimationComplete', true)
              }
              onRulesAnimationComplete={handleRulesAnimationComplete}
            />

            {/* Center Divider */}
            <CenterDivider />

            {/* Always show players regardless of game state - with animations from store */}
            <Player
              playerId='player1'
              name={player1Name}
              isVisible={true}
              animationState={player1Animation}
              jumpHeight={player1JumpHeight}
            />
            <Player
              playerId='player2'
              name={player2Name}
              isVisible={true}
              animationState={player2Animation}
              jumpHeight={player2JumpHeight}
            />

            {/* Add Rules button outside the game state conditional so it's always visible */}
            <RulesButton />

            {/* Add Debug Controls next to the Rules button */}
            <DebugControls
              isVisible={showDebugLogs}
              onToggleVisibility={toggleDebugLogs}
            />

            {/* Game state display */}
            {gameStatus === 'playing' && (
              <>
                {/* Add the GameStateDisplay component */}
                <GameStateDisplay />

                {/* Round information display */}
                <RoundDisplay
                  gameEnded={isGameEnded}
                  currentRound={roundData.roundNumber}
                  roundTimeRemaining={roundData.timeRemaining}
                  winnerName={winner ? getPlayerNameById(winner) : ''}
                  roundEndMessage={roundEndMessage}
                />

                {/* Debug event logs - only show when toggled on */}
                {showDebugLogs && (
                  <EventLogger
                    eventLogs={eventLogs}
                    onClearLogs={clearEventLogs}
                  />
                )}

                {/* Tower blocks for both players */}
                <TowerBlocks
                  player1Blocks={player1TowerHeight}
                  player2Blocks={player2TowerHeight}
                  player1Goal={player1GoalHeight}
                  player2Goal={player2GoalHeight}
                  isVisible={gameStatus === 'playing'}
                />

                {/* Player gesture displays and shields */}
                <PlayerGestureDisplay
                  player1CardPlayed={player1CardPlayed}
                  player2CardPlayed={player2CardPlayed}
                  player1ShieldActive={player1ShieldActive}
                  player2ShieldActive={player2ShieldActive}
                  gameState={gameStatus === 'playing' ? 'playing' : 'starting'}
                  onPlayer1AttackComplete={() =>
                    handleAttackAnimationComplete('player1')
                  }
                  onPlayer2AttackComplete={() =>
                    handleAttackAnimationComplete('player2')
                  }
                  player1AttackVisible={player1AttackVisible}
                  player2AttackVisible={player2AttackVisible}
                  setPlayer1AttackVisible={setPlayer1AttackVisible}
                  setPlayer2AttackVisible={setPlayer2AttackVisible}
                  player1Explosion={player1Explosion}
                  player2Explosion={player2Explosion}
                  setPlayer1Explosion={setPlayer1Explosion}
                  setPlayer2Explosion={setPlayer2Explosion}
                />

                {/* Game Controls */}
                <GameControls />
              </>
            )}

            {/* Game info and back button */}
            <RoomInfo roomId={roomId} isVisible={true} />
            <BackButton isVisible={true} />
          </div>
        </div>
      )}
    </>
  );
}
