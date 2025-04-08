import React from "react";

interface TowerDisplayProps {
  player1Name: string;
  player2Name: string;
  player1TowerHeight: number;
  player2TowerHeight: number;
  isActiveTurn: boolean;
  gameState: "starting" | "playing";
  animationComplete: boolean;
}

const TowerDisplay: React.FC<TowerDisplayProps> = ({
  player1Name,
  player2Name,
  player1TowerHeight,
  player2TowerHeight,
  isActiveTurn,
  gameState,
  animationComplete,
}) => {
  // Function to render tower blocks for a player
  const renderTowerBlocks = (
    numBlocks: number,
    playerSide: "left" | "right"
  ) => {
    const blocks = [];
    for (let i = 0; i < numBlocks; i++) {
      blocks.push(
        <div
          key={i}
          className={`tower-block ${playerSide}-tower-block`}
          style={{
            bottom: `${i * 30}px`,
            animation:
              animationComplete && gameState === "playing"
                ? `tower-block-entrance 0.3s ease forwards ${i * 0.1}s`
                : "none",
          }}
        />
      );
    }
    return blocks;
  };

  // Only render if animation is complete and game is in playing state
  if (!animationComplete || gameState !== "playing") {
    return null;
  }

  return (
    <div className="towers-container">
      {/* Left Player Tower */}
      <div className="player-tower-container left-tower">
        <div className="player-name left-player-name">
          {player1Name}
          {isActiveTurn && <span className="active-turn-indicator">●</span>}
        </div>
        <div className="tower-container">
          {renderTowerBlocks(player1TowerHeight, "left")}
          <div className="tower-base left-tower-base" />
        </div>
      </div>

      {/* Right Player Tower */}
      <div className="player-tower-container right-tower">
        <div className="player-name right-player-name">
          {player2Name}
          {!isActiveTurn && <span className="active-turn-indicator">●</span>}
        </div>
        <div className="tower-container">
          {renderTowerBlocks(player2TowerHeight, "right")}
          <div className="tower-base right-tower-base" />
        </div>
      </div>
    </div>
  );
};

export default TowerDisplay;
