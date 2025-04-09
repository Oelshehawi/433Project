import { useEffect, useState } from 'react';
import Image from 'next/image';

interface AttackAnimationProps {
  player: 'player1' | 'player2';
  isVisible: boolean;
  onAnimationComplete: (player: 'player1' | 'player2') => void;
  targetTowerHeight: number;
}

const AttackAnimation: React.FC<AttackAnimationProps> = ({
  player,
  isVisible,
  onAnimationComplete,
  targetTowerHeight,
}) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Constants
  const BLOCK_HEIGHT = 40; // pixels
  const BASE_HEIGHT = 15; // pixels
  const PLAYER_HEIGHT_OFFSET = 100; // Higher starting point for the projectile

  useEffect(() => {
    if (!isVisible) return;

    // Starting position
    const startX = player === 'player1' ? 25 : 75;
    const targetX = player === 'player1' ? 75 : 25;

    // Calculate position to target middle of player
    const targetY = targetTowerHeight * BLOCK_HEIGHT + BASE_HEIGHT + 60; // 60px additional offset for player height
    const targetYPercent = (targetY / window.innerHeight) * 100;

    setPosition({ x: startX, y: 0 });

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

      setPosition({ x, y });

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Animation is complete
        setTimeout(() => {
          onAnimationComplete(player);
        }, 100); // Brief pause at target for visual effect
      }
    };

    requestAnimationFrame(animate);
  }, [isVisible, player, targetTowerHeight, onAnimationComplete]);

  if (!isVisible) return null;

  return (
    <div
      className='absolute w-8 h-8 z-50'
      style={{
        left: `${position.x}%`,
        bottom: `${position.y}%`,
      }}
    >
      <Image
        src={`/bomb p${player === 'player1' ? '1' : '2'}.png`}
        alt={`${player} Bomb`}
        width={32}
        height={32}
        className='object-contain'
      />
    </div>
  );
};

export default AttackAnimation;
