"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRoomStore } from "../../lib/room/store";
import {
  initializeSocket,
  getSocketStatus,
  sendWebSocketMessage,
  signalNextRoundReady,
} from "../../lib/websocket";
import { getSavedRoomInfo } from "../../components/room/RoomHelpers";

// Import game components
import GameBackground from "../../components/game/GameBackground";
import CenterDivider from "../../components/game/CenterDivider";
import GestureTowerTitle from "../../components/game/GestureTowerTitle";
import Player from "../../components/game/Player";
import RoomInfo from "../../components/game/RoomInfo";
import BackButton from "../../components/game/BackButton";
import Shield from "../../components/game/Shield";
import TowerBlocks from "../../components/game/TowerBlocks";
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

  // Initialize WebSocket connection
  useEffect(() => {
    const socket = initializeSocket();
    console.log("WebSocket initializing in game page");

    // Check if socket is already connected
    if (getSocketStatus() === "connected") {
      setSocketConnected(true);
      addEventLog("WebSocket connected", "WebSocket");
    } else {
      // Set up event listener for socket connection
      const handleSocketConnected = () => {
        console.log("WebSocket connected in game page");
        setSocketConnected(true);
        addEventLog("WebSocket connected", "WebSocket");
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

        // Signal to the server that we're ready to start the game
        if (roomId && socketConnected) {
          console.log("Sending game_ready signal to server");
          addEventLog("Sent: game_ready", "WebSocket");

          // Use the existing WebSocket connection through the helper function
          sendWebSocketMessage({
            event: "game_ready",
            payload: { roomId },
          });
        }
      }
    }
  }, [
    gameState,
    textAnimationComplete,
    rulesAnimationComplete,
    roomId,
    socketConnected,
  ]);

  // Update useEffect to handle round transitions and signal readiness
  useEffect(() => {
    // Only process if we have a pending round and are not already transitioning
    if (
      pendingRoundNumber !== null &&
      !isRoundTransitioning &&
      roomId &&
      socketConnected
    ) {
      // Set transitioning state
      setIsRoundTransitioning(true);

      console.log(
        `[page.tsx] Starting transition animation for round ${pendingRoundNumber}`
      );
      addEventLog(
        `Starting transition to round ${pendingRoundNumber}`,
        "Animation"
      );

      // Wait for animations to complete, then signal ready
      setTimeout(() => {
        console.log(
          `[page.tsx] Animation complete, signaling ready for round ${pendingRoundNumber}`
        );
        addEventLog(
          `Animations complete, ready for round ${pendingRoundNumber}`,
          "Animation"
        );

        // Signal to server we're ready for the next round
        signalNextRoundReady(roomId, pendingRoundNumber);

        // Reset states
        setPendingRoundNumber(null);
        setIsRoundTransitioning(false);
      }, 3000); // Animation duration - adjust as needed
    }
  }, [pendingRoundNumber, isRoundTransitioning, roomId, socketConnected]);

  // Add event listeners for tower game events
  useEffect(() => {
    if (socketConnected) {
      // Round start event handler
      const handleRoundStart = (event: CustomEvent) => {
        const data = event.detail;
        if (data.roomId === roomId) {
          // Update round number
          setCurrentRound(data.roundNumber || 1);
          setRoundTimeRemaining(Math.floor(data.remainingTime / 1000) || 30);

          // Log the event with basic info
          addEventLog(
            `Received: round_start (${data.roundNumber})`,
            "GameState"
          );

          // Log card information if available
          if (data.gameState && data.gameState.playerCards) {
            // Count cards by type
            const cardCounts: { [key: string]: number } = {};
            let totalCards = 0;

            Object.entries(data.gameState.playerCards).forEach(
              ([playerId, cards]) => {
                if (Array.isArray(cards)) {
                  totalCards += cards.length;
                  cards.forEach((card: any) => {
                    if (card.type) {
                      cardCounts[card.type] = (cardCounts[card.type] || 0) + 1;
                    }
                  });
                }
              }
            );

            if (totalCards > 0) {
              const cardInfo = Object.entries(cardCounts)
                .map(([type, count]) => `${type}:${count}`)
                .join(", ");
              addEventLog(
                `Cards received: ${totalCards} (${cardInfo})`,
                "GameState"
              );
            }
          }

          // Start countdown timer
          if (roundTimer) clearInterval(roundTimer);
          const timer = setInterval(() => {
            setRoundTimeRemaining((prev) => {
              if (prev <= 1) {
                clearInterval(timer);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);

          setRoundTimer(timer);

          console.log(
            `Round ${data.roundNumber} started, ${
              data.remainingTime / 1000 || 30
            }s remaining`
          );

          // Update tower goal heights from server data if available
          if (data.gameState && data.gameState.goalHeights) {
            // Get player IDs from the room data
            const beagleBoardPlayers =
              currentRoom?.players.filter(
                (p) => p.playerType === "beagleboard"
              ) || [];

            console.log(
              "Received goal heights from server:",
              data.gameState.goalHeights
            );

            if (beagleBoardPlayers.length >= 2) {
              const player1Id = beagleBoardPlayers[0].id;
              const player2Id = beagleBoardPlayers[1].id;

              // Update goal heights from server data
              if (data.gameState.goalHeights[player1Id]) {
                setPlayer1GoalHeight(data.gameState.goalHeights[player1Id]);
                console.log(
                  `Set Player 1 (${player1Name}) goal height to ${data.gameState.goalHeights[player1Id]}`
                );
              }

              if (data.gameState.goalHeights[player2Id]) {
                setPlayer2GoalHeight(data.gameState.goalHeights[player2Id]);
                console.log(
                  `Set Player 2 (${player2Name}) goal height to ${data.gameState.goalHeights[player2Id]}`
                );
              }
            } else if (beagleBoardPlayers.length === 1) {
              // Handle single player mode
              const player1Id = beagleBoardPlayers[0].id;
              const virtualOpponentId = "virtual_opponent";

              if (data.gameState.goalHeights[player1Id]) {
                setPlayer1GoalHeight(data.gameState.goalHeights[player1Id]);
                console.log(
                  `Set Player 1 (${player1Name}) goal height to ${data.gameState.goalHeights[player1Id]}`
                );
              }

              if (data.gameState.goalHeights[virtualOpponentId]) {
                setPlayer2GoalHeight(
                  data.gameState.goalHeights[virtualOpponentId]
                );
                console.log(
                  `Set Virtual Opponent goal height to ${data.gameState.goalHeights[virtualOpponentId]}`
                );
              }
            }
          }
        }
      };

      // Round end event handler
      const handleRoundEnd = (event: CustomEvent) => {
        const data = event.detail;
        if (data.roomId === roomId) {
          console.log(`[page.tsx] Round ${data.roundNumber} ended`);

          // Log the event
          addEventLog(`Received: round_end (${data.roundNumber})`, "GameState");

          // Clear the round timer
          if (roundTimer) {
            clearInterval(roundTimer);
            setRoundTimer(null);
          }

          // Update game state
          if (data.gameState) {
            const gameState = data.gameState;

            // Get player IDs from the room data
            const beagleBoardPlayers =
              currentRoom?.players.filter(
                (p) => p.playerType === "beagleboard"
              ) || [];

            // Update tower heights
            if (gameState.towerHeights) {
              if (beagleBoardPlayers.length >= 2) {
                const player1Id = beagleBoardPlayers[0].id;
                const player2Id = beagleBoardPlayers[1].id;

                setPlayer1TowerHeight(gameState.towerHeights[player1Id] || 0);
                setPlayer2TowerHeight(gameState.towerHeights[player2Id] || 0);
                console.log(
                  `[page.tsx] End of round tower heights - Player 1: ${
                    gameState.towerHeights[player1Id] || 0
                  }, Player 2: ${gameState.towerHeights[player2Id] || 0}`
                );
              } else if (beagleBoardPlayers.length === 1) {
                // Handle single player mode
                const player1Id = beagleBoardPlayers[0].id;
                const virtualOpponentId = "virtual_opponent";

                setPlayer1TowerHeight(gameState.towerHeights[player1Id] || 0);
                setPlayer2TowerHeight(
                  gameState.towerHeights[virtualOpponentId] || 0
                );
                console.log(
                  `[page.tsx] End of round tower heights - Player 1: ${
                    gameState.towerHeights[player1Id] || 0
                  }, Virtual Opponent: ${
                    gameState.towerHeights[virtualOpponentId] || 0
                  }`
                );
              }
            }

            // Update goal heights if provided
            if (gameState.goalHeights) {
              if (beagleBoardPlayers.length >= 2) {
                const player1Id = beagleBoardPlayers[0].id;
                const player2Id = beagleBoardPlayers[1].id;

                if (gameState.goalHeights[player1Id]) {
                  setPlayer1GoalHeight(gameState.goalHeights[player1Id]);
                }

                if (gameState.goalHeights[player2Id]) {
                  setPlayer2GoalHeight(gameState.goalHeights[player2Id]);
                }
              } else if (beagleBoardPlayers.length === 1) {
                const player1Id = beagleBoardPlayers[0].id;
                const virtualOpponentId = "virtual_opponent";

                if (gameState.goalHeights[player1Id]) {
                  setPlayer1GoalHeight(gameState.goalHeights[player1Id]);
                }

                if (gameState.goalHeights[virtualOpponentId]) {
                  setPlayer2GoalHeight(
                    gameState.goalHeights[virtualOpponentId]
                  );
                }
              }
            }
          }

          // Start animation sequence for round end
          setIsAnimating(true);

          // Display round end message
          setRoundEndMessage(`Round ${data.roundNumber} Complete`);

          // After basic animations finish, check if we should transition to next round
          setTimeout(() => {
            setRoundEndMessage("");
            setIsAnimating(false);

            // If the game should continue to the next round
            if (data.shouldContinue) {
              const nextRoundNumber = data.roundNumber + 1;
              console.log(
                `[page.tsx] Preparing transition to round ${nextRoundNumber}`
              );

              // Set the pending round number to trigger the transition effect
              setPendingRoundNumber(nextRoundNumber);
            }
          }, 3000);
        }
      };

      // Game state update handler - for getting the latest game state changes
      const handleGameStateUpdate = (event: CustomEvent) => {
        const data = event.detail;
        if (data.roomId === roomId && data.gameState) {
          // Log the event
          addEventLog(`Received: game_state_update`, "GameState");

          const gameState = data.gameState;

          // Update the round number if available
          if (gameState.roundNumber) {
            setCurrentRound(gameState.roundNumber);
          }

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

            // Log tower height updates
            addEventLog(
              `Tower heights: ${player1Name}=${
                gameState.towerHeights[player1Id] || 0
              }, ${player2Name}=${gameState.towerHeights[player2Id] || 0}`,
              "GameState"
            );
          } else if (
            gameState.towerHeights &&
            beagleBoardPlayers.length === 1
          ) {
            // Handle single player mode
            const player1Id = beagleBoardPlayers[0].id;
            const virtualOpponentId = "virtual_opponent";

            setPlayer1TowerHeight(gameState.towerHeights[player1Id] || 0);
            setPlayer2TowerHeight(
              gameState.towerHeights[virtualOpponentId] || 0
            );

            // Log tower height updates for single player
            addEventLog(
              `Tower heights: ${player1Name}=${
                gameState.towerHeights[player1Id] || 0
              }, AI=${gameState.towerHeights[virtualOpponentId] || 0}`,
              "GameState"
            );
          }

          // Update goal heights if they are included
          if (gameState.goalHeights) {
            if (beagleBoardPlayers.length >= 2) {
              const player1Id = beagleBoardPlayers[0].id;
              const player2Id = beagleBoardPlayers[1].id;

              if (gameState.goalHeights[player1Id]) {
                setPlayer1GoalHeight(gameState.goalHeights[player1Id]);
                console.log(
                  `Updated Player 1 goal height to ${gameState.goalHeights[player1Id]}`
                );
              }

              if (gameState.goalHeights[player2Id]) {
                setPlayer2GoalHeight(gameState.goalHeights[player2Id]);
                console.log(
                  `Updated Player 2 goal height to ${gameState.goalHeights[player2Id]}`
                );
              }
            } else if (beagleBoardPlayers.length === 1) {
              const player1Id = beagleBoardPlayers[0].id;
              const virtualOpponentId = "virtual_opponent";

              if (gameState.goalHeights[player1Id]) {
                setPlayer1GoalHeight(gameState.goalHeights[player1Id]);
              }

              if (gameState.goalHeights[virtualOpponentId]) {
                setPlayer2GoalHeight(gameState.goalHeights[virtualOpponentId]);
              }
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

          // Log the event
          addEventLog(`Received: game_ended`, "GameState");

          // Clear any existing timer
          if (roundTimer) clearInterval(roundTimer);

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
        // Update UI based on the gesture and log the event
        addEventLog(
          `Received: gesture_event (${data.gesture})`,
          "GestureDetector"
        );

        // Add to animations queue to track pending animations
        setMoveAnimations((prev) => [
          ...prev,
          {
            playerId: data.playerId,
            gesture: data.gesture,
          },
        ]);

        // Log additional details about the gesture
        if (data.confidence) {
          addEventLog(
            `Gesture confidence: ${(data.confidence * 100).toFixed(1)}%`,
            "GestureDetector"
          );
        }

        if (data.cardId) {
          addEventLog(`Card ID: ${data.cardId}`, "GestureDetector");
        }

        console.log(
          "[page.tsx] Gesture received:",
          data.gesture,
          "from player:",
          data.playerId,
          "with confidence:",
          data.confidence
        );

        // Get player names from the room data
        const beagleBoardPlayers =
          currentRoom?.players.filter((p) => p.playerType === "beagleboard") ||
          [];

        // Show card played message
        if (beagleBoardPlayers.length >= 2) {
          const player1Id = beagleBoardPlayers[0].id;
          const player2Id = beagleBoardPlayers[1].id;

          const playerName =
            data.playerId === player1Id
              ? player1Name
              : data.playerId === player2Id
              ? player2Name
              : "Unknown player";

          const message = `${playerName} played ${data.gesture}${
            data.cardId ? " card" : ""
          }!`;

          console.log(`[page.tsx] GESTURE UI UPDATE: ${message}`);

          if (data.playerId === player1Id) {
            setPlayer1CardPlayed(message);

            // Update game state based on gesture
            if (data.gesture === "attack") {
              // Show attack visual
              console.log("[page.tsx] Player 1 performed attack");
            } else if (data.gesture === "defend") {
              // Activate shield
              setPlayer1ShieldActive(true);
              console.log("[page.tsx] Player 1 activated shield");
            } else if (data.gesture === "build") {
              // Add block
              addPlayer1Block();
              console.log("[page.tsx] Player 1 added block");
            }
          } else if (data.playerId === player2Id) {
            setPlayer2CardPlayed(message);

            // Update game state based on gesture
            if (data.gesture === "attack") {
              // Show attack visual
              console.log("[page.tsx] Player 2 performed attack");
            } else if (data.gesture === "defend") {
              // Activate shield
              setPlayer2ShieldActive(true);
              console.log("[page.tsx] Player 2 activated shield");
            } else if (data.gesture === "build") {
              // Add block
              addPlayer2Block();
              console.log("[page.tsx] Player 2 added block");
            }
          }

          // Clear any existing timer
          if (cardPlayedTimer) clearTimeout(cardPlayedTimer);

          // Set timer to clear the message after 5 seconds
          const timer = setTimeout(() => {
            setPlayer1CardPlayed("");
            setPlayer2CardPlayed("");

            // Reset shield visuals after time expires
            if (data.gesture === "defend") {
              if (data.playerId === player1Id) {
                setPlayer1ShieldActive(false);
              } else if (data.playerId === player2Id) {
                setPlayer2ShieldActive(false);
              }
            }

            // Remove this animation from the queue
            setMoveAnimations((prev) =>
              prev.filter(
                (anim) =>
                  !(
                    anim.playerId === data.playerId &&
                    anim.gesture === data.gesture
                  )
              )
            );
          }, 5000);

          setCardPlayedTimer(timer);

          // Play an appropriate sound for the gesture
          try {
            const audio = new Audio(`/sounds/${data.gesture}.mp3`);
            audio
              .play()
              .catch((e) =>
                console.error("[page.tsx] Error playing sound:", e)
              );
          } catch (e) {
            console.warn("[page.tsx] Could not play gesture sound", e);
          }
        }
      };

      // Add an event handler for game_starting
      const handleGameStarting = (event: CustomEvent) => {
        addEventLog(`Received: game_starting`, "GameState");
      };

      // Add event listeners
      window.addEventListener("round_start", handleRoundStart as EventListener);
      window.addEventListener("round_end", handleRoundEnd as EventListener);
      window.addEventListener("game_ended", handleGameEnded as EventListener);
      window.addEventListener(
        "gesture_event",
        handleGestureEvent as EventListener
      );
      window.addEventListener(
        "game_state_update",
        handleGameStateUpdate as EventListener
      );
      window.addEventListener(
        "game_starting",
        handleGameStarting as EventListener
      );

      // Cleanup on unmount
      return () => {
        window.removeEventListener(
          "round_start",
          handleRoundStart as EventListener
        );
        window.removeEventListener(
          "round_end",
          handleRoundEnd as EventListener
        );
        window.removeEventListener(
          "game_ended",
          handleGameEnded as EventListener
        );
        window.removeEventListener(
          "gesture_event",
          handleGestureEvent as EventListener
        );
        window.removeEventListener(
          "game_state_update",
          handleGameStateUpdate as EventListener
        );
        window.removeEventListener(
          "game_starting",
          handleGameStarting as EventListener
        );

        if (roundTimer) clearInterval(roundTimer);
      };
    }
  }, [
    socketConnected,
    roomId,
    currentRoom,
    roundTimer,
    player1Name,
    player2Name,
  ]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (roundTimer) clearInterval(roundTimer);
    };
  }, [roundTimer]);

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

  // Determine the round display for the UI
  const getRoundDisplay = (): string => {
    if (currentRoom?.status !== "playing") {
      return "Initializing game...";
    }

    return `Round ${currentRound} (${roundTimeRemaining}s)`;
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
            {/* Turn indicator - now shows round instead */}
            <div className="absolute top-4 left-0 right-0 text-center">
              <div className="bg-gray-800/80 text-white px-4 py-2 rounded-md inline-block">
                {gameEnded ? getGameEndedDisplay() : getRoundDisplay()}
              </div>
            </div>

            {/* Event Log Display */}
            <div className="absolute top-16 left-0 right-0 text-center">
              <div className="bg-gray-900/70 text-white px-4 py-2 rounded-md inline-block max-w-[600px] w-full mx-auto">
                <div className="text-sm font-mono text-left max-h-[180px] overflow-y-auto">
                  <div className="text-xs text-gray-400 mb-1 border-b border-gray-700 pb-1 flex justify-between items-center">
                    <span>Debug Logs</span>
                    <button
                      onClick={clearEventLogs}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      Clear
                    </button>
                  </div>
                  {eventLogs.map((log, index) => {
                    // Extract source from log if possible
                    const sourceMatch = log.match(/\[(.*?)\]/);
                    const source = sourceMatch ? sourceMatch[1] : "UI";

                    // Determine color based on source
                    let textColor = "text-white";
                    if (source === "GameState") textColor = "text-green-400";
                    if (source === "GestureDetector")
                      textColor = "text-blue-400";
                    if (source === "WebSocket") textColor = "text-purple-400";

                    return (
                      <div
                        key={index}
                        className={`whitespace-nowrap ${textColor} text-xs`}
                      >
                        {log}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Round end message - shown temporarily when a round ends */}
            {roundEndMessage && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/70 text-white px-6 py-4 rounded-lg text-xl font-bold animate-pulse z-50">
                {roundEndMessage}
              </div>
            )}

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

            {/* Card played messages */}
            {player1CardPlayed && (
              <div className="absolute bottom-20 left-[25%] transform -translate-x-1/2 bg-blue-600/80 text-white px-3 py-1 rounded-md z-20">
                {player1CardPlayed}
              </div>
            )}
            {player2CardPlayed && (
              <div className="absolute bottom-20 right-[25%] transform translate-x-1/2 bg-red-600/80 text-white px-3 py-1 rounded-md z-20">
                {player2CardPlayed}
              </div>
            )}

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
