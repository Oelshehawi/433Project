"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import GameBackground from "../../../components/game/GameBackground";
import CenterDivider from "../../../components/game/CenterDivider";
import GestureTowerTitle from "../../../components/game/GestureTowerTitle";
import Player from "../../../components/game/Player";
import RoomInfo from "../../../components/game/RoomInfo";
import BackButton from "../../../components/game/BackButton";
import Shield from "../../../components/game/Shield";
import ShieldButtons from "../../../components/game/ShieldButtons";
import TowerBlocks from "../../../components/game/TowerBlocks";
import TowerControls from "../../../components/game/TowerControls";
import RulesScroll from "../../../components/game/RulesScroll";
import { useRoomStore } from "../../../lib/room/store";
import { initializeSocket, getSocketStatus } from "../../../lib/websocket";
import { getSavedRoomInfo } from "../../../components/room/RoomHelpers";

export default function GamePlayPage() {
  // Animation states
  const [textAnimationComplete, setTextAnimationComplete] = useState(false);
  const [rulesAnimationComplete, setRulesAnimationComplete] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);
  
  // Game state
  const [player1ShieldActive, setPlayer1ShieldActive] = useState(false);
  const [player2ShieldActive, setPlayer2ShieldActive] = useState(false);
  const [player1BlockCount, setPlayer1BlockCount] = useState(0);
  const [player2BlockCount, setPlayer2BlockCount] = useState(0);
  const [player1Name, setPlayer1Name] = useState("Player 1");
  const [player2Name, setPlayer2Name] = useState("Player 2");
  
  // Connection state
  const [socketConnected, setSocketConnected] = useState(false);
  
  // Get room ID from URL
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;
  
  // Get room data from store
  const { currentRoom, error } = useRoomStore();

  // Initialize WebSocket connection
  useEffect(() => {
    const socket = initializeSocket();
    console.log("WebSocket initializing in game play page");

    // Check if socket is already connected
    if (getSocketStatus() === "connected") {
      setSocketConnected(true);
    } else {
      // Set up event listener for socket connection
      const handleSocketConnected = () => {
        console.log("WebSocket connected in game play page");
        setSocketConnected(true);
      };

      window.addEventListener("ws_connected", handleSocketConnected);

      return () => {
        window.removeEventListener("ws_connected", handleSocketConnected);
      };
    }
  }, []);

  // Verify we have proper room data
  useEffect(() => {
    // If we're connected but have no room data, try to get it from localStorage
    if (socketConnected && !currentRoom) {
      const savedInfo = getSavedRoomInfo();

      if (!savedInfo.roomId || savedInfo.roomId !== roomId) {
        // No valid saved info, redirect to room view page
        console.log("No valid room info found, redirecting to room view");
        router.push(`/game/${roomId}`);
        return;
      }
    }
  }, [socketConnected, currentRoom, roomId, router]);

  // Extract player names from room data
  useEffect(() => {
    if (currentRoom && currentRoom.players.length > 0) {
      // Find BeagleBoard players
      const beagleBoardPlayers = currentRoom.players.filter(
        p => p.playerType === "beagleboard"
      );
      
      // Set player names based on the order they appear in the array
      if (beagleBoardPlayers.length >= 1) {
        setPlayer1Name(beagleBoardPlayers[0].name);
      }
      
      if (beagleBoardPlayers.length >= 2) {
        setPlayer2Name(beagleBoardPlayers[1].name);
      }
    }
  }, [currentRoom]);

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

  // Loading states
  if (!socketConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
        <p className="text-white/70">Connecting to server...</p>
      </div>
    );
  }

  if (!currentRoom) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
        <p className="text-white/70">Loading game data...</p>
      </div>
    );
  }

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
            playerName={player1Name}
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
            playerName={player2Name}
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
        
        {/* Room Info - using real room ID from params */}
        <RoomInfo roomId={roomId} isVisible={animationComplete} />
        
        {/* Back Button - returns to room view */}
        <BackButton isVisible={animationComplete} returnToRoom={true} />
        
        {/* Error display */}
        {error && (
          <div className="absolute top-4 left-0 right-0 mx-auto w-fit bg-danger/20 text-danger p-3 rounded-md">
            {error}
          </div>
        )}
      </div>
    </div>
  );
} 