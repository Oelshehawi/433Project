import React, { useEffect } from 'react';

interface ShieldEffectProps {
  isActive: boolean;
  position: 'left' | 'right';
  towerHeight: number;
  glowIntensity?: number;
}

const ShieldEffect = ({
  isActive,
  position,
  towerHeight,
  glowIntensity = 0,
}: ShieldEffectProps) => {
  // Add a useEffect for handling CSS animations
  useEffect(() => {
    if (isActive) {
      // Add shield pulse animation to stylesheet if not exists
      if (!document.getElementById('shield-animation-styles')) {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'shield-animation-styles';
        styleSheet.textContent = `
          @keyframes shieldPulse {
            0% { transform: scale(1); opacity: 0.8; }
            50% { transform: scale(1.1); opacity: 1; }
            100% { transform: scale(1); opacity: 0.8; }
          }
          @keyframes shieldReact {
            0% { transform: scale(1); }
            25% { transform: scale(1.2); }
            50% { transform: scale(0.9); }
            75% { transform: scale(1.1); }
            100% { transform: scale(1); }
          }
        `;
        document.head.appendChild(styleSheet);
      }
    }
  }, [isActive]);

  if (!isActive) return null;

  // Constants for positioning
  const BLOCK_HEIGHT = 40; 
  const BASE_HEIGHT = 15; 

  // Position styles based on left or right
  const positionStyles =
    position === 'left'
      ? {
          bottom: `${towerHeight * BLOCK_HEIGHT + BASE_HEIGHT + 20 + 64}px`,
          left: '25%',
          transform: 'translate(-50%, 0)',
        }
      : {
          bottom: `${towerHeight * BLOCK_HEIGHT + BASE_HEIGHT + 20 + 64}px`,
          right: '25%',
          transform: 'translate(50%, 0)',
        };

  return (
    <div
      className='absolute z-40'
      style={{
        ...positionStyles,
        width: '160px',
        height: '160px',
        // Thicker edges with slight opacity in center
        background: `radial-gradient(circle, rgba(186,104,255,${
          0.15 + glowIntensity * 0.1
        }) 20%, rgba(186,104,255,${
          0.25 + glowIntensity * 0.3
        }) 60%, rgba(186,104,255,${
          0.6 + glowIntensity * 0.4
        }) 85%, rgba(186,104,255,${0.2 + glowIntensity * 0.3}) 100%)`,
        borderRadius: '50%',
        pointerEvents: 'none',
        boxShadow: `0 0 ${20 + glowIntensity * 40}px rgba(186,104,255,${
          0.6 + glowIntensity * 0.4
        })`,
        transition: 'box-shadow 0.1s ease-out, background 0.1s ease-out',
        // Thicker border that intensifies with proximity
        border: `${2 + glowIntensity * 4}px solid rgba(186,104,255,${
          0.7 + glowIntensity * 0.3
        })`,
        animation: 'shieldPulse 2s ease-in-out infinite',
      }}
    >
      {/* Pulsing effect inner circle - slightly visible in center */}
      <div
        className='absolute inset-0'
        style={{
          background: `radial-gradient(circle, rgba(186,104,255,${
            0.1 + glowIntensity * 0.1
          }) 30%, rgba(186,104,255,${
            0.2 + glowIntensity * 0.2
          }) 65%, rgba(186,104,255,${
            0.3 + glowIntensity * 0.3
          }) 85%, rgba(186,104,255,${0.1 + glowIntensity * 0.2}) 100%)`,
          borderRadius: '50%',
          animation:
            glowIntensity > 0.5
              ? 'shieldReact 0.5s ease-out infinite'
              : 'shieldPulse 2s ease-in-out infinite',
        }}
      ></div>
    </div>
  );
};

export default ShieldEffect;
