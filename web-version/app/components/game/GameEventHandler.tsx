import { useEffect } from "react";
import { signalNextRoundReady } from "../../lib/websocket";

interface GameEventHandlerProps {
  roomId: string;
  socketConnected: boolean;
  currentRoom: any;
  addEventLog: (message: string, source: string) => void;
  setCurrentRound: (round: number) => void;
  setRoundTimeRemaining: (time: number) => void;
  setRoundTimer: (timer: NodeJS.Timeout | null) => void;
  roundTimer: NodeJS.Timeout | null;
  setPlayer1TowerHeight: (height: number) => void;
  setPlayer2TowerHeight: (height: number) => void;
  setPlayer1GoalHeight: (height: number) => void;
  setPlayer2GoalHeight: (height: number) => void;
  setRoundEndMessage: (message: string) => void;
  setGameEnded: (ended: boolean) => void;
  setWinner: (winnerId: string) => void;
  setPlayer1CardPlayed: (message: string) => void;
  setPlayer2CardPlayed: (message: string) => void;
  setCardPlayedTimer: (timer: NodeJS.Timeout | null) => void;
  cardPlayedTimer: NodeJS.Timeout | null;
  setPlayer1ShieldActive: (active: boolean) => void;
  setPlayer2ShieldActive: (active: boolean) => void;
  addPlayer1Block: () => void;
  addPlayer2Block: () => void;
  player1Name: string;
  player2Name: string;
  setIsAnimating: (animating: boolean) => void;
  setMoveAnimations: (
    callback: (
      prev: Array<{ playerId: string; gesture: string }>
    ) => Array<{ playerId: string; gesture: string }>
  ) => void;
  setPendingRoundNumber: (round: number | null) => void;
}

const GameEventHandler: React.FC<GameEventHandlerProps> = ({
  roomId,
  socketConnected,
  currentRoom,
  addEventLog,
  setCurrentRound,
  setRoundTimeRemaining,
  setRoundTimer,
  roundTimer,
  setPlayer1TowerHeight,
  setPlayer2TowerHeight,
  setPlayer1GoalHeight,
  setPlayer2GoalHeight,
  setRoundEndMessage,
  setGameEnded,
  setWinner,
  setPlayer1CardPlayed,
  setPlayer2CardPlayed,
  setCardPlayedTimer,
  cardPlayedTimer,
  setPlayer1ShieldActive,
  setPlayer2ShieldActive,
  addPlayer1Block,
  addPlayer2Block,
  player1Name,
  player2Name,
  setIsAnimating,
  setMoveAnimations,
  setPendingRoundNumber,
}) => {
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

          // Set initial time remaining
          const initialTime = Math.floor(data.remainingTime / 1000) || 30;
          setRoundTimeRemaining(initialTime);

          // Use closure to track the time
          let timeLeft = initialTime;

          const timer = setInterval(() => {
            timeLeft -= 1;

            if (timeLeft <= 0) {
              clearInterval(timer);
              setRoundTimeRemaining(0);
            } else {
              setRoundTimeRemaining(timeLeft);
            }
          }, 1000);

          setRoundTimer(timer);

          console.log(
            `[GameEventHandler] Round ${data.roundNumber} started, ${
              data.remainingTime / 1000 || 30
            }s remaining`
          );

          // Update tower goal heights from server data if available
          if (data.gameState && data.gameState.goalHeights) {
            // Get player IDs from the room data
            const beagleBoardPlayers =
              currentRoom?.players.filter(
                (p: any) => p.playerType === "beagleboard"
              ) || [];

            console.log(
              "[GameEventHandler] Received goal heights from server:",
              data.gameState.goalHeights
            );

            if (beagleBoardPlayers.length >= 2) {
              const player1Id = beagleBoardPlayers[0].id;
              const player2Id = beagleBoardPlayers[1].id;

              // Update goal heights from server data
              if (data.gameState.goalHeights[player1Id]) {
                setPlayer1GoalHeight(data.gameState.goalHeights[player1Id]);
                console.log(
                  `[GameEventHandler] Set Player 1 (${player1Name}) goal height to ${data.gameState.goalHeights[player1Id]}`
                );
              }

              if (data.gameState.goalHeights[player2Id]) {
                setPlayer2GoalHeight(data.gameState.goalHeights[player2Id]);
                console.log(
                  `[GameEventHandler] Set Player 2 (${player2Name}) goal height to ${data.gameState.goalHeights[player2Id]}`
                );
              }
            } else if (beagleBoardPlayers.length === 1) {
              // Handle single player mode
              const player1Id = beagleBoardPlayers[0].id;
              const virtualOpponentId = "virtual_opponent";

              if (data.gameState.goalHeights[player1Id]) {
                setPlayer1GoalHeight(data.gameState.goalHeights[player1Id]);
                console.log(
                  `[GameEventHandler] Set Player 1 (${player1Name}) goal height to ${data.gameState.goalHeights[player1Id]}`
                );
              }

              if (data.gameState.goalHeights[virtualOpponentId]) {
                setPlayer2GoalHeight(
                  data.gameState.goalHeights[virtualOpponentId]
                );
                console.log(
                  `[GameEventHandler] Set Virtual Opponent goal height to ${data.gameState.goalHeights[virtualOpponentId]}`
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
          console.log(`[GameEventHandler] Round ${data.roundNumber} ended`);

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
                (p: any) => p.playerType === "beagleboard"
              ) || [];

            // Update tower heights
            if (gameState.towerHeights) {
              if (beagleBoardPlayers.length >= 2) {
                const player1Id = beagleBoardPlayers[0].id;
                const player2Id = beagleBoardPlayers[1].id;

                setPlayer1TowerHeight(gameState.towerHeights[player1Id] || 0);
                setPlayer2TowerHeight(gameState.towerHeights[player2Id] || 0);
                console.log(
                  `[GameEventHandler] End of round tower heights - Player 1: ${
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
                  `[GameEventHandler] End of round tower heights - Player 1: ${
                    gameState.towerHeights[player1Id] || 0
                  }, Virtual Opponent: ${
                    gameState.towerHeights[virtualOpponentId] || 0
                  }`
                );
              }
            }

            // Update goal heights if provided
            if (gameState.goalHeights) {
              // (Goal height update code omitted for brevity)
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
                `[GameEventHandler] Preparing transition to round ${nextRoundNumber}`
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
              (p: any) => p.playerType === "beagleboard"
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
            // (Goal height update code omitted for brevity)
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
                (p: any) => p.playerType === "beagleboard"
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
          "[GameEventHandler] Gesture received:",
          data.gesture,
          "from player:",
          data.playerId,
          "with confidence:",
          data.confidence
        );

        // Get player names from the room data
        const beagleBoardPlayers =
          currentRoom?.players.filter(
            (p: any) => p.playerType === "beagleboard"
          ) || [];

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

          console.log(`[GameEventHandler] GESTURE UI UPDATE: ${message}`);

          if (data.playerId === player1Id) {
            setPlayer1CardPlayed(message);

            // Update game state based on gesture
            if (data.gesture === "attack") {
              // Show attack visual
              console.log("[GameEventHandler] Player 1 performed attack");
            } else if (data.gesture === "defend") {
              // Activate shield
              setPlayer1ShieldActive(true);
              console.log("[GameEventHandler] Player 1 activated shield");
            } else if (data.gesture === "build") {
              // Add block
              addPlayer1Block();
              console.log("[GameEventHandler] Player 1 added block");
            }
          } else if (data.playerId === player2Id) {
            setPlayer2CardPlayed(message);

            // Update game state based on gesture
            if (data.gesture === "attack") {
              // Show attack visual
              console.log("[GameEventHandler] Player 2 performed attack");
            } else if (data.gesture === "defend") {
              // Activate shield
              setPlayer2ShieldActive(true);
              console.log("[GameEventHandler] Player 2 activated shield");
            } else if (data.gesture === "build") {
              // Add block
              addPlayer2Block();
              console.log("[GameEventHandler] Player 2 added block");
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
                console.error("[GameEventHandler] Error playing sound:", e)
              );
          } catch (e) {
            console.warn("[GameEventHandler] Could not play gesture sound", e);
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
    addEventLog,
    setCurrentRound,
    setRoundTimeRemaining,
    setRoundTimer,
    setPlayer1TowerHeight,
    setPlayer2TowerHeight,
    setPlayer1GoalHeight,
    setPlayer2GoalHeight,
    setRoundEndMessage,
    setGameEnded,
    setWinner,
    setPlayer1CardPlayed,
    setPlayer2CardPlayed,
    setCardPlayedTimer,
    cardPlayedTimer,
    setPlayer1ShieldActive,
    setPlayer2ShieldActive,
    addPlayer1Block,
    addPlayer2Block,
    setIsAnimating,
    setMoveAnimations,
    setPendingRoundNumber,
  ]);

  // This is a "silent" component - it doesn't render anything
  return null;
};

export default GameEventHandler;
