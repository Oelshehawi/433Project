import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';

type AnimationState = 'idle' | 'attack' | 'damaged' | 'win' | 'lose';

interface SpriteAnimationProps {
  playerNumber: 1 | 2;
  animationState: AnimationState;
  width?: number;
  height?: number;
  className?: string;
  jumpHeight?: number;
}

const SpriteAnimation = ({
  playerNumber,
  animationState,
  width = 72,
  height = 72,
  className = '',
  jumpHeight = 0,
}: SpriteAnimationProps) => {
  const [frame, setFrame] = useState(0);
  const [frames, setFrames] = useState<string[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  // Add ref for interval with proper typing
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Animation settings
  const frameDuration = 150; // Duration of each frame in ms

  // Player-specific scaling to make both players appear the same size
  // Player 2 (spear) needs to be scaled up to match Player 1 (sword)
  const playerScaling = {
    1: 1.15, // Player 1 baseline
    2: 1.0, // Player 2 scaled up to match
  };

  // Animation scaling factors
  const animationScaling: Record<AnimationState, number> = {
    idle: 0.9,
    attack: 1,
    damaged: 0.9,
    win: 1.1,
    lose: 0.7,
  };

  // Create frame list based on animation state
  useEffect(() => {
    // Animation frame count mapping
    const frameMapping: Record<string, number> = {
      idle: 5,
      attack: 5, 
      damaged: 5, 
      win: 5,
      lose: 5, 
    };

    // Animation prefix mapping - numbers in filenames
    const prefixMapping: Record<string, string> = {
      idle: '1 IDLE',
      attack: '4 JUMP',
      damaged: '7 HURT', 
      win: '6 DIE', 
      lose: '6 DIE', 
    };

    // Handle different prefix for Player 2 hurt and die
    let prefix = prefixMapping[animationState];
    if (playerNumber === 2) {
      if (animationState === 'damaged') prefix = '6 HURT'; 
      if (animationState === 'lose') prefix = '7 DIE'; 
    }

    // Get number of frames for this animation
    const frameCount = frameMapping[animationState] || 5;

    // Create array of frame paths
    const newFrames = Array.from({ length: frameCount }).map(
      (_, i) => `/p${playerNumber}/${prefix}_00${i}.png`
    );

    setFrames(newFrames);
    setFrame(0); // Reset to first frame on animation change
    setImageError(null); 
  }, [animationState, playerNumber]);

  // Reset animation when state changes
  useEffect(() => {
    // Set the frame back to start
    setFrame(0);

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Set up interval for frame update
    intervalRef.current = setInterval(() => {
      setFrame((prevFrame) => {
        // If at the last frame, start over
        if (prevFrame >= frames.length - 1) {
          return 0;
        }
        return prevFrame + 1;
      });
    }, frameDuration);

    // Clean up interval on unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [frameDuration, frames.length, animationState]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  if (frames.length === 0) {
    return null;
  }

  // Apply consistent size normalization based on animation type and player
  const getAnimationStyles = () => {
    const baseTransform = jumpHeight > 0 ? `translateY(-${jumpHeight}px)` : '';

    // Apply animation-specific scaling to normalize sizes
    const animScale = animationScaling[animationState] || 1;

    // Apply player-specific scaling to ensure both players appear same size
    const playerScale = playerScaling[playerNumber];

    // Combine both scaling factors
    const scale = animScale * playerScale;

    return {
      transform: `${baseTransform} ${
        scale !== 1 ? `scale(${scale})` : ''
      }`.trim(),
      transition: 'transform 0.2s ease-out',
      transformOrigin: 'center bottom', 
    };
  };

  const handleImageError = () => {
    setImageError(`Failed to load sprite: ${frames[frame]}`);
  };

  return (
    <div
      className={`relative ${className}`}
      style={{ width, height, ...getAnimationStyles() }}
      data-player={playerNumber}
      data-animation={animationState}
    >
      {imageError ? (
        <div className='w-full h-full flex items-center justify-center bg-gray-200/40 rounded'>
          <div className='text-xs text-red-500 text-center p-1'>
            Sprite Error
          </div>
        </div>
      ) : (
        <Image
          src={frames[frame]}
          alt={`Player ${playerNumber} ${animationState}`}
          width={width}
          height={height}
          priority
          className='object-contain'
          onError={handleImageError}
        />
      )}
    </div>
  );
};

export default SpriteAnimation;
