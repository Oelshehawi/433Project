import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface JoinRoomFormProps {
  onSubmit: (roomId: string, playerName: string) => void;
  onCancel: () => void;
}

export const JoinRoomForm: React.FC<JoinRoomFormProps> = ({
  onSubmit,
  onCancel,
}) => {
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!roomId.trim()) {
      setError('Room ID is required');
      return;
    }

    if (!playerName.trim()) {
      setError('Player name is required');
      return;
    }

    if (playerName.length > 20) {
      setError('Player name must be 20 characters or less');
      return;
    }

    onSubmit(roomId, playerName);
  };

  // Animation variants
  const backdropVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  };

  const formVariants = {
    initial: { y: 50, opacity: 0 },
    animate: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 30,
      },
    },
    exit: {
      y: 50,
      opacity: 0,
      transition: {
        duration: 0.2,
      },
    },
  };

  const buttonVariants = {
    hover: {
      scale: 1.05,
      transition: {
        type: 'spring',
        stiffness: 400,
        damping: 10,
      },
    },
    tap: { scale: 0.95 },
  };

  return (
    <motion.div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm'
      variants={backdropVariants}
      initial='initial'
      animate='animate'
      exit='exit'
      onClick={onCancel}
    >
      <motion.div
        className='bg-background p-8 rounded-xl shadow-xl w-full max-w-md'
        variants={formVariants}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className='game-title text-2xl font-bold mb-2 text-foreground'>
          Join Room
        </h2>
        <p className='text-foreground/70 mb-6'>
          Enter the room ID to join a game
        </p>

        <form onSubmit={handleSubmit}>
          <div className='mb-6'>
            <label
              htmlFor='roomId'
              className='block text-sm font-medium text-foreground/80 mb-2'
            >
              Room ID
            </label>
            <input
              type='text'
              id='roomId'
              value={roomId}
              onChange={(e) => {
                setRoomId(e.target.value);
                setError('');
              }}
              placeholder='Enter room ID'
              className='w-full px-4 py-3 rounded-lg bg-black/10 border border-primary/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
              autoFocus
            />
          </div>

          <div className='mb-6'>
            <label
              htmlFor='playerName'
              className='block text-sm font-medium text-foreground/80 mb-2'
            >
              Your Name
            </label>
            <input
              type='text'
              id='playerName'
              value={playerName}
              onChange={(e) => {
                setPlayerName(e.target.value);
                setError('');
              }}
              placeholder='Enter your name'
              className='w-full px-4 py-3 rounded-lg bg-black/10 border border-primary/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
            />
            {error && (
              <motion.p
                className='text-danger text-sm mt-2'
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {error}
              </motion.p>
            )}
          </div>

          <div className='flex justify-end space-x-4'>
            <motion.button
              type='button'
              className='px-4 py-2 rounded-lg border border-foreground/20 text-foreground/80 hover:bg-foreground/5'
              onClick={onCancel}
              variants={buttonVariants}
              whileHover='hover'
              whileTap='tap'
            >
              Cancel
            </motion.button>
            <motion.button
              type='submit'
              className='px-6 py-2 rounded-lg bg-primary text-white shadow-md hover:bg-primary-dark'
              variants={buttonVariants}
              whileHover='hover'
              whileTap='tap'
            >
              Join Room
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};
