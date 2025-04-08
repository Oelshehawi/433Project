'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useRoomStore } from '../../lib/room/store';
import { useGameStore } from '../../lib/game/store';
import { refreshConnectionStatus, isSocketHealthy } from '../../lib/websocket';

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
  } = useGameStore();

  // Immediately verify connection status when page loads
  useEffect(() => {
    console.log('[GamePage] Mounted, verifying connection state');

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
      setTimeout(() => {
        setForceLoader(false);
      }, 1000);
    }
  }, []);

  // Initialize game when component mounts
  useEffect(() => {
    if (roomId) {
      console.log('GamePage: Initializing game for room:', roomId);
      initialize(roomId).catch((error) => {
        console.error('[GamePage] Error initializing game:', error);
        setConnectionRetries((prev) => prev + 1);
      });
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
      console.log(`GamePage: Ready for round ${pendingRoundNumber}`);
      readyForNextRound(pendingRoundNumber);
    }
  }, [pendingRoundNumber, roundData.isTransitioning, readyForNextRound]);

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
              onRulesAnimationComplete={() =>
                setAnimationComplete('rulesAnimationComplete', true)
              }
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
