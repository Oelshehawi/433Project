"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRoomStore } from "../../lib/room/store";

// Import game components
import GameBackground from "../../components/game/GameBackground";
import CenterDivider from "../../components/game/CenterDivider";
import RoomInfo from "../../components/game/RoomInfo";
import BackButton from "../../components/game/BackButton";
import TowerBlocks from "../../components/game/TowerBlocks";
import RulesButton from "../../components/game/RulesButton";
import GameAnimation from "../../components/game/GameAnimation";
import GameLoader from "../../components/game/GameLoader";
import EventLogger from "../../components/game/EventLogger";
import RoundDisplay from "../../components/game/RoundDisplay";
import PlayerGestureDisplay from "../../components/game/PlayerGestureDisplay";
import GameEventHandler from "../../components/game/GameEventHandler";
import RoundTransitionHandler from "../../components/game/RoundTransitionHandler";
import GameInitializer from "../../components/game/GameInitializer";
import Player from "../../components/game/Player";

// Game states
type GameStateType = "starting" | "playing";

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;
  const { currentRoom, error } = useRoomStore();
  const [socketConnected, setSocketConnected] = useState(false);
  const [gameState, setGameState] = useState<GameStateType>("starting");

  // Animation states for gameplay
  const [textAnimationComplete, setTextAnimationComplete] = useState(false);
  const [rulesAnimationComplete, setRulesAnimationComplete] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false); // Track if animations are in progress
  const [moveAnimations, setMoveAnimations] = useState<
    Array<{ playerId: string; gesture: string }>
  >([]);

  // Game state for gameplay
  const [player1ShieldActive, setPlayer1ShieldActive] = useState(false);
  const [player2ShieldActive, setPlayer2ShieldActive] = useState(false);
  const [player1BlockCount, setPlayer1BlockCount] = useState(0);
  const [player2BlockCount, setPlayer2BlockCount] = useState(0);
  const [player1Name, setPlayer1Name] = useState("Player 1");
  const [player2Name, setPlayer2Name] = useState("Player 2");

  // Game state for tower building
  const [player1TowerHeight, setPlayer1TowerHeight] = useState(0);
  const [player2TowerHeight, setPlayer2TowerHeight] = useState(0);
  const [player1GoalHeight, setPlayer1GoalHeight] = useState(5);
  const [player2GoalHeight, setPlayer2GoalHeight] = useState(5);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [roundTimeRemaining, setRoundTimeRemaining] = useState(30);
  const [roundTimer, setRoundTimer] = useState<NodeJS.Timeout | null>(null);
  const [gameEnded, setGameEnded] = useState(false);
  const [winner, setWinner] = useState<string>("");

  // Add state for card played messages
  const [player1CardPlayed, setPlayer1CardPlayed] = useState<string>("");
  const [player2CardPlayed, setPlayer2CardPlayed] = useState<string>("");
  const [cardPlayedTimer, setCardPlayedTimer] = useState<NodeJS.Timeout | null>(
    null
  );

  // Add state for round end message
  const [roundEndMessage, setRoundEndMessage] = useState<string>("");

  // Add state for event log display
  const [eventLogs, setEventLogs] = useState<string[]>([]);
  const maxEventLogs = 10; // Increased from 5 to show more logs

  // Add animation states for round transitions
  const [isRoundTransitioning, setIsRoundTransitioning] = useState(false);
  const [pendingRoundNumber, setPendingRoundNumber] = useState<number | null>(
    null
  );

  // Enhanced function to add an event log with timestamp and source
  const addEventLog = (message: string, source: string = "UI") => {
    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;

    setEventLogs((prev) => {
      const formattedMessage = `${timestamp} [${source}] ${message}`;
      const newLogs = [formattedMessage, ...prev.slice(0, maxEventLogs - 1)];
      return newLogs;
    });
  };

  // Function to clear all event logs
  const clearEventLogs = () => {
    setEventLogs([]);
    addEventLog("Logs cleared", "UI");
  };

  // Set player names when room data is available
  useEffect(() => {
    if (currentRoom && currentRoom.players.length > 0) {
      // Find BeagleBoard players
      const beagleBoardPlayers = currentRoom.players.filter(
        (p) => p.playerType === "beagleboard"
      );

      // Set player names based on the order they appear in the array
      if (beagleBoardPlayers.length >= 1) {
        setPlayer1Name(beagleBoardPlayers[0].name);
      }

      if (beagleBoardPlayers.length >= 2) {
        setPlayer2Name(beagleBoardPlayers[1].name);
      }
    }
  }, [currentRoom]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (roundTimer) clearInterval(roundTimer);
    };
  }, [roundTimer]);

  // Tower block handlers
  const addPlayer1Block = () => {
    setPlayer1BlockCount((prev) => prev + 1);
  };

  const removePlayer1Block = () => {
    setPlayer1BlockCount((prev) => Math.max(0, prev - 1));
  };

  const addPlayer2Block = () => {
    setPlayer2BlockCount((prev) => prev + 1);
  };

  const removePlayer2Block = () => {
    setPlayer2BlockCount((prev) => Math.max(0, prev - 1));
  };

  // Update player names display
  const getPlayerNameById = (playerId: string): string => {
    if (!currentRoom) return playerId;
    const player = currentRoom.players.find((p) => p.id === playerId);
    return player ? player.name : playerId;
  };

  // Game ending display
  const getGameEndedDisplay = (): string => {
    if (!winner) return "Game Ended";
    return `${getPlayerNameById(winner)} Wins!`;
  };

  // If socket is not connected or room data is not loaded, show loader
  if (!socketConnected || !currentRoom) {
    return (
      <GameLoader
        isConnecting={!socketConnected}
        isLoading={socketConnected && !currentRoom}
        connectionErrorMessage={error || undefined}
      />
    );
  }

  // Render game UI
  return (
    <div className="min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Game Arena */}
      <div className="relative w-full h-screen flex overflow-hidden">
        {/* Background */}
        <GameBackground />

        {/* Game Event Handler - Silent component for managing events */}
        <GameEventHandler
          roomId={roomId}
          socketConnected={socketConnected}
          currentRoom={currentRoom}
          addEventLog={addEventLog}
          setCurrentRound={setCurrentRound}
          setRoundTimeRemaining={setRoundTimeRemaining}
          setRoundTimer={setRoundTimer}
          roundTimer={roundTimer}
          setPlayer1TowerHeight={setPlayer1TowerHeight}
          setPlayer2TowerHeight={setPlayer2TowerHeight}
          setPlayer1GoalHeight={setPlayer1GoalHeight}
          setPlayer2GoalHeight={setPlayer2GoalHeight}
          setRoundEndMessage={setRoundEndMessage}
          setGameEnded={setGameEnded}
          setWinner={setWinner}
          setPlayer1CardPlayed={setPlayer1CardPlayed}
          setPlayer2CardPlayed={setPlayer2CardPlayed}
          setCardPlayedTimer={setCardPlayedTimer}
          cardPlayedTimer={cardPlayedTimer}
          setPlayer1ShieldActive={setPlayer1ShieldActive}
          setPlayer2ShieldActive={setPlayer2ShieldActive}
          addPlayer1Block={addPlayer1Block}
          addPlayer2Block={addPlayer2Block}
          player1Name={player1Name}
          player2Name={player2Name}
          setIsAnimating={setIsAnimating}
          setMoveAnimations={setMoveAnimations}
          setPendingRoundNumber={setPendingRoundNumber}
        />

        {/* Round Transition Handler - Silent component for managing round transitions */}
        <RoundTransitionHandler
          pendingRoundNumber={pendingRoundNumber}
          isRoundTransitioning={isRoundTransitioning}
          roomId={roomId}
          socketConnected={socketConnected}
          setIsRoundTransitioning={setIsRoundTransitioning}
          setPendingRoundNumber={setPendingRoundNumber}
          addEventLog={addEventLog}
        />

        {/* Game Initializer - Silent component for game initialization */}
        <GameInitializer
          roomId={roomId}
          setSocketConnected={setSocketConnected}
          gameState={gameState}
          textAnimationComplete={textAnimationComplete}
          rulesAnimationComplete={rulesAnimationComplete}
          animationComplete={animationComplete}
          setAnimationComplete={setAnimationComplete}
          setGameState={setGameState}
          addEventLog={addEventLog}
        />

        {/* Game Animation Component for Title and Rules */}
        <GameAnimation
          showTitleAnimation={
            gameState === "starting" && !textAnimationComplete
          }
          showRulesAnimation={
            gameState === "starting" &&
            textAnimationComplete &&
            !rulesAnimationComplete
          }
          onTitleAnimationComplete={() => setTextAnimationComplete(true)}
          onRulesAnimationComplete={() => setRulesAnimationComplete(true)}
        />

        {/* Center Divider */}
        <CenterDivider />

        {/* Game state display */}
        {gameState === "playing" && (
          <>
            {/* Round information display */}
            <RoundDisplay
              gameEnded={gameEnded}
              currentRound={currentRound}
              roundTimeRemaining={roundTimeRemaining}
              winnerName={winner ? getPlayerNameById(winner) : ""}
              roundEndMessage={roundEndMessage}
            />

            {/* Debug event logs */}
            <EventLogger eventLogs={eventLogs} onClearLogs={clearEventLogs} />

            {/* Rules button - top left corner */}
            <RulesButton />

            {/* Tower blocks for both players */}
            <TowerBlocks
              player1Blocks={player1TowerHeight}
              player2Blocks={player2TowerHeight}
              player1Goal={player1GoalHeight}
              player2Goal={player2GoalHeight}
              isVisible={gameState === "playing"}
            />

            {/* Player displays */}
            <Player
              playerId="player1"
              name={player1Name}
              isVisible={
                gameState === "playing" ||
                (gameState === "starting" && animationComplete)
              }
            />
            <Player
              playerId="player2"
              name={player2Name}
              isVisible={
                gameState === "playing" ||
                (gameState === "starting" && animationComplete)
              }
            />

            {/* Player gesture displays and shields */}
            <PlayerGestureDisplay
              player1CardPlayed={player1CardPlayed}
              player2CardPlayed={player2CardPlayed}
              player1ShieldActive={player1ShieldActive}
              player2ShieldActive={player2ShieldActive}
              gameState={gameState}
            />
          </>
        )}

        {/* Game info and back button */}
        <RoomInfo roomId={roomId} isVisible={true} />
        <BackButton isVisible={true} />
      </div>
    </div>
  );
}
