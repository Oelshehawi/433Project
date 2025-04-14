import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';

interface AttackAnimationProps {
  player: 'player1' | 'player2';
  isVisible: boolean;
  onAnimationComplete: (player: 'player1' | 'player2') => void;
  targetTowerHeight: number;
}

const AnimationDebug = {
  log: (player: string, message: string) => {
    console.log(`[Attack-${player}] ${message}`);
  },
};

const AttackAnimation: React.FC<AttackAnimationProps> = ({
  player,
  isVisible,
  onAnimationComplete,
  targetTowerHeight,
}) => {
  // Generate a unique ID for this component instance
  const instanceId = useRef(
    `${player}-${Math.random().toString(36).substring(2, 9)}`
  );

  // Use useState instead of refs for position to ensure proper rendering
  const [position, setPosition] = useState({
    x: player === 'player1' ? 25 : 75,
    y: 0,
  });

  // Track whether this animation instance has completed
  const hasCompletedRef = useRef(false);

  // Keep reference to the animation interval
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Keep reference to completion timeout
  const completionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Track whether animation has started to prevent multiple starts
  const animationStartedRef = useRef(false);

  // Track if component is mounted
  const isMountedRef = useRef(true);

  // Constants for positioning
  const BLOCK_HEIGHT = 40; // pixels
  const BASE_HEIGHT = 15; // pixels

  // Log debug information
  const logDebug = (message: string) => {
    AnimationDebug.log(instanceId.current, message);
  };

  // Cleanup function to ensure proper state on unmount
  const cleanupAnimation = () => {
    if (animationIntervalRef.current) {
      logDebug(`Cleaning up animation interval`);
      clearInterval(animationIntervalRef.current);
      animationIntervalRef.current = null;
    }

    if (completionTimerRef.current) {
      logDebug(`Cleaning up completion timer`);
      clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }
  };

  // Safe completion handler that ensures we only complete once
  const handleAnimationComplete = () => {
    if (!hasCompletedRef.current && isMountedRef.current) {
      logDebug(`Calling onAnimationComplete`);
      hasCompletedRef.current = true;
      // Double-check visibility before calling
      if (isVisible) {
        onAnimationComplete(player);
      }
    }
  };

  // Unmount cleanup
  useEffect(() => {
    return () => {
      logDebug(`Component unmounting, cleaning up resources`);
      isMountedRef.current = false;
      cleanupAnimation();
    };
  }, []);

  // Run animation effect once when component becomes visible
  useEffect(() => {
    // Only run animation if component is visible and we haven't already completed or started
    if (
      !isVisible ||
      hasCompletedRef.current ||
      animationStartedRef.current ||
      !isMountedRef.current
    ) {
      return;
    }

    // Mark as started to prevent duplicate animations
    animationStartedRef.current = true;

    logDebug(`Starting animation (isVisible=${isVisible})`);

    // Starting position
    const startX = player === 'player1' ? 25 : 75;
    const targetX = player === 'player1' ? 75 : 25;

    // Calculate target position
    const targetY = targetTowerHeight * BLOCK_HEIGHT + BASE_HEIGHT + 60 + 64;
    const targetYPercent = (targetY / window.innerHeight) * 100;

    // Set initial position
    setPosition({ x: startX, y: 0 });

    // Time settings
    const duration = 1500; 
    const startTime = Date.now();

    // Clear any existing interval and timers
    cleanupAnimation();

    // Use a single interval for the animation instead of requestAnimationFrame
    // This is more reliable across browsers and simpler to manage
    animationIntervalRef.current = setInterval(() => {
      if (!isMountedRef.current) {
        cleanupAnimation();
        return;
      }

      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Calculate current position
      const x = startX + (targetX - startX) * progress;
      const arcComponent = -4 * progress * (progress - 1) * 100; 
      const linearComponent = progress * targetYPercent; 
      const y = linearComponent + arcComponent;

      // Update position
      setPosition({ x, y });

      // Check if animation is complete
      if (progress >= 1) {
        logDebug(`Animation complete, clearing interval`);
        cleanupAnimation();

        // Call onAnimationComplete after a short delay
        completionTimerRef.current = setTimeout(() => {
          handleAnimationComplete();
        }, 100);
      }
    }, 16); 

    // Set a maximum duration timeout as a fallback
    // This ensures animation always completes even if there are issues
    completionTimerRef.current = setTimeout(() => {
      if (!hasCompletedRef.current) {
        logDebug(`Maximum animation duration reached, forcing completion`);
        cleanupAnimation();
        handleAnimationComplete();
      }
    }, duration + 250); 

    // Cleanup function
    return () => {
      cleanupAnimation();
    };
  }, [isVisible, player, targetTowerHeight, onAnimationComplete]);

  // Reset state if component is hidden
  useEffect(() => {
    if (!isVisible) {
      logDebug(`Component hidden, resetting state`);
      hasCompletedRef.current = false;
      animationStartedRef.current = false;
      cleanupAnimation();

      // Ensure we reset the position when hidden to avoid "stuck" images
      setPosition({ x: player === 'player1' ? 25 : 75, y: 0 });
    }
  }, [isVisible, player]);

  // Return null if not visible - prevents stuck PNGs
  if (!isVisible || !isMountedRef.current) {
    return null;
  }

  return (
    <div
      className='absolute w-8 h-8 z-50'
      style={{
        left: `${position.x}%`,
        bottom: `${position.y}%`,
        pointerEvents: 'none', // Prevent click events on the animation
      }}
      data-instance-id={instanceId.current}
    >
      <Image
        src={`/bomb p${player === 'player1' ? '1' : '2'}.png`}
        alt={`${player} Bomb`}
        width={32}
        height={32}
        className='object-contain'
        priority={true} 
      />
    </div>
  );
};

export default AttackAnimation;
