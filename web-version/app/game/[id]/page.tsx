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
type GameStateType = "waiting" | "counting" | "starting" | "playing";

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;
  const { currentRoom, error, gameStarting, gameStartTimestamp } =
    useRoomStore();
  const [socketConnected, setSocketConnected] = useState(false);
  const [allPlayersReady, setAllPlayersReady] = useState(false);
  const [gameState, setGameState] = useState<GameStateType>("waiting");
  const [countdown, setCountdown] = useState(5);

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

  // Check if all players are ready and room status is "playing"
  useEffect(() => {
    if (currentRoom) {
      // Check if all players are ready
      const playersReady = currentRoom.players.every(
        (player) => player.isReady
      );
      const enoughPlayers = currentRoom.players.length >= 1; // Changed for testing with 1 player

      if (playersReady && enoughPlayers) {
        setAllPlayersReady(true);

        // If room status is "playing", transition to gameplay
        if (currentRoom.status === "playing") {
          console.log("Game is starting, transitioning to gameplay");
          setGameState("playing");
        }
      }

      // Extract player names
      if (currentRoom.players.length > 0) {
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
    }
  }, [currentRoom]);

  // Listen for game_starting event
  useEffect(() => {
    const handleGameStarting = (event: CustomEvent) => {
      console.log("Game starting event received, showing countdown");
      setGameState("counting");
    };

    window.addEventListener(
      "game_starting",
      handleGameStarting as EventListener
    );
    return () =>
      window.removeEventListener(
        "game_starting",
        handleGameStarting as EventListener
      );
  }, []);

  // Handle gameStarting state from store
  useEffect(() => {
    if (gameStarting && gameState === "waiting") {
      console.log("Game starting detected from store, showing countdown");
      setGameState("counting");
    }
  }, [gameStarting, gameState]);

  // Countdown timer
  useEffect(() => {
    if (gameState === "counting" && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown((c) => c - 1);
      }, 1000);

      return () => clearTimeout(timer);
    } else if (gameState === "counting" && countdown === 0) {
      console.log("Countdown complete, transitioning to game animation");
      setGameState("starting");
    }
  }, [gameState, countdown]);

  // Sequential animation steps for gameplay
  useEffect(() => {
    if (gameState === "starting") {
      if (
        textAnimationComplete &&
        !rulesAnimationComplete &&
        !animationComplete
      ) {
        // Text animation is complete, rules scroll is showing
        // The scroll itself will trigger rulesAnimationComplete after 10 seconds
      } else if (
        textAnimationComplete &&
        rulesAnimationComplete &&
        !animationComplete
      ) {
        // Rules animation is complete, now show players
        setAnimationComplete(true);
      }
    }
  }, [
    gameState,
    textAnimationComplete,
    rulesAnimationComplete,
    animationComplete,
  ]);

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

  // Render waiting room UI
  if (gameState === "waiting") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <motion.div
          className="bg-black/30 backdrop-blur-sm rounded-lg p-8 w-full max-w-4xl border border-white/10 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="game-title text-5xl font-bold mb-6">
            {currentRoom.name}
          </h1>
          <p className="text-xl mb-2">
            Room ID: <span className="text-accent">{currentRoom.id}</span>
          </p>
          <p className="text-lg mb-8">
            Status: <span className="text-accent">{currentRoom.status}</span>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {currentRoom.players.map((player) => (
              <div
                key={player.id}
                className={`p-4 rounded-lg border ${
                  player.isReady
                    ? "bg-green-900/30 border-green-500/50"
                    : "bg-black/20 border-white/10"
                }`}
              >
                <h3 className="text-xl font-bold mb-2">
                  {player.name}
                  {player.id === currentRoom.hostId && (
                    <span className="ml-2 text-xs bg-accent px-2 py-1 rounded-full">
                      Host
                    </span>
                  )}
                </h3>
                <p
                  className={`${
                    player.isReady ? "text-green-400" : "text-white/70"
                  }`}
                >
                  {player.isReady ? "Ready" : "Not Ready"}
                </p>
                <p className="text-xs text-white/50 mt-1">
                  {player.playerType === "beagleboard"
                    ? "BeagleBoard Player"
                    : "Web Player"}
                </p>
              </div>
            ))}
          </div>

          {allPlayersReady ? (
            <div className="text-accent text-lg animate-pulse mb-4">
              All players are ready! Waiting for game to start...
            </div>
          ) : (
            <div className="text-white/70 text-sm mb-4">
              <p>Waiting for all players to be ready...</p>
            </div>
          )}

          <button
            onClick={() => router.push("/")}
            className="mt-4 bg-primary hover:bg-primary-dark text-white font-bold py-2 px-6 rounded-lg"
          >
            Back to Home
          </button>

          {error && (
            <div className="bg-danger/20 text-danger p-3 rounded-md mt-4">
              {error}
            </div>
          )}
        </motion.div>

        {/* Battle divider - more intimidating */}
        <div className="absolute h-full left-1/2 transform -translate-x-1/2 z-20">
          {/* Main divider line */}
          <div className="absolute h-full w-3 bg-gradient-to-r from-red-700/70 via-red-500/80 to-red-700/70 shadow-[0_0_15px_rgba(220,38,38,0.7)]"></div>

          {/* Lightning/electricity effects */}
          <motion.div
            className="absolute h-full w-1 bg-yellow-400/90 shadow-[0_0_10px_rgba(250,204,21,0.9)]"
            animate={{
              opacity: [0.2, 1, 0.5, 0.8, 0.3],
              scaleX: [0.5, 1.5, 0.8, 1.2, 0.7],
              x: [-1, 1, -2, 0, 2],
            }}
            transition={{
              repeat: Infinity,
              duration: 1.8,
              ease: "easeInOut",
            }}
          ></motion.div>

          {/* Battle zone markers */}
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-5 h-5 rounded-full left-1/2 transform -translate-x-1/2"
              style={{
                top: `${12 + i * 10}%`,
                background:
                  i % 2 === 0 ? "rgba(239, 68, 68, 0.7)" : "rgba(0, 0, 0, 0.5)",
                boxShadow:
                  i % 2 === 0 ? "0 0 10px rgba(239, 68, 68, 0.9)" : "none",
              }}
              animate={{
                scale: [1, 1.2, 1],
              }}
              transition={{
                repeat: Infinity,
                duration: 2,
                delay: i * 0.3,
                ease: "easeInOut",
              }}
            ></motion.div>
          ))}
        </div>
      </div>
    );
  }

  // Render countdown UI
  if (gameState === "counting") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <motion.div
          className="bg-black/50 backdrop-blur-md rounded-xl p-12 border-2 border-primary/50 text-center shadow-lg shadow-primary/20"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="game-title text-6xl font-bold mb-8 text-white">
            Game Starting
          </h1>
          <motion.div
            className="text-8xl font-bold text-primary mb-6"
            key={countdown}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            {countdown}
          </motion.div>
          <p className="text-xl text-white/80">Get ready to play!</p>
        </motion.div>
      </div>
    );
  }

  // Render gameplay UI
  if (gameState === "starting" || gameState === "playing") {
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

          {/* Back Button - returns to room view */}
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

  // Default fallback
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
      <p className="text-white/70">Loading game...</p>
    </div>
  );
}
