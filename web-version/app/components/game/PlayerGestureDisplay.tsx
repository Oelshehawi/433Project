import React from "react";
import Shield from "./Shield";

interface PlayerGestureDisplayProps {
  player1CardPlayed: string;
  player2CardPlayed: string;
  player1ShieldActive: boolean;
  player2ShieldActive: boolean;
  gameState: "starting" | "playing";
}

const PlayerGestureDisplay: React.FC<PlayerGestureDisplayProps> = ({
  player1CardPlayed,
  player2CardPlayed,
  player1ShieldActive,
  player2ShieldActive,
  gameState,
}) => {
  return (
    <>
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
  );
};

export default PlayerGestureDisplay;
