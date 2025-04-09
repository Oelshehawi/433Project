import { motion } from 'framer-motion';
import SpriteAnimation from './SpriteAnimation';

// New animation states used by SpriteAnimation
type AnimationState = 'idle' | 'attack' | 'damaged' | 'win' | 'lose';

// Include both new states and legacy states in the Player prop type
// This should match the type used in game.ts
type PlayerAnimationState = 'idle' | 'jump' | 'hurt' | 'die';

interface PlayerProps {
  playerId: string;
  name: string;
  isVisible: boolean;
  animationState?: PlayerAnimationState;
  jumpHeight?: number;
}

export default function Player({
  playerId,
  name,
  isVisible,
  animationState = 'idle',
  jumpHeight = 0,
}: PlayerProps) {
  const isPlayer1 = playerId === 'player1';
  const playerNumber = isPlayer1 ? 1 : 2;

  // Map animation states to ensure compatibility with SpriteAnimation
  const mapAnimationState = (): AnimationState => {
    switch (animationState) {
      case 'idle':
        return 'idle';
      case 'jump':
        return 'attack';
      case 'hurt':
        return 'damaged';
      case 'die':
        return 'lose';
      default:
        return 'idle';
    }
  };

  // Use the provided name or fallback to default player names
  const displayName = name || (isPlayer1 ? 'Player 1' : 'Player 2');

  // Player-specific vertical adjustments
  const playerPositionClass = isPlayer1
    ? 'bottom-28' // Player 1 needs to be positioned lower to match Player 2
    : 'bottom-28'; // Player 2 position

  // Player-specific margin adjustments for the sprite
  const spriteMarginClass = isPlayer1
    ? 'mb-0' // Player 1 needs more margin to push the sprite closer to the nametag
    : 'mb-8'; // Player 2 margin

  return (
    <motion.div
      className={`absolute z-10 ${playerPositionClass} ${
        isPlayer1 ? 'left-[25%]' : 'right-[25%]'
      } transform ${
        isPlayer1 ? '-translate-x-1/2' : 'translate-x-1/2'
      } flex flex-col items-center`}
      initial={{ opacity: 0, y: 20 }}
      animate={{
        opacity: isVisible ? 1 : 0,
        y: 0,
        translateY: jumpHeight ? `-${jumpHeight}px` : '0px',
      }}
      transition={{
        opacity: { duration: 0.3 },
        y: { duration: 0.5 },
        translateY: { duration: 0.2 },
      }}
      data-player-id={playerId}
      data-animation-state={animationState}
      style={{ zIndex: 10 }}
    >
      {/* Player character animation */}
      <div
        className={`flex justify-center ${spriteMarginClass}`}
        style={{ width: '100px', height: '100px' }}
      >
        <SpriteAnimation
          playerNumber={playerNumber}
          animationState={mapAnimationState()}
          width={100}
          height={100}
          className='object-contain'
        />
      </div>

      {/* Name plate below player */}
      <div className='w-32 bg-gray-800/80 rounded-md flex flex-col items-center justify-center py-1 px-2 backdrop-blur-sm'>
        <span
          className={`text-sm font-medium ${
            isPlayer1 ? 'text-blue-300' : 'text-red-300'
          }`}
        >
          {displayName}
        </span>
      </div>
    </motion.div>
  );
}
