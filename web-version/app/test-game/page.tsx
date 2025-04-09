"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

// Import game components
import GameBackground from "../components/game/GameBackground";
import CenterDivider from "../components/game/CenterDivider";
import GestureTowerTitle from "../components/game/GestureTowerTitle";
import RoomInfo from "../components/game/RoomInfo";
import BackButton from "../components/game/BackButton";
import ShieldButtons from "../components/game/ShieldButtons";
import RulesButton from "../components/game/RulesButton";

export default function TestGamePage() {
  // Animation states for gameplay
  const [textAnimationComplete, setTextAnimationComplete] = useState<boolean>(true);
  const [showTitle, setShowTitle] = useState<boolean>(true);
  const [rulesVisible, setRulesVisible] = useState<boolean>(false);
  const [animationComplete, setAnimationComplete] = useState<boolean>(true);
  const [componentsVisible, setComponentsVisible] = useState<boolean>(true);

  // Audio reference - store using ref callback pattern
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const audioRef = (element: HTMLAudioElement) => {
    if (element) setAudioElement(element);
  };
  
  // Build sound audio reference
  const [buildAudioElement, setBuildAudioElement] = useState<HTMLAudioElement | null>(null);
  const buildAudioRef = (element: HTMLAudioElement) => {
    if (element) setBuildAudioElement(element);
  };

  // Game state for gameplay
  const [player1ShieldActive, setPlayer1ShieldActive] = useState<boolean>(false);
  const [player2ShieldActive, setPlayer2ShieldActive] = useState<boolean>(false);
  const [player1BlockCount, setPlayer1BlockCount] = useState<number>(0);
  const [player2BlockCount, setPlayer2BlockCount] = useState<number>(0);
  const [player1Name, setPlayer1Name] = useState<string>("Player 1");
  const [player2Name, setPlayer2Name] = useState<string>("Player 2");

  // Game state for tower building
  const [player1TowerHeight, setPlayer1TowerHeight] = useState<number>(0);
  const [player2TowerHeight, setPlayer2TowerHeight] = useState<number>(0);
  const [player1GoalHeight, setPlayer1GoalHeight] = useState<number>(5);
  const [player2GoalHeight, setPlayer2GoalHeight] = useState<number>(5);
  const [currentTurn, setCurrentTurn] = useState<string>("player1");
  const [turnTimeRemaining, setTurnTimeRemaining] = useState<number>(30);

  // Constants for tower and player dimensions
  const BLOCK_HEIGHT = 40; // pixels - increased from 32px
  const BASE_HEIGHT = 15; // pixels

  // Add these state variables after other useState declarations
  const [player1BombPosition, setPlayer1BombPosition] = useState({ x: 0, y: 0 });
  const [player2BombPosition, setPlayer2BombPosition] = useState({ x: 0, y: 0 });
  const [player1BombVisible, setPlayer1BombVisible] = useState(false);
  const [player2BombVisible, setPlayer2BombVisible] = useState(false);
  const [player1AttackEnabled, setPlayer1AttackEnabled] = useState(true);
  const [player2AttackEnabled, setPlayer2AttackEnabled] = useState(true);

  // Add explosion effect state variables
  const [player1Explosion, setPlayer1Explosion] = useState(false);
  const [player2Explosion, setPlayer2Explosion] = useState(false);

  // Add player animation states
  const [player1Animation, setPlayer1Animation] = useState<'idle' | 'jump' | 'hurt' | 'die'>('idle');
  const [player2Animation, setPlayer2Animation] = useState<'idle' | 'jump' | 'hurt' | 'die'>('idle');

  // Animation duration constants
  const ANIMATION_DURATION = {
    jump: 800,   // jump animation lasts 800ms
    hurt: 600,   // hurt animation lasts 600ms
    die: 1000    // die animation lasts 1000ms (though it won't auto-reset)
  };

  // Add jump animation states
  const [player1JumpHeight, setPlayer1JumpHeight] = useState(0);
  const [player2JumpHeight, setPlayer2JumpHeight] = useState(0);

  // Add shield glow intensity state
  const [player1ShieldGlow, setPlayer1ShieldGlow] = useState(0);
  const [player2ShieldGlow, setPlayer2ShieldGlow] = useState(0);

  // SpriteAnimation component for frame-by-frame animations
  const SpriteAnimation = ({ 
    playerNumber,      // 1 or 2
    animationState,    // 'idle', 'jump', 'hurt', 'die'
    width = 72,        // Default image width
    height = 72,       // Default image height
    className = "",    // Additional styling
    jumpHeight = 0     // Additional vertical offset for jump animations
  }: {
    playerNumber: 1 | 2,
    animationState: 'idle' | 'jump' | 'hurt' | 'die',
    width?: number,
    height?: number,
    className?: string,
    jumpHeight?: number
  }) => {
    const [currentFrame, setCurrentFrame] = useState(0);
    const [frames, setFrames] = useState<string[]>([]);

    // Create frame list based on animation state
    useEffect(() => {
      // Animation frame count mapping
      const frameMapping: Record<string, number> = {
        idle: 5, // 5 frames (0-4)
        jump: 5, // 5 frames (0-4)
        hurt: 5, // 5 frames (0-4)
        die: 5   // 5 frames (0-4)
      };

      // Animation prefix mapping - numbers in filenames
      const prefixMapping: Record<string, string> = {
        idle: "1 IDLE",
        jump: "4 JUMP",
        hurt: "7 HURT", // Player 1 has 7 for HURT
        die: "6 DIE"    // Player 1 has 6 for DIE
      };

      // Handle different prefix for Player 2 hurt and die
      let prefix = prefixMapping[animationState];
      if (playerNumber === 2) {
        if (animationState === "hurt") prefix = "6 HURT"; // Player 2 uses 6 for HURT
        if (animationState === "die") prefix = "7 DIE";   // Player 2 uses 7 for DIE
      }

      // Get number of frames for this animation
      const frameCount = frameMapping[animationState] || 5;
      
      // Create array of frame paths
      const newFrames = Array.from({ length: frameCount }).map((_, i) => 
        `/p${playerNumber}/${prefix}_00${i}.png`
      );
      
      setFrames(newFrames);
      setCurrentFrame(0); // Reset to first frame on animation change
    }, [animationState, playerNumber]);

    // Animation loop
    useEffect(() => {
      if (frames.length === 0) return;
      
      // For die animation, we don't loop - we just stay on the last frame
      if (animationState === "die" && currentFrame === frames.length - 1) {
        return;
      }
      
      const intervalId = setInterval(() => {
        setCurrentFrame(prev => {
          // If this is the last frame of a non-idle animation, don't loop
          if (animationState !== "idle" && prev === frames.length - 1) {
            return prev;
          }
          // Otherwise loop through frames
          return (prev + 1) % frames.length;
        });
      }, 1000 / 10); // 10 fps
      
      return () => clearInterval(intervalId);
    }, [frames, animationState, currentFrame]);

    if (frames.length === 0) {
      return null;
    }

    // Apply consistent size normalization based on animation type
    // This ensures hurt and die animations are displayed at the same size as idle and jump
    const getAnimationStyles = () => {
      const baseTransform = jumpHeight > 0 ? `translateY(-${jumpHeight}px)` : '';
      
      // Apply animation-specific scaling to normalize sizes
      const animationScaling = {
        idle: 1,
        jump: 1,
        hurt: 1.2, // Scale up hurt animation to match others
        die: 1.2   // Scale up die animation to match others
      };
      
      const scale = animationScaling[animationState] || 1;
      
      return {
        transform: baseTransform + (scale !== 1 ? ` scale(${scale})` : ''),
        transition: 'transform 0.2s ease-out',
        transformOrigin: 'center bottom' // Ensure scaling happens from bottom center
      };
    };

    return (
      <div 
        className={`relative ${className}`}
        style={getAnimationStyles()}
      >
        <Image
          src={frames[currentFrame]}
          alt={`Player ${playerNumber} ${animationState}`}
          width={width}
          height={height}
          priority
          className="object-contain"
        />
      </div>
    );
  };

  // Fix the audio file variables to avoid confusion
  const [attackSound] = useState(() => typeof Audio !== 'undefined' ? new Audio('/sounds/attack.mp3') : null);

  // Add a useEffect to log when audio is loaded
  useEffect(() => {
    if (audioElement) {
      console.log('Shield audio element mounted:', audioElement);
      
      // Add event listeners for debugging
      audioElement.addEventListener('loadeddata', () => {
        console.log('Shield audio loaded successfully');
      });
      
      audioElement.addEventListener('error', (e) => {
        console.error('Shield audio loading error:', e);
      });
    }
  }, [audioElement]);
  
  // Add a useEffect for build sound
  useEffect(() => {
    if (buildAudioElement) {
      console.log('Build audio element mounted:', buildAudioElement);
      
      // Add event listeners for debugging
      buildAudioElement.addEventListener('loadeddata', () => {
        console.log('Build audio loaded successfully');
      });
      
      buildAudioElement.addEventListener('error', (e) => {
        console.error('Build audio loading error:', e);
      });
    }
  }, [buildAudioElement]);

  // Helper function to play shield sound with enhanced error handling
  const playShieldSound = () => {
    console.log('Attempting to play shield sound');
    if (audioElement) {
      try {
        // Reset to beginning
        audioElement.currentTime = 0;
        console.log('Audio element found, playing sound');
        
        // Play the sound
        audioElement.play().then(() => {
          console.log('Shield sound playing successfully');
        }).catch((error: Error) => {
          console.error("Failed to play shield sound:", error);
        });
      } catch (error) {
        console.error("Error in playShieldSound:", error);
      }
    } else {
      console.warn('Audio element not found');
    }
  };

  // Helper function to play build sound with enhanced error handling
  const playBuildSound = () => {
    console.log('Attempting to play build sound');
    if (buildAudioElement) {
      try {
        // Reset to beginning
        buildAudioElement.currentTime = 0;
        console.log('Build audio element found, playing sound');
        
        // Play the sound
        buildAudioElement.play().then(() => {
          console.log('Build sound playing successfully');
        }).catch((error: Error) => {
          console.error("Failed to play build sound:", error);
        });
      } catch (error) {
        console.error("Error in playBuildSound:", error);
      }
    } else {
      console.warn('Build audio element not found');
    }
  };

  // Helper functions
  const togglePlayer1Shield = () => {
    const newState = !player1ShieldActive;
    setPlayer1ShieldActive(newState);
    
    // Only play sound when activating shield
    if (newState) {
      playShieldSound();
    }
  };

  const togglePlayer2Shield = () => {
    const newState = !player2ShieldActive;
    setPlayer2ShieldActive(newState);
    
    // Only play sound when activating shield
    if (newState) {
      playShieldSound();
    }
  };

  const toggleRules = () => {
    setRulesVisible(!rulesVisible);
  };

  const toggleComponentsVisibility = () => {
    setComponentsVisible(!componentsVisible);
  };

  // Add block to player 1 tower
  const addBlockPlayer1 = () => {
    const newCount = player1BlockCount + 1;
    setPlayer1BlockCount(newCount);
    setPlayer1TowerHeight(newCount);
    playBuildSound(); // Play sound when block is added
  };

  // Remove block from player 1 tower
  const removeBlockPlayer1 = () => {
    if (player1BlockCount > 0) {
      const newCount = player1BlockCount - 1;
      setPlayer1BlockCount(newCount);
      setPlayer1TowerHeight(newCount);
    }
  };

  // Add block to player 2 tower
  const addBlockPlayer2 = () => {
    const newCount = player2BlockCount + 1;
    setPlayer2BlockCount(newCount);
    setPlayer2TowerHeight(newCount);
    playBuildSound(); // Play sound when block is added
  };

  // Remove block from player 2 tower
  const removeBlockPlayer2 = () => {
    if (player2BlockCount > 0) {
      const newCount = player2BlockCount - 1;
      setPlayer2BlockCount(newCount);
      setPlayer2TowerHeight(newCount);
    }
  };

  // Update the launchBomb function to add shield glow effect when bombs approach
  const launchBomb = (player: 'player1' | 'player2') => {
    // Play attack sound when launching the bomb
    playAttackSound();
    
    const startX = player === 'player1' ? 25 : 75;
    const targetX = player === 'player1' ? 75 : 25;
    
    // Calculate position to target middle of player PNG
    // For the y position, we need to account for:
    // 1. Tower height (blocks * BLOCK_HEIGHT)
    // 2. Base platform height (BASE_HEIGHT)
    // 3. Bottom positioning of tower (bottom-10 = 10px)
    // 4. Offset to target middle of player image (~50px)
    const targetY = player === 'player1' 
      ? (player2BlockCount * BLOCK_HEIGHT + BASE_HEIGHT + 10 + 50)
      : (player1BlockCount * BLOCK_HEIGHT + BASE_HEIGHT + 10 + 50);
    
    // Convert targetY to percentage for consistent positioning
    const targetYPercent = (targetY / window.innerHeight) * 100;
    
    if (player === 'player1') {
      setPlayer1BombPosition({ x: startX, y: 0 });
      setPlayer1BombVisible(true);
      setPlayer1AttackEnabled(false);
    } else {
      setPlayer2BombPosition({ x: startX, y: 0 });
      setPlayer2BombVisible(true);
      setPlayer2AttackEnabled(false);
    }

    // Animate bomb
    const duration = 1500; // 1.5 seconds
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Calculate x position - linear path
      const x = startX + (targetX - startX) * progress;
      
      // Calculate y position - combine parabolic arc with linear rise to target
      const arcComponent = -4 * progress * (progress - 1) * 100; // High arc
      const linearComponent = progress * targetYPercent; // Linear rise to target height
      
      // Combined trajectory
      const y = linearComponent + arcComponent;

      if (player === 'player1') {
        setPlayer1BombPosition({ x, y });
        
        // Update shield glow based on bomb proximity to player 2
        if (player2ShieldActive) {
          // Calculate proximity - increases as bomb gets closer to player 2
          // Progress is 0 at start, 1 at target, so proximity increases as progress approaches 1
          const proximity = Math.pow(progress, 2); // Non-linear increase for more dramatic effect
          const glowIntensity = Math.min(proximity * 3, 1); // Scale to max 1, with faster increase
          setPlayer2ShieldGlow(glowIntensity);
        }
      } else {
        setPlayer2BombPosition({ x, y });
        
        // Update shield glow based on bomb proximity to player 1
        if (player1ShieldActive) {
          // Calculate proximity - increases as bomb gets closer to player 1
          const proximity = Math.pow(progress, 2);
          const glowIntensity = Math.min(proximity * 3, 1);
          setPlayer1ShieldGlow(glowIntensity);
        }
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Ensure final position is exactly on the player
        if (player === 'player1') {
          setPlayer1BombPosition({ x: targetX, y: targetYPercent });
          setTimeout(() => {
            setPlayer1BombVisible(false);
            setPlayer1AttackEnabled(true);
            
            // Reset shield glow with a slight delay for visual effect
            setTimeout(() => {
              setPlayer2ShieldGlow(0);
            }, 300);
            
            if (!player2ShieldActive) {
              // Show explosion effect on player 2 only if shield is not active
              setPlayer2Explosion(true);
              
              // Set player 2 animation to hurt
              setPlayer2Animation('hurt');
              
              // Hide explosion after 500ms
              setTimeout(() => {
                setPlayer2Explosion(false);
              }, 500);
              
              // Reduce tower count only if shield is not active
              setPlayer2BlockCount(prev => {
                const newCount = Math.max(0, prev - 1);
                
                // If player loses (tower reduced to 0), set die animation
                if (newCount === 0) {
                  setPlayer2Animation('die');
                  // Don't reset die animation - it stays at final frame
                } else {
                  // Otherwise reset to idle after hurt animation
                  setTimeout(() => {
                    setPlayer2Animation('idle');
                  }, ANIMATION_DURATION.hurt);
                }
                
                return newCount;
              });
              setPlayer2TowerHeight(prev => Math.max(0, prev - 1));
            }
          }, 100); // Brief pause at target for visual effect
        } else {
          setPlayer2BombPosition({ x: targetX, y: targetYPercent });
          setTimeout(() => {
            setPlayer2BombVisible(false);
            setPlayer2AttackEnabled(true);
            
            // Reset shield glow with a slight delay for visual effect
            setTimeout(() => {
              setPlayer1ShieldGlow(0);
            }, 300);
            
            if (!player1ShieldActive) {
              // Show explosion effect on player 1 only if shield is not active
              setPlayer1Explosion(true);
              
              // Set player 1 animation to hurt
              setPlayer1Animation('hurt');
              
              // Hide explosion after 500ms
              setTimeout(() => {
                setPlayer1Explosion(false);
              }, 500);
              
              // Reduce tower count only if shield is not active
              setPlayer1BlockCount(prev => {
                const newCount = Math.max(0, prev - 1);
                
                // If player loses (tower reduced to 0), set die animation
                if (newCount === 0) {
                  setPlayer1Animation('die');
                  // Don't reset die animation - it stays at final frame
                } else {
                  // Otherwise reset to idle after hurt animation
                  setTimeout(() => {
                    setPlayer1Animation('idle');
                  }, ANIMATION_DURATION.hurt);
                }
                
                return newCount;
              });
              setPlayer1TowerHeight(prev => Math.max(0, prev - 1));
            }
          }, 100); // Brief pause at target for visual effect
        }
      }
    };

    requestAnimationFrame(animate);
  };

  // Update handlePlayer1Attack to add vertical jump motion
  const handlePlayer1Attack = () => {
    if (player2BlockCount > 0 && player1AttackEnabled) {
      // Set jump animation
      setPlayer1Animation('jump');
      
      // Add vertical jump motion
      const jumpAnimation = () => {
        // Jump up
        setPlayer1JumpHeight(30);
        
        // After 400ms, start coming down
        setTimeout(() => {
          setPlayer1JumpHeight(15);
          
          // Land completely after another 400ms
          setTimeout(() => {
            setPlayer1JumpHeight(0);
          }, 400);
        }, 400);
      };
      
      jumpAnimation();
      
      // Reset animation state after duration
      setTimeout(() => {
        setPlayer1Animation('idle');
      }, ANIMATION_DURATION.jump);
      
      // Launch the bomb
      launchBomb('player1');
    }
  };

  // Update handlePlayer2Attack to add vertical jump motion
  const handlePlayer2Attack = () => {
    if (player1BlockCount > 0 && player2AttackEnabled) {
      // Set jump animation
      setPlayer2Animation('jump');
      
      // Add vertical jump motion
      const jumpAnimation = () => {
        // Jump up
        setPlayer2JumpHeight(30);
        
        // After 400ms, start coming down
        setTimeout(() => {
          setPlayer2JumpHeight(15);
          
          // Land completely after another 400ms
          setTimeout(() => {
            setPlayer2JumpHeight(0);
          }, 400);
        }, 400);
      };
      
      jumpAnimation();
      
      // Reset animation state after duration
      setTimeout(() => {
        setPlayer2Animation('idle');
      }, ANIMATION_DURATION.jump);
      
      // Launch the bomb
      launchBomb('player2');
    }
  };

  // Modify the AttackButtons component
  const AttackButtons = ({ 
    onPlayer1Attack,
    onPlayer2Attack,
    player1AttackEnabled,
    player2AttackEnabled,
    isVisible
  }: {
    onPlayer1Attack: () => void;
    onPlayer2Attack: () => void;
    player1AttackEnabled: boolean;
    player2AttackEnabled: boolean;
    isVisible: boolean;
  }) => {
    if (!isVisible) return null;

    return (
      <div className="absolute bottom-32 left-0 right-0 flex justify-center z-50">
        <div className="flex gap-40">
          <button
            onClick={onPlayer1Attack}
            disabled={!player1AttackEnabled}
            className={`px-4 py-2 rounded-lg text-white font-bold ${
              player1AttackEnabled ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-500 cursor-not-allowed'
            }`}
          >
            Attack!
          </button>
          <button
            onClick={onPlayer2Attack}
            disabled={!player2AttackEnabled}
            className={`px-4 py-2 rounded-lg text-white font-bold ${
              player2AttackEnabled ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-500 cursor-not-allowed'
            }`}
          >
            Attack!
          </button>
        </div>
      </div>
    );
  };

  const playAttackSound = () => {
    if (attackSound) {
      attackSound.currentTime = 0;
      attackSound.play();
    }
  };

  return (
    <div className="relative w-full h-screen bg-gray-100">
      {/* Hidden audio element that will be used for playing the shield sound */}
      <audio 
        ref={audioRef}
        preload="auto"
        style={{ display: 'none' }}
      >
        {/* Provide multiple source formats for better browser compatibility */}
        <source src="/sounds/shield.mp3" type="audio/mpeg" />
        {/* Fallback text for browsers that don't support audio */}
        Your browser does not support the audio element.
      </audio>
      
      {/* Hidden audio element that will be used for playing the build sound */}
      <audio 
        ref={buildAudioRef}
        preload="auto"
        style={{ display: 'none' }}
      >
        <source src="/sounds/build.mp3" type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>

      {/* Background */}
      <GameBackground />

      {/* Back Button */}
      <div className="absolute top-4 left-4 z-50">
        <BackButton isVisible={componentsVisible} />
      </div>

      {/* Room Info */}
      <div className="absolute top-4 right-4 z-50">
        <RoomInfo roomId="TEST-ROOM" isVisible={componentsVisible} />
      </div>

      {/* Title Animation */}
      <div className="absolute top-8 left-0 right-0 z-30">
        <GestureTowerTitle 
          isVisible={showTitle} 
          onAnimationComplete={() => setTextAnimationComplete(true)} 
        />
      </div>

      {/* Center Divider */}
      <div className="absolute inset-0 flex justify-center items-center pointer-events-none z-20">
        <CenterDivider />
      </div>

      {/* Rules Button */}
      <div className="absolute bottom-4 left-4 z-50">
        <RulesButton />
      </div>

      {/* Shield Buttons */}
      <ShieldButtons
        onPlayer1Shield={togglePlayer1Shield}
        onPlayer2Shield={togglePlayer2Shield}
        isPlayer1ShieldActive={player1ShieldActive}
        isPlayer2ShieldActive={player2ShieldActive}
        isVisible={componentsVisible}
      />

      <AttackButtons
        onPlayer1Attack={handlePlayer1Attack}
        onPlayer2Attack={handlePlayer2Attack}
        player1AttackEnabled={player1AttackEnabled}
        player2AttackEnabled={player2AttackEnabled}
        isVisible={componentsVisible}
      />

      {/* Player 1 Shield - positioned defensively */}
      {player1ShieldActive && (
        <div className="absolute z-40" style={{ 
          bottom: `${player1BlockCount * BLOCK_HEIGHT + BASE_HEIGHT + 20}px`,
          left: '25%', 
          width: '160px',
          height: '160px',
          // Thicker edges with slight opacity in center
          background: `radial-gradient(circle, rgba(186,104,255,${0.15 + player1ShieldGlow * 0.1}) 20%, rgba(186,104,255,${0.25 + player1ShieldGlow * 0.3}) 60%, rgba(186,104,255,${0.6 + player1ShieldGlow * 0.4}) 85%, rgba(186,104,255,${0.2 + player1ShieldGlow * 0.3}) 100%)`,
          borderRadius: '50%',
          transform: 'translate(-50%, 0)',
          pointerEvents: 'none',
          boxShadow: `0 0 ${20 + player1ShieldGlow * 40}px rgba(186,104,255,${0.6 + player1ShieldGlow * 0.4})`,
          transition: 'box-shadow 0.1s ease-out, background 0.1s ease-out',
          // Thicker border that intensifies with proximity
          border: `${2 + player1ShieldGlow * 4}px solid rgba(186,104,255,${0.7 + player1ShieldGlow * 0.3})`
        }}>
          {/* Pulsing effect inner circle - slightly visible in center */}
          <div className="absolute inset-0 animate-pulse" style={{
            background: `radial-gradient(circle, rgba(186,104,255,${0.1 + player1ShieldGlow * 0.1}) 30%, rgba(186,104,255,${0.2 + player1ShieldGlow * 0.2}) 65%, rgba(186,104,255,${0.3 + player1ShieldGlow * 0.3}) 85%, rgba(186,104,255,${0.1 + player1ShieldGlow * 0.2}) 100%)`,
            borderRadius: '50%',
            animation: player1ShieldGlow > 0.5 ? 'shieldReact 0.5s ease-out infinite' : 'shieldPulse 2s ease-in-out infinite'
          }}></div>
        </div>
      )}

      {/* Player 2 Shield - positioned defensively */}
      {player2ShieldActive && (
        <div className="absolute z-40" style={{ 
          bottom: `${player2BlockCount * BLOCK_HEIGHT + BASE_HEIGHT + 20}px`,
          right: '25%', 
          width: '160px',
          height: '160px',
          // Thicker edges with slight opacity in center
          background: `radial-gradient(circle, rgba(186,104,255,${0.15 + player2ShieldGlow * 0.1}) 20%, rgba(186,104,255,${0.25 + player2ShieldGlow * 0.3}) 60%, rgba(186,104,255,${0.6 + player2ShieldGlow * 0.4}) 85%, rgba(186,104,255,${0.2 + player2ShieldGlow * 0.3}) 100%)`,
          borderRadius: '50%',
          transform: 'translate(50%, 0)',
          pointerEvents: 'none',
          boxShadow: `0 0 ${20 + player2ShieldGlow * 40}px rgba(186,104,255,${0.6 + player2ShieldGlow * 0.4})`,
          transition: 'box-shadow 0.1s ease-out, background 0.1s ease-out',
          // Thicker border that intensifies with proximity
          border: `${2 + player2ShieldGlow * 4}px solid rgba(186,104,255,${0.7 + player2ShieldGlow * 0.3})`
        }}>
          {/* Pulsing effect inner circle - slightly visible in center */}
          <div className="absolute inset-0 animate-pulse" style={{
            background: `radial-gradient(circle, rgba(186,104,255,${0.1 + player2ShieldGlow * 0.1}) 30%, rgba(186,104,255,${0.2 + player2ShieldGlow * 0.2}) 65%, rgba(186,104,255,${0.3 + player2ShieldGlow * 0.3}) 85%, rgba(186,104,255,${0.1 + player2ShieldGlow * 0.2}) 100%)`,
            borderRadius: '50%',
            animation: player2ShieldGlow > 0.5 ? 'shieldReact 0.5s ease-out infinite' : 'shieldPulse 2s ease-in-out infinite'
          }}></div>
        </div>
      )}

      {/* Tower Control Buttons */}
      <div className="absolute bottom-40 left-0 right-0 flex justify-center z-50">
        <div className="bg-gray-800 bg-opacity-80 rounded-lg p-4 flex flex-wrap gap-4 max-w-3xl">
          <div className="flex flex-col items-center">
            <h3 className="text-white mb-2">Player 1 Tower</h3>
            <div className="text-xl font-bold text-blue-300 mb-3">{player1BlockCount} blocks</div>
            <div className="flex gap-2">
              <button 
                className="px-4 py-2 bg-blue-500 text-white rounded text-lg font-bold"
                onClick={addBlockPlayer1}
              >
                Add Block
              </button>
              <button 
                className="px-4 py-2 bg-red-500 text-white rounded text-lg font-bold"
                onClick={removeBlockPlayer1}
                disabled={player1BlockCount === 0}
              >
                Remove Block
              </button>
            </div>
          </div>

          <div className="h-auto w-0.5 bg-gray-600 mx-4"></div>

          <div className="flex flex-col items-center">
            <h3 className="text-white mb-2">Player 2 Tower</h3>
            <div className="text-xl font-bold text-red-300 mb-3">{player2BlockCount} blocks</div>
            <div className="flex gap-2">
              <button 
                className="px-4 py-2 bg-blue-500 text-white rounded text-lg font-bold"
                onClick={addBlockPlayer2}
              >
                Add Block
              </button>
              <button 
                className="px-4 py-2 bg-red-500 text-white rounded text-lg font-bold"
                onClick={removeBlockPlayer2}
                disabled={player2BlockCount === 0}
              >
                Remove Block
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Goal indicators */}
      <div className="absolute left-24 z-20" style={{ 
        bottom: `${player1GoalHeight * BLOCK_HEIGHT + BASE_HEIGHT + 120}px` 
      }}>
        <div className="flex items-center">
          <div className="h-1 w-12 bg-yellow-400"></div>
          <span className="text-yellow-400 text-xs font-bold ml-1">GOAL</span>
        </div>
      </div>

      <div className="absolute right-24 z-20" style={{ 
        bottom: `${player2GoalHeight * BLOCK_HEIGHT + BASE_HEIGHT + 120}px` 
      }}>
        <div className="flex items-center">
          <span className="text-yellow-400 text-xs font-bold mr-1">GOAL</span>
          <div className="h-1 w-12 bg-yellow-400"></div>
        </div>
      </div>

      {/* Player Towers - completely separate implementation for each player */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-around">
        {/* Player 1 Tower - fixed position left side */}
        <div className="absolute bottom-10 left-[25%] -translate-x-1/2 w-40">
          <div className="flex flex-col items-center">
            {/* Player 1 Display */}
            <div className="relative">
              {/* Info plate above player */}
              <div className="absolute -top-14 left-1/2 transform -translate-x-1/2 w-32 bg-gray-900 rounded-md flex flex-col items-center justify-center py-1 px-2">
                <span className="text-white text-sm font-medium">{player1Name}</span>
                <span className="text-blue-300 text-sm font-bold">{player1TowerHeight}/{player1GoalHeight}</span>
              </div>
              
              {/* Player image */}
              {componentsVisible && (
                <div className="flex justify-center" style={{ marginTop: "35px", marginBottom: "-10px" }}>
                  <SpriteAnimation
                    playerNumber={1}
                    animationState={player1Animation}
                    width={100}
                    height={100}
                    className="object-contain"
                    jumpHeight={player1JumpHeight}
                  />
                </div>
              )}
            </div>
            
            {/* Tower Structure */}
            <div className="flex flex-col items-center">
              {/* Tower blocks */}
              <div className="flex flex-col">
                {Array.from({ length: player1BlockCount }).map((_, i) => {
                  // Calculate offset based on index - more extreme
                  const offsetX = i % 3 === 0 ? -8 : i % 3 === 1 ? 10 : 0;
                  // Add slight rotation for more Jenga-like appearance
                  const rotation = i % 3 === 0 ? -1 : i % 3 === 1 ? 1 : 0;
                  
                  return (
                    <div 
                      key={`p1-block-${i}`} 
                      className="w-30 h-[40px] bg-blue-500 border-b border-blue-700"
                      style={{
                        borderTopLeftRadius: i === 0 ? '4px' : '0',
                        borderTopRightRadius: i === 0 ? '4px' : '0',
                        transform: `translateX(${offsetX}px) rotate(${rotation}deg)`,
                        marginTop: '-1px'
                      }}
                    />
                  );
                })}
              </div>
              
              {/* Base platform - always present */}
              <div className="w-36 h-[15px] bg-gray-800 rounded-b-md"></div>
            </div>
          </div>
        </div>
        
        {/* Player 2 Tower - fixed position right side */}
        <div className="absolute bottom-10 right-[25%] translate-x-1/2 w-40">
          <div className="flex flex-col items-center">
            {/* Player 2 Display */}
            <div className="relative">
              {/* Info plate above player */}
              <div className="absolute -top-14 left-1/2 transform -translate-x-1/2 w-32 bg-gray-900 rounded-md flex flex-col items-center justify-center py-1 px-2">
                <span className="text-white text-sm font-medium">{player2Name}</span>
                <span className="text-red-300 text-sm font-bold">{player2TowerHeight}/{player2GoalHeight}</span>
              </div>
              
              {/* Player image */}
              {componentsVisible && (
                <div className="flex justify-center" style={{ marginTop: "35px", marginBottom: "-10px" }}>
                  <SpriteAnimation
                    playerNumber={2}
                    animationState={player2Animation}
                    width={100}
                    height={100}
                    className="object-contain"
                    jumpHeight={player2JumpHeight}
                  />
                </div>
              )}
            </div>
            
            {/* Tower Structure */}
            <div className="flex flex-col items-center">
              {/* Tower blocks */}
              <div className="flex flex-col">
                {Array.from({ length: player2BlockCount }).map((_, i) => {
                  // Calculate offset based on index (opposite of player 1) - more extreme
                  const offsetX = i % 3 === 0 ? 8 : i % 3 === 1 ? -10 : 0;
                  // Add slight rotation for more Jenga-like appearance (opposite direction)
                  const rotation = i % 3 === 0 ? 1 : i % 3 === 1 ? -1 : 0;
                  
                  return (
                    <div 
                      key={`p2-block-${i}`} 
                      className="w-30 h-[40px] bg-red-500 border-b border-red-700"
                      style={{
                        borderTopLeftRadius: i === 0 ? '4px' : '0',
                        borderTopRightRadius: i === 0 ? '4px' : '0',
                        transform: `translateX(${offsetX}px) rotate(${rotation}deg)`,
                        marginTop: '-1px'
                      }}
                    />
                  );
                })}
              </div>
              
              {/* Base platform - always present */}
              <div className="w-36 h-[15px] bg-gray-800 rounded-b-md"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls Panel */}
      <div className="absolute bottom-4 w-full flex justify-center z-40">
        <div className="bg-gray-800 bg-opacity-70 rounded-lg p-4 flex gap-4">
          <button 
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={() => setCurrentTurn(currentTurn === "player1" ? "player2" : "player1")}
          >
            Toggle Turn
          </button>
          <button 
            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
            onClick={() => {
              setPlayer1TowerHeight(0);
              setPlayer2TowerHeight(0);
              setPlayer1BlockCount(0);
              setPlayer2BlockCount(0);
            }}
          >
            Reset Towers
          </button>
          <button 
            className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600"
            onClick={() => {
              setPlayer1ShieldActive(false);
              setPlayer2ShieldActive(false);
            }}
          >
            Reset Shields
          </button>
          <button 
            className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
            onClick={() => setShowTitle(!showTitle)}
          >
            Toggle Title
          </button>
          <button 
            className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600"
            onClick={toggleComponentsVisibility}
          >
            Toggle Components
          </button>
        </div>
      </div>

      {/* Player Explosion Effects */}
      {player1Explosion && (
        <div className="absolute z-60" style={{ 
          bottom: `${player1BlockCount * BLOCK_HEIGHT + BASE_HEIGHT + 20}px`,
          left: '25%', 
          width: '150px',
          height: '150px',
          background: 'radial-gradient(circle, rgba(255,150,100,0.8) 0%, rgba(100,100,100,0.6) 70%, rgba(0,0,0,0) 100%)',
          borderRadius: '50%',
          transform: 'translate(-50%, 0)',
          pointerEvents: 'none'
        }}>
          {/* Smaller smoke particles */}
          <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2" style={{
            background: 'radial-gradient(circle, rgba(200,200,200,0.9) 0%, rgba(150,150,150,0.5) 70%, rgba(0,0,0,0) 100%)',
            borderRadius: '50%',
            animation: 'expandSmoke 0.5s ease-out forwards',
            transformOrigin: 'center'
          }}></div>
          <div className="absolute top-1/3 left-1/3 w-1/3 h-1/3" style={{
            background: 'radial-gradient(circle, rgba(220,220,220,0.9) 0%, rgba(170,170,170,0.5) 70%, rgba(0,0,0,0) 100%)',
            borderRadius: '50%',
            animation: 'expandSmoke 0.4s ease-out forwards',
            transformOrigin: 'center'
          }}></div>
        </div>
      )}
      
      {player2Explosion && (
        <div className="absolute z-60" style={{ 
          bottom: `${player2BlockCount * BLOCK_HEIGHT + BASE_HEIGHT + 20}px`,
          right: '25%', 
          width: '150px',
          height: '150px',
          background: 'radial-gradient(circle, rgba(255,150,100,0.8) 0%, rgba(100,100,100,0.6) 70%, rgba(0,0,0,0) 100%)',
          borderRadius: '50%',
          transform: 'translate(50%, 0)',
          pointerEvents: 'none'
        }}>
          {/* Smaller smoke particles */}
          <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2" style={{
            background: 'radial-gradient(circle, rgba(200,200,200,0.9) 0%, rgba(150,150,150,0.5) 70%, rgba(0,0,0,0) 100%)',
            borderRadius: '50%',
            animation: 'expandSmoke 0.5s ease-out forwards',
            transformOrigin: 'center'
          }}></div>
          <div className="absolute top-1/3 left-1/3 w-1/3 h-1/3" style={{
            background: 'radial-gradient(circle, rgba(220,220,220,0.9) 0%, rgba(170,170,170,0.5) 70%, rgba(0,0,0,0) 100%)',
            borderRadius: '50%',
            animation: 'expandSmoke 0.4s ease-out forwards',
            transformOrigin: 'center'
          }}></div>
        </div>
      )}

      {/* Add keyframes for smoke animation to the component */}
      <style jsx global>{`
        @keyframes expandSmoke {
          0% {
            transform: scale(0.3);
            opacity: 0.9;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
        
        @keyframes shieldPulse {
          0% {
            opacity: 0.2;
            transform: scale(0.95);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.05);
          }
          100% {
            opacity: 0.2;
            transform: scale(0.95);
          }
        }
        
        @keyframes shieldReact {
          0% {
            opacity: 0.3;
            transform: scale(0.9);
          }
          50% {
            opacity: 0.9;
            transform: scale(1.1);
          }
          100% {
            opacity: 0.3;
            transform: scale(0.9);
          }
        }
      `}</style>
      
      {/* Bomb animations */}
      {player1BombVisible && (
        <motion.div
          className="absolute w-8 h-8 z-50"
          style={{
            left: `${player1BombPosition.x}%`,
            bottom: `${player1BombPosition.y}%`,
          }}
        >
          <Image
            src="/bomb p1.png"
            alt="Player 1 Bomb"
            width={32}
            height={32}
            className="object-contain"
          />
        </motion.div>
      )}
      
      {player2BombVisible && (
        <motion.div
          className="absolute w-8 h-8 z-50"
          style={{
            left: `${player2BombPosition.x}%`,
            bottom: `${player2BombPosition.y}%`,
          }}
        >
          <Image
            src="/bomb p2.png"
            alt="Player 2 Bomb"
            width={32}
            height={32}
            className="object-contain"
          />
        </motion.div>
      )}
    </div>
  );
} 