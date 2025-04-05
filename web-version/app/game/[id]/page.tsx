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

        {/* Shield Control Buttons */}
        <ShieldButtons
          isVisible={
            gameState === "playing" ||
            (gameState === "starting" && animationComplete)
          }
          onPlayer1Shield={togglePlayer1Shield}
          onPlayer2Shield={togglePlayer2Shield}
          isPlayer1ShieldActive={player1ShieldActive}
          isPlayer2ShieldActive={player2ShieldActive}
        />

        {/* Tower Control Buttons */}
        <TowerControls
          isVisible={
            gameState === "playing" ||
            (gameState === "starting" && animationComplete)
          }
          playerSide="left"
          onAdd={addPlayer1Block}
          onRemove={removePlayer1Block}
          blockCount={player1BlockCount}
        />

        <TowerControls
          isVisible={
            gameState === "playing" ||
            (gameState === "starting" && animationComplete)
          }
          playerSide="right"
          onAdd={addPlayer2Block}
          onRemove={removePlayer2Block}
          blockCount={player2BlockCount}
        />

        {/* Player 1 Side with Shield */}
        <div className="relative w-1/2 h-full flex items-end justify-center">
          <Player
            playerNumber={1}
            isVisible={
              gameState === "playing" ||
              (gameState === "starting" && animationComplete)
            }
            blockCount={player1BlockCount}
            playerName={player1Name}
          />
          <TowerBlocks count={player1BlockCount} playerSide="left" />
        </div>
        <Shield
          isActive={player1ShieldActive}
          playerSide="left"
          blockCount={player1BlockCount}
        />

        {/* Player 2 Side with Shield */}
        <div className="relative w-1/2 h-full flex items-end justify-center">
          <Player
            playerNumber={2}
            isVisible={
              gameState === "playing" ||
              (gameState === "starting" && animationComplete)
            }
            blockCount={player2BlockCount}
            playerName={player2Name}
          />
          <TowerBlocks count={player2BlockCount} playerSide="right" />
        </div>
        <Shield
          isActive={player2ShieldActive}
          playerSide="right"
          blockCount={player2BlockCount}
        />

        {/* Room Info - using real room ID from params */}
        <RoomInfo
          roomId={roomId}
          isVisible={
            gameState === "playing" ||
            (gameState === "starting" && animationComplete)
          }
        />

        {/* Back Button - returns to home */}
        <BackButton
          isVisible={
            gameState === "playing" ||
            (gameState === "starting" && animationComplete)
          }
          returnToRoom={false}
        />

        {/* Error display */}
        {error && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-danger/50 text-white p-3 rounded-md z-50">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
