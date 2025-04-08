import React from "react";

interface RoundInfoProps {
  currentRound: number;
  totalRounds: number;
  isAnimationComplete: boolean;
}

const RoundInfo: React.FC<RoundInfoProps> = ({
  currentRound,
  totalRounds,
  isAnimationComplete,
}) => {
  // Only render if animation is complete
  if (!isAnimationComplete) {
    return null;
  }

  return (
    <div className="round-info">
      <h3>
        Round {currentRound} of {totalRounds}
      </h3>
      <div className="round-progress">
        <div
          className="progress-bar"
          style={{
            width: `${(currentRound / totalRounds) * 100}%`,
          }}
        ></div>
      </div>
    </div>
  );
};

export default RoundInfo;
