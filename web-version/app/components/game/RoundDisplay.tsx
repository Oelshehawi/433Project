import React from "react";

interface RoundDisplayProps {
  gameEnded: boolean;
  currentRound: number;
  roundTimeRemaining: number;
  winnerName: string;
  roundEndMessage: string;
}

const RoundDisplay: React.FC<RoundDisplayProps> = ({
  gameEnded,
  currentRound,
  roundTimeRemaining,
  winnerName,
  roundEndMessage,
}) => {
  // Determine what to display based on game state
  const getDisplay = () => {
    if (gameEnded) {
      return winnerName ? `${winnerName} Wins!` : "Game Ended";
    }
    return `Round ${currentRound} (${roundTimeRemaining}s)`;
  };

  return (
    <>
      {/* Main round indicator */}
      <div className="absolute top-4 left-0 right-0 text-center">
        <div className="bg-gray-800/80 text-white px-4 py-2 rounded-md inline-block">
          {getDisplay()}
        </div>
      </div>

      {/* Round end message - shown temporarily when a round ends */}
      {roundEndMessage && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/70 text-white px-6 py-4 rounded-lg text-xl font-bold animate-pulse z-50">
          {roundEndMessage}
        </div>
      )}
    </>
  );
};

export default RoundDisplay;
