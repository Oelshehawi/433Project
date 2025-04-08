import React from 'react';
import GestureTowerTitle from './GestureTowerTitle';
import RulesScroll from './RulesScroll';

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
        onAnimationComplete={onRulesAnimationComplete}
      />
    </>
  );
};

export default GameAnimation;
