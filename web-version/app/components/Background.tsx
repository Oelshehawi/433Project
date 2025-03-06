'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export const Background = () => {
  const [particles, setParticles] = useState<
    {
      width: number;
      height: number;
      left: string;
      top: string;
      xMove: number;
      yMove: number;
      rotation: number;
      duration: number;
    }[]
  >([]);

  // Generate particles on client-side only (fixes hydration issue)
  useEffect(() => {
    const generatedParticles = Array.from({ length: 10 }).map(() => ({
      width: Math.random() * 80 + 20,
      height: Math.random() * 80 + 20,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      xMove: Math.random() * 100 - 50,
      yMove: Math.random() * 100 - 50,
      rotation: Math.random() * 180 - 90,
      duration: Math.random() * 10 + 10,
    }));
    setParticles(generatedParticles);
  }, []);

  // Background elements animation variants
  const backgroundVariants = {
    animate: {
      backgroundPosition: ['0% 0%', '100% 100%'],
      transition: {
        duration: 20,
        ease: 'linear',
        repeat: Infinity,
        repeatType: 'reverse' as const,
      },
    },
  };

  return (
    <div className='fixed inset-0 overflow-hidden'>
      {/* Animated background gradient */}
      <motion.div
        className='absolute inset-0 bg-gradient-to-br from-primary/30 via-secondary/30 to-accent/30'
        variants={backgroundVariants}
        animate='animate'
      />

      {/* Animated particles */}
      {particles.map((particle, index) => (
        <motion.div
          key={index}
          className='absolute rounded-full bg-white opacity-10'
          style={{
            width: particle.width,
            height: particle.height,
            left: particle.left,
            top: particle.top,
          }}
          animate={{
            x: particle.xMove,
            y: particle.yMove,
            rotate: particle.rotation,
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
};
