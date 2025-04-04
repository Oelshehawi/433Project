"use client";

import { useState, useEffect } from "react";
import GameBackground from "../components/game/GameBackground";
import CenterDivider from "../components/game/CenterDivider";
import GestureTowerTitle from "../components/game/GestureTowerTitle";
import Player from "../components/game/Player";
import RoomInfo from "../components/game/RoomInfo";
import BackButton from "../components/game/BackButton";
import Shield from "../components/game/Shield";
import ShieldButtons from "../components/game/ShieldButtons";
import TowerBlocks from "../components/game/TowerBlocks";
import TowerControls from "../components/game/TowerControls";
import RulesScroll from "../components/game/RulesScroll";

export default function TestGamePage() {
  const [textAnimationComplete, setTextAnimationComplete] = useState(false);
  const [rulesAnimationComplete, setRulesAnimationComplete] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);
  const [player1ShieldActive, setPlayer1ShieldActive] = useState(false);
  const [player2ShieldActive, setPlayer2ShieldActive] = useState(false);
  const [player1BlockCount, setPlayer1BlockCount] = useState(0);
  const [player2BlockCount, setPlayer2BlockCount] = useState(0);
  const roomId = "WW3WW"; // Your test room ID

  // Sequential animation steps
  useEffect(() => {
    if (textAnimationComplete && !rulesAnimationComplete && !animationComplete) {
      // Text animation is complete, rules scroll is showing
      // The scroll itself will trigger rulesAnimationComplete after 10 seconds
    } else if (textAnimationComplete && rulesAnimationComplete && !animationComplete) {
      // Rules animation is complete, now show players
      setAnimationComplete(true);
    }
  }, [textAnimationComplete, rulesAnimationComplete, animationComplete]);

  // Shield toggle handlers
  const togglePlayer1Shield = () => {
    setPlayer1ShieldActive(prev => !prev);
  };

  const togglePlayer2Shield = () => {
    setPlayer2ShieldActive(prev => !prev);
  };

  // Tower block handlers
  const addPlayer1Block = () => {
    setPlayer1BlockCount(prev => prev + 1);
  };

  const removePlayer1Block = () => {
    setPlayer1BlockCount(prev => Math.max(0, prev - 1));
  };

  const addPlayer2Block = () => {
    setPlayer2BlockCount(prev => prev + 1);
  };

  const removePlayer2Block = () => {
    setPlayer2BlockCount(prev => Math.max(0, prev - 1));
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Game Arena */}
      <div className="relative w-full h-screen flex overflow-hidden">
        {/* Background */}
        <GameBackground />
        
        {/* Title Animation */}
        <GestureTowerTitle 
          isVisible={!textAnimationComplete} 
          onAnimationComplete={() => setTextAnimationComplete(true)}
        />
        
        {/* Rules Scroll - appears after title fades out */}
        <RulesScroll
          isVisible={textAnimationComplete && !rulesAnimationComplete}
          onAnimationComplete={() => setRulesAnimationComplete(true)}
        />
        
        {/* Center Divider */}
        <CenterDivider />
        
        {/* Shield Control Buttons */}
        <ShieldButtons
          isVisible={animationComplete}
          onPlayer1Shield={togglePlayer1Shield}
          onPlayer2Shield={togglePlayer2Shield}
          isPlayer1ShieldActive={player1ShieldActive}
          isPlayer2ShieldActive={player2ShieldActive}
        />
        
        {/* Tower Control Buttons */}
        <TowerControls
          isVisible={animationComplete}
          playerSide="left"
          onAdd={addPlayer1Block}
          onRemove={removePlayer1Block}
          blockCount={player1BlockCount}
        />
        
        <TowerControls
          isVisible={animationComplete}
          playerSide="right"
          onAdd={addPlayer2Block}
          onRemove={removePlayer2Block}
          blockCount={player2BlockCount}
        />
        
        {/* Player 1 Side with Shield */}
        <div className="relative w-1/2 h-full flex items-end justify-center">
          <Player 
            playerNumber={1} 
            isVisible={animationComplete} 
            blockCount={player1BlockCount}
          />
          <TowerBlocks
            count={player1BlockCount}
            playerSide="left"
          />
        </div>
        <Shield 
          isActive={player1ShieldActive} 
          playerSide="left"
          blockCount={player1BlockCount}
        />
        
        {/* Player 2 Side with Shield */}
        <div className="relative w-1/2 h-full flex items-end justify-center">
          <Player 
            playerNumber={2} 
            isVisible={animationComplete} 
            blockCount={player2BlockCount}
          />
          <TowerBlocks
            count={player2BlockCount}
            playerSide="right"
          />
        </div>
        <Shield 
          isActive={player2ShieldActive} 
          playerSide="right"
          blockCount={player2BlockCount}
        />
        
        {/* Room Info */}
        <RoomInfo roomId={roomId} isVisible={animationComplete} />
        
        {/* Back Button */}
        <BackButton isVisible={animationComplete} />
      </div>
    </div>
  );
}