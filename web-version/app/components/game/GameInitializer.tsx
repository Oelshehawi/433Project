import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  initializeSocket,
  getSocketStatus,
  sendWebSocketMessage,
} from "../../lib/websocket";
import { getSavedRoomInfo } from "../../components/room/RoomHelpers";

interface GameInitializerProps {
  roomId: string;
  setSocketConnected: (connected: boolean) => void;
  gameState: "starting" | "playing";
  textAnimationComplete: boolean;
  rulesAnimationComplete: boolean;
  animationComplete: boolean;
  setAnimationComplete: (complete: boolean) => void;
  setGameState: (state: "starting" | "playing") => void;
  addEventLog: (message: string, source: string) => void;
}

const GameInitializer: React.FC<GameInitializerProps> = ({
  roomId,
  setSocketConnected,
  gameState,
  textAnimationComplete,
  rulesAnimationComplete,
  animationComplete,
  setAnimationComplete,
  setGameState,
  addEventLog,
}) => {
  const router = useRouter();

  // Initialize WebSocket connection
  useEffect(() => {
    const socket = initializeSocket();
    console.log("[GameInitializer] WebSocket initializing in game page");

    // Check if socket is already connected
    if (getSocketStatus() === "connected") {
      setSocketConnected(true);
      addEventLog("WebSocket connected", "WebSocket");
    } else {
      // Set up event listener for socket connection
      const handleSocketConnected = () => {
        console.log("[GameInitializer] WebSocket connected in game page");
        setSocketConnected(true);
        addEventLog("WebSocket connected", "WebSocket");
      };

      window.addEventListener("ws_connected", handleSocketConnected);

      return () => {
        window.removeEventListener("ws_connected", handleSocketConnected);
      };
    }
  }, [setSocketConnected, addEventLog]);

  // Verify we have proper room data
  useEffect(() => {
    // This effect should run when socketConnected changes, but we can't
    // access that prop directly, so we rely on getSocketStatus() instead
    if (getSocketStatus() === "connected") {
      const savedInfo = getSavedRoomInfo();

      if (!savedInfo.roomId || savedInfo.roomId !== roomId) {
        // No valid saved info, redirect to home
        console.log(
          "[GameInitializer] No valid room info found, redirecting to home"
        );
        router.push("/");
        return;
      }
    }
  }, [roomId, router]);

  // Handle sequential animation steps for gameplay
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
        if (roomId && getSocketStatus() === "connected") {
          console.log("[GameInitializer] Sending game_ready signal to server");
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
    setAnimationComplete,
    setGameState,
    addEventLog,
  ]);

  // This is a "silent" component - it doesn't render anything
  return null;
};

export default GameInitializer;
