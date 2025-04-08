import React from "react";
import Image from "next/image";

interface PlayerDisplayProps {
  playerName: string;
  playerGesture: string | null;
  isCurrentTurn: boolean;
  isAnimationComplete: boolean;
  position: "left" | "right";
  showGesture: boolean;
}

const PlayerDisplay: React.FC<PlayerDisplayProps> = ({
  playerName,
  playerGesture,
  isCurrentTurn,
  isAnimationComplete,
  position,
  showGesture,
}) => {
  // Only render if animation is complete
  if (!isAnimationComplete) {
    return null;
  }

  // Determine gesture image path
  const getGestureImage = (gesture: string | null) => {
    if (!gesture) return "";

    switch (gesture.toLowerCase()) {
      case "rock":
        return "/images/rock.png";
      case "paper":
        return "/images/paper.png";
      case "scissors":
        return "/images/scissors.png";
      default:
        return "";
    }
  };

  const gestureImage = getGestureImage(playerGesture);

  return (
    <div className={`player-container ${position}-player`}>
      <div className={`player-info ${isCurrentTurn ? "current-turn" : ""}`}>
        <h3>{playerName}</h3>
        {isCurrentTurn && <div className="turn-indicator">Current Turn</div>}
      </div>

      {showGesture && gestureImage && (
        <div className="gesture-display">
          <Image
            src={gestureImage}
            alt={playerGesture || "gesture"}
            width={80}
            height={80}
            className={`gesture-image ${position}-gesture`}
          />
        </div>
      )}
    </div>
  );
};

export default PlayerDisplay;
