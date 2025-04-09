import React, { useEffect, useCallback } from 'react';
import GestureTowerTitle from './GestureTowerTitle';
import RulesScroll from './RulesScroll';
import { useSoundManager } from '../../lib/utils/SoundManager';

interface GameAnimationProps {
  showTitleAnimation: boolean;
  showRulesAnimation: boolean;
  onTitleAnimationComplete: () => void;
  onRulesAnimationComplete: () => void;
}

const GameAnimation: React.FC<GameAnimationProps> = ({
  showTitleAnimation,
  showRulesAnimation,
  onTitleAnimationComplete,
  onRulesAnimationComplete,
}) => {
  const { playBackgroundMusic, stopBackgroundMusic } = useSoundManager();

  // Handle rules animation complete
  const handleRulesAnimationComplete = useCallback(() => {
    // Play background music once rules animation completes
    playBackgroundMusic();
    // Call the original completion handler
    onRulesAnimationComplete();
  }, [playBackgroundMusic, onRulesAnimationComplete]);

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      stopBackgroundMusic();
    };
  }, [stopBackgroundMusic]);

  return (
    <>
      {/* Title Animation */}
      <GestureTowerTitle
        isVisible={showTitleAnimation}
        onAnimationComplete={onTitleAnimationComplete}
      />

      {/* Rules Animation */}
      <RulesScroll
        isVisible={showRulesAnimation}
        onAnimationComplete={handleRulesAnimationComplete}
      />
    </>
  );
};

export default GameAnimation;
