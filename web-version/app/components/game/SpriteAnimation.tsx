import React, { useEffect, useState } from 'react';
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

  // Animation settings
  const frameCount = 5; // Total frames in each animation
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
      idle: 5, // 5 frames (0-4)
      attack: 5, // 5 frames (0-4)
      damaged: 5, // 5 frames (0-4)
      win: 5, // 5 frames (0-4)
      lose: 5, // 5 frames (0-4)
    };

    // Animation prefix mapping - numbers in filenames
    const prefixMapping: Record<string, string> = {
      idle: '1 IDLE',
      attack: '4 JUMP',
      damaged: '7 HURT', // Player 1 has 7 for HURT
      win: '6 DIE', // Player 1 has 6 for DIE
      lose: '6 DIE', // Player 2 uses 6 for DIE
    };

    // Handle different prefix for Player 2 hurt and die
    let prefix = prefixMapping[animationState];
    if (playerNumber === 2) {
      if (animationState === 'damaged') prefix = '6 HURT'; // Player 2 uses 6 for HURT
      if (animationState === 'lose') prefix = '7 DIE'; // Player 2 uses 7 for DIE
    }

    // Get number of frames for this animation
    const frameCount = frameMapping[animationState] || 5;

    // Create array of frame paths
    const newFrames = Array.from({ length: frameCount }).map(
      (_, i) => `/p${playerNumber}/${prefix}_00${i}.png`
    );

    setFrames(newFrames);
    setFrame(0); // Reset to first frame on animation change
    setImageError(null); // Reset any previous errors
  }, [animationState, playerNumber]);

  // Reset animation when state changes
  useEffect(() => {
    setFrame(0);
    const frameInterval = setInterval(() => {
      setFrame((currentFrame) => (currentFrame + 1) % frameCount);
    }, frameDuration);

    return () => clearInterval(frameInterval);
  }, [animationState, frameCount, frameDuration]);

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
      transformOrigin: 'center bottom', // Ensure scaling happens from bottom center
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
