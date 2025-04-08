import React from "react";

interface GameEndDisplayProps {
  isGameOver: boolean;
  winner: string | null;
  playerScore: number;
  opponentScore: number;
  onPlayAgain: () => void;
  onBackToHome: () => void;
}

const GameEndDisplay: React.FC<GameEndDisplayProps> = ({
  isGameOver,
  winner,
  playerScore,
  opponentScore,
  onPlayAgain,
  onBackToHome,
}) => {
  if (!isGameOver) {
    return null;
  }

  const isPlayerWinner = winner === "player";
  const isDraw = winner === "draw";

  return (
    <div className="game-end-display fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-background p-8 rounded-lg max-w-md w-full shadow-xl">
        <h2 className="text-3xl font-bold text-center mb-6">
          {isDraw ? "It's a Draw!" : isPlayerWinner ? "You Win!" : "You Lose!"}
        </h2>

        <div className="score-container mb-8">
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-medium">Final Score:</span>
            <div className="scores flex items-center gap-2">
              <span
                className={`text-xl font-bold ${
                  isPlayerWinner ? "text-green-500" : ""
                }`}
              >
                {playerScore}
              </span>
              <span className="text-xl">-</span>
              <span
                className={`text-xl font-bold ${
                  !isPlayerWinner && !isDraw ? "text-green-500" : ""
                }`}
              >
                {opponentScore}
              </span>
            </div>
          </div>

          <p className="text-center text-muted-foreground">
            {isDraw
              ? "Both players performed equally well!"
              : isPlayerWinner
              ? "Congratulations! You've outplayed your opponent."
              : "Better luck next time! Your opponent has won this match."}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <button
            onClick={onPlayAgain}
            className="w-full px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
          >
            Play Again
          </button>
          <button
            onClick={onBackToHome}
            className="w-full px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameEndDisplay;
