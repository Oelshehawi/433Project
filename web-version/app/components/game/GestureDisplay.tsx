import React from "react";
import Image from "next/image";

interface GestureDisplayProps {
  playerGesture: string | null;
  opponentGesture: string | null;
  outcome: "win" | "lose" | "draw" | null;
  isAnimationComplete: boolean;
  showGesture: boolean;
}

const GestureDisplay: React.FC<GestureDisplayProps> = ({
  playerGesture,
  opponentGesture,
  outcome,
  isAnimationComplete,
  showGesture,
}) => {
  // Only render if animation is complete and gestures should be shown
  if (!isAnimationComplete || !showGesture) {
    return null;
  }

  const getGestureImage = (gesture: string | null) => {
    if (!gesture) return "/images/gestures/unknown.png";

    switch (gesture.toLowerCase()) {
      case "rock":
        return "/images/gestures/rock.png";
      case "paper":
        return "/images/gestures/paper.png";
      case "scissors":
        return "/images/gestures/scissors.png";
      default:
        return "/images/gestures/unknown.png";
    }
  };

  const getOutcomeMessage = () => {
    if (!outcome) return "";

    switch (outcome) {
      case "win":
        return "You win this round!";
      case "lose":
        return "You lose this round!";
      case "draw":
        return "It's a draw!";
      default:
        return "";
    }
  };

  return (
    <div className="gesture-display">
      <div className="gestures">
        <div className="gesture player-gesture">
          <Image
            src={getGestureImage(playerGesture)}
            alt={playerGesture || "Unknown gesture"}
            width={80}
            height={80}
          />
          <p>Your choice</p>
        </div>

        <div className="gesture-result">
          <p className={`outcome ${outcome}`}>{getOutcomeMessage()}</p>
        </div>

        <div className="gesture opponent-gesture">
          <Image
            src={getGestureImage(opponentGesture)}
            alt={opponentGesture || "Unknown gesture"}
            width={80}
            height={80}
          />
          <p>Opponent's choice</p>
        </div>
      </div>
    </div>
  );
};

export default GestureDisplay;
