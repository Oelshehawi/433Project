"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useRoomStore } from "../../lib/room/store";
import { initializeSocket, getSocketStatus } from "../../lib/websocket";
import { getSavedRoomInfo } from "../../components/room/RoomHelpers";

// Import game components
import GameBackground from "../../components/game/GameBackground";
import CenterDivider from "../../components/game/CenterDivider";
import GestureTowerTitle from "../../components/game/GestureTowerTitle";
import Player from "../../components/game/Player";
import RoomInfo from "../../components/game/RoomInfo";
import BackButton from "../../components/game/BackButton";
import Shield from "../../components/game/Shield";
import ShieldButtons from "../../components/game/ShieldButtons";
import TowerBlocks from "../../components/game/TowerBlocks";
import TowerControls from "../../components/game/TowerControls";
import RulesScroll from "../../components/game/RulesScroll";
import RulesButton from "../../components/game/RulesButton";

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
  const [currentTurn, setCurrentTurn] = useState<string>("");
  const [turnTimeRemaining, setTurnTimeRemaining] = useState(30);
  const [turnTimer, setTurnTimer] = useState<NodeJS.Timeout | null>(null);
  const [gameEnded, setGameEnded] = useState(false);
  const [winner, setWinner] = useState<string>("");

  // Initialize WebSocket connection
  useEffect(() => {
    const socket = initializeSocket();
    console.log("WebSocket initializing in game page");

    // Check if socket is already connected
    if (getSocketStatus() === "connected") {
      setSocketConnected(true);
    } else {
      // Set up event listener for socket connection
      const handleSocketConnected = () => {
        console.log("WebSocket connected in game page");
        setSocketConnected(true);
      };

      window.addEventListener("ws_connected", handleSocketConnected);

      return () => {
        window.removeEventListener("ws_connected", handleSocketConnected);
      };
    }
  }, []);

  // Verify we have proper room data
  useEffect(() => {
    // If we're connected but have no room data, try to get it from localStorage
    if (socketConnected && !currentRoom) {
      const savedInfo = getSavedRoomInfo();

      if (!savedInfo.roomId || savedInfo.roomId !== roomId) {
        // No valid saved info, redirect to home
        console.log("No valid room info found, redirecting to home");
        router.push("/");
        return;
      }
    }
  }, [socketConnected, currentRoom, roomId, router]);

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

  // Sequential animation steps for gameplay
  useEffect(() => {
    if (gameState === "starting") {
      if (textAnimationComplete && !rulesAnimationComplete) {
        // Text animation is complete, rules scroll is showing
        // Rules will now stay visible until dismissed with the X button
      } else if (textAnimationComplete && rulesAnimationComplete) {
        // User has dismissed the rules, now show players and move to playing state
        setAnimationComplete(true);
        setGameState("playing");
      }
    }
  }, [gameState, textAnimationComplete, rulesAnimationComplete]);

  // Add event listeners for tower game events
  useEffect(() => {
    if (socketConnected) {
      // Turn start event handler
      const handleTurnStart = (event: CustomEvent) => {
        const data = event.detail;
        if (data.roomId === roomId) {
          setCurrentTurn(data.playerId);
          setTurnTimeRemaining(Math.floor(data.remainingTime / 1000));

          // Start countdown timer
          if (turnTimer) clearInterval(turnTimer);
          const timer = setInterval(() => {
            setTurnTimeRemaining((prev) => {
              if (prev <= 1) {
                clearInterval(timer);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);

          setTurnTimer(timer);
        }
      };

      // Turn end event handler
      const handleTurnEnd = (event: CustomEvent) => {
        const data = event.detail;
        if (data.roomId === roomId) {
          setCurrentTurn(data.nextPlayerId);

          // Update game state
          if (data.gameState) {
            const gameState = data.gameState;

            // Get player IDs from the room data
            const beagleBoardPlayers =
              currentRoom?.players.filter(
                (p) => p.playerType === "beagleboard"
              ) || [];

            // Update tower heights
            if (gameState.towerHeights && beagleBoardPlayers.length >= 2) {
              const player1Id = beagleBoardPlayers[0].id;
              const player2Id = beagleBoardPlayers[1].id;

              setPlayer1TowerHeight(gameState.towerHeights[player1Id] || 0);
              setPlayer2TowerHeight(gameState.towerHeights[player2Id] || 0);
            }

            // Update goal heights if they exist
            if (gameState.goalHeights && beagleBoardPlayers.length >= 2) {
              const player1Id = beagleBoardPlayers[0].id;
              const player2Id = beagleBoardPlayers[1].id;

              setPlayer1GoalHeight(gameState.goalHeights[player1Id] || 5);
              setPlayer2GoalHeight(gameState.goalHeights[player2Id] || 5);
            }
          }
        }
      };

      // Game ended event handler
      const handleGameEnded = (event: CustomEvent) => {
        const data = event.detail;
        if (data.roomId === roomId) {
          setGameEnded(true);
          setWinner(data.winnerId);

          // Clear any existing timer
          if (turnTimer) clearInterval(turnTimer);

          // Update final game state
          if (data.gameState) {
            const gameState = data.gameState;

            // Get player IDs from the room data
            const beagleBoardPlayers =
              currentRoom?.players.filter(
                (p) => p.playerType === "beagleboard"
              ) || [];

            // Update tower heights
            if (gameState.towerHeights && beagleBoardPlayers.length >= 2) {
              const player1Id = beagleBoardPlayers[0].id;
              const player2Id = beagleBoardPlayers[1].id;

              setPlayer1TowerHeight(gameState.towerHeights[player1Id] || 0);
              setPlayer2TowerHeight(gameState.towerHeights[player2Id] || 0);
            }
          }
        }
      };

      // Gesture event handler to update UI
      const handleGestureEvent = (event: CustomEvent) => {
        const data = event.detail;
        // Update UI based on the gesture (could add animations later)
        console.log(
          "Gesture received:",
          data.gesture,
          "from player:",
          data.playerId
        );
      };

      // Add event listeners
      window.addEventListener("turn_start", handleTurnStart as EventListener);
      window.addEventListener("turn_end", handleTurnEnd as EventListener);
      window.addEventListener("game_ended", handleGameEnded as EventListener);
      window.addEventListener(
        "gesture_event",
        handleGestureEvent as EventListener
      );

      // Cleanup on unmount
      return () => {
        window.removeEventListener(
          "turn_start",
          handleTurnStart as EventListener
        );
        window.removeEventListener("turn_end", handleTurnEnd as EventListener);
        window.removeEventListener(
          "game_ended",
          handleGameEnded as EventListener
        );
        window.removeEventListener(
          "gesture_event",
          handleGestureEvent as EventListener
        );

        if (turnTimer) clearInterval(turnTimer);
      };
    }
  }, [socketConnected, roomId, currentRoom, turnTimer]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (turnTimer) clearInterval(turnTimer);
    };
  }, [turnTimer]);

  // Shield toggle handlers
  const togglePlayer1Shield = () => {
    setPlayer1ShieldActive((prev) => !prev);
  };

  const togglePlayer2Shield = () => {
    setPlayer2ShieldActive((prev) => !prev);
  };

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

  // Determine whose turn it is for display
  const getCurrentTurnDisplay = (): string => {
    if (!currentTurn) {
      // Check if the game state indicates play has started
      if (currentRoom?.status === "playing") {
        return "Game in progress...";
      }
      return "Initializing game...";
    }
    return `${getPlayerNameById(currentTurn)}'s Turn (${turnTimeRemaining}s)`;
  };

  // Game ending display
  const getGameEndedDisplay = (): string => {
    if (!winner) return "Game Ended";
    return `${getPlayerNameById(winner)} Wins!`;
  };

  // Loading states
  if (!socketConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
        <p className="text-white/70">Connecting to server...</p>
      </div>
    );
  }

  if (!currentRoom) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
        <p className="text-white/70">Loading game data...</p>
      </div>
    );
  }

  // Render game UI
  return (
    <div className="min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Game Arena */}
      <div className="relative w-full h-screen flex overflow-hidden">
        {/* Background */}
        <GameBackground />

        {/* Title Animation */}
        <GestureTowerTitle
          isVisible={gameState === "starting" && !textAnimationComplete}
          onAnimationComplete={() => setTextAnimationComplete(true)}
        />

        {/* Rules Scroll - appears after title fades out */}
        <RulesScroll
          isVisible={
            gameState === "starting" &&
            textAnimationComplete &&
            !rulesAnimationComplete
          }
          onAnimationComplete={() => setRulesAnimationComplete(true)}
        />

        {/* Center Divider */}
        <CenterDivider />

        {/* Game state display */}
        {gameState === "playing" && (
          <>
            {/* Turn indicator */}
            <div className="absolute top-4 left-0 right-0 text-center">
              <div className="bg-gray-800/80 text-white px-4 py-2 rounded-md inline-block">
                {gameEnded ? getGameEndedDisplay() : getCurrentTurnDisplay()}
              </div>
            </div>

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

            {/* Display shields if active */}
            <Shield
              playerId="player1"
              isVisible={player1ShieldActive && gameState === "playing"}
            />
            <Shield
              playerId="player2"
              isVisible={player2ShieldActive && gameState === "playing"}
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
