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

export default function GamePage() {
  const params = useParams();
  const roomId = params.id as string;
  const { currentRoom, error: roomError } = useRoomStore();
  const [connectionRetries, setConnectionRetries] = useState(0);
  const [forceLoader, setForceLoader] = useState(false);
  const [roundStartSent, setRoundStartSent] = useState(false);

  // Add refs to track when game_ready should be sent
  const gameReadySent = useRef(false);
  const userClickedX = useRef(false);

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
    readyForNextRound,
    pendingRoundNumber,
    requestGameState,
  } = useGameStore();

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
      console.log('🔵 [GamePage] Initializing game for room:', roomId);
      initialize(roomId).catch((error) => {
        console.error('🔴 [GamePage] Error initializing game:', error);
        setConnectionRetries((prev) => prev + 1);
      });

      // Add event listener for round_end_ack to send round_start
      const handleRoundEndAck = (event: CustomEventInit) => {
        try {
          const { roomId, roundNumber } = event.detail || {};
          console.log(
            '🟢 [GamePage] Received round_end_ack event:',
            event.detail
          );

          // Calculate next round number
          const nextRoundNumber = roundNumber + 1;

          // Send round_start event for the next round
          console.log(
            `🟢 [GamePage] Sending round_start for round ${nextRoundNumber}`
          );

          sendMessage('round_start', {
            roomId,
            roundNumber: nextRoundNumber,
          }).catch((err) => {
            console.error('🔴 [GamePage] Error sending round_start:', err);
          });
        } catch (error) {
          console.error('🔴 [GamePage] Error handling round_end_ack:', error);
        }
      };

      // Register the event listener
      window.addEventListener('round_end_ack', handleRoundEndAck);

      // Clean up the event listener when component unmounts
      return () => {
        window.removeEventListener('round_end_ack', handleRoundEndAck);
      };
    }
  }, [roomId, initialize, connectionRetries]);

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
        `🟢 [GamePage] Ready for round ${pendingRoundNumber}, signaling to server`
      );
      readyForNextRound(pendingRoundNumber);
    } else if (pendingRoundNumber && roundData.isTransitioning) {
      console.log(
        `🟡 [GamePage] Pending round ${pendingRoundNumber} but still transitioning, waiting...`
      );
    }
  }, [pendingRoundNumber, roundData.isTransitioning, readyForNextRound]);

  // Custom handler for rules animation completion
  const handleRulesAnimationComplete = () => {
    // Only if we haven't processed this click before
    if (!userClickedX.current) {
      console.log('🎮 [GamePage] User clicked X to close rules animation');
      userClickedX.current = true;
      setAnimationComplete('rulesAnimationComplete', true);

      // Send game_ready directly when the user clicks X
      if (isSocketHealthy() && !gameReadySent.current && roomId) {
        console.log(
          '🚀 [GamePage] Sending game_ready immediately after user click'
        );
        gameReadySent.current = true;

        import('../../lib/websocket').then(({ sendMessage }) => {
          sendMessage('game_ready', { roomId })
            .then(() => {
              console.log(
                '✅ [GamePage] game_ready sent successfully on modal close'
              );
              // Add a small delay before sending round_start
              setTimeout(() => {
                // Only send round_start if not already sent
                if (!roundStartSent) {
                  console.log(
                    '🚀 [GamePage] Sending initial round_start event'
                  );
                  sendMessage('round_start', { roomId, roundNumber: 1 })
                    .then(() => {
                      console.log(
                        '✅ [GamePage] round_start sent successfully'
                      );
                      setRoundStartSent(true);

                      // Request game state after round_start is sent
                      setTimeout(() => {
                        console.log(
                          '🚀 [GamePage] Requesting game state after round_start'
                        );
                        requestGameState();
                      }, 500);
                    })
                    .catch((err) => {
                      console.error(
                        '🔴 [GamePage] Error sending round_start:',
                        err
                      );
                    });
                }
              }, 500);
            })
            .catch((err) => {
              console.error('🔴 [GamePage] Error sending game_ready:', err);
              // If we failed to send, allow retrying
              gameReadySent.current = false;
            });
        });
      }
    }
  };

  // Modify the useEffect that was handling game_ready to remove the duplicate sends
  useEffect(() => {
    console.log(
      `🌟 [GamePage] Game status: ${gameStatus}, Round: ${roundData.roundNumber}`
    );
    console.log(
      `🌟 [GamePage] Transition state: ${roundData.isTransitioning}, Pending round: ${pendingRoundNumber}`
    );

    // IMPORTANT: We've moved the game_ready and round_start logic directly to the
    // handleRulesAnimationComplete function to ensure it only happens on direct user action

    // Only handle pending round transitions here, not initial game_ready
    if (
      pendingRoundNumber &&
      !roundData.isTransitioning &&
      pendingRoundNumber > 1
    ) {
      console.log(
        `🟢 [GamePage] Ready for round ${pendingRoundNumber}, signaling to server`
      );
      readyForNextRound(pendingRoundNumber);
    }
  }, [gameStatus, roundData, pendingRoundNumber, readyForNextRound]);

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

            {/* Always show players regardless of game state */}
            <Player playerId='player1' name={player1Name} isVisible={true} />
            <Player playerId='player2' name={player2Name} isVisible={true} />

            {/* Add Rules button outside the game state conditional so it's always visible */}
            <RulesButton />

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

                {/* Debug event logs */}
                <EventLogger
                  eventLogs={eventLogs}
                  onClearLogs={clearEventLogs}
                />

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
