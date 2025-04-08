import { useEffect } from "react";
import { signalNextRoundReady } from "../../lib/websocket";

interface RoundTransitionHandlerProps {
  pendingRoundNumber: number | null;
  isRoundTransitioning: boolean;
  roomId: string;
  socketConnected: boolean;
  setIsRoundTransitioning: (transitioning: boolean) => void;
  setPendingRoundNumber: (round: number | null) => void;
  addEventLog: (message: string, source: string) => void;
}

const RoundTransitionHandler: React.FC<RoundTransitionHandlerProps> = ({
  pendingRoundNumber,
  isRoundTransitioning,
  roomId,
  socketConnected,
  setIsRoundTransitioning,
  setPendingRoundNumber,
  addEventLog,
}) => {
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
        `[RoundTransitionHandler] Starting transition animation for round ${pendingRoundNumber}`
      );
      addEventLog(
        `Starting transition to round ${pendingRoundNumber}`,
        "Animation"
      );

      // Wait for animations to complete, then signal ready
      setTimeout(() => {
        console.log(
          `[RoundTransitionHandler] Animation complete, signaling ready for round ${pendingRoundNumber}`
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
  }, [
    pendingRoundNumber,
    isRoundTransitioning,
    roomId,
    socketConnected,
    setIsRoundTransitioning,
    setPendingRoundNumber,
    addEventLog,
  ]);

  // This is a "silent" component - it doesn't render anything
  return null;
};

export default RoundTransitionHandler;
