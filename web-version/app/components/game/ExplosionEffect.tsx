import { useEffect } from 'react';

interface ExplosionEffectProps {
  isVisible: boolean;
  position: 'left' | 'right';
  towerHeight: number;
  onAnimationComplete: () => void;
}

const ExplosionEffect: React.FC<ExplosionEffectProps> = ({
  isVisible,
  position,
  towerHeight,
  onAnimationComplete,
}) => {
  // Constants
  const BLOCK_HEIGHT = 40; // pixels
  const BASE_HEIGHT = 15; // pixels

  // Set timeout to call onAnimationComplete after animation finishes
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onAnimationComplete();
      }, 500); // Match the CSS animation duration

      return () => clearTimeout(timer);
    }
  }, [isVisible, onAnimationComplete]);

  if (!isVisible) return null;

  // Position styles based on left or right
  const positionStyles =
    position === 'left'
      ? {
          bottom: `${towerHeight * BLOCK_HEIGHT + BASE_HEIGHT + 20}px`,
          left: '25%',
          transform: 'translate(-50%, 0)',
        }
      : {
          bottom: `${towerHeight * BLOCK_HEIGHT + BASE_HEIGHT + 20}px`,
          right: '25%',
          transform: 'translate(50%, 0)',
        };

  return (
    <div
      className='absolute z-60'
      style={{
        ...positionStyles,
        width: '150px',
        height: '150px',
        background:
          'radial-gradient(circle, rgba(255,150,100,0.8) 0%, rgba(100,100,100,0.6) 70%, rgba(0,0,0,0) 100%)',
        borderRadius: '50%',
        pointerEvents: 'none',
      }}
    >
      {/* Smaller smoke particles */}
      <div
        className='absolute top-1/4 left-1/4 w-1/2 h-1/2'
        style={{
          background:
            'radial-gradient(circle, rgba(200,200,200,0.9) 0%, rgba(150,150,150,0.5) 70%, rgba(0,0,0,0) 100%)',
          borderRadius: '50%',
          animation: 'expandSmoke 0.5s ease-out forwards',
          transformOrigin: 'center',
        }}
      ></div>
      <div
        className='absolute top-1/3 left-1/3 w-1/3 h-1/3'
        style={{
          background:
            'radial-gradient(circle, rgba(220,220,220,0.9) 0%, rgba(170,170,170,0.5) 70%, rgba(0,0,0,0) 100%)',
          borderRadius: '50%',
          animation: 'expandSmoke 0.4s ease-out forwards',
          transformOrigin: 'center',
        }}
      ></div>
    </div>
  );
};

export default ExplosionEffect;
