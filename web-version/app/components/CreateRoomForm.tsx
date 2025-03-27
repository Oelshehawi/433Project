import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface CreateRoomFormProps {
  onSubmit: (roomName: string) => void;
  onCancel: () => void;
}

export const CreateRoomForm: React.FC<CreateRoomFormProps> = ({
  onSubmit,
  onCancel,
}) => {
  const [roomName, setRoomName] = useState('');
  const [errors, setErrors] = useState({ roomName: '' });

  const validateForm = (): boolean => {
    const newErrors = { roomName: '' };
    let isValid = true;

    if (!roomName.trim()) {
      newErrors.roomName = 'Room name is required';
      isValid = false;
    } else if (roomName.length > 20) {
      newErrors.roomName = 'Room name must be 20 characters or less';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      onSubmit(roomName);
    }
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
        <h2 className='game-title text-2xl font-bold mb-6 text-foreground'>
          Create a New Room
        </h2>

        <form onSubmit={handleSubmit}>
          <div className='mb-6'>
            <label
              htmlFor='roomName'
              className='block text-sm font-medium text-foreground/80 mb-2'
            >
              Room Name
            </label>
            <input
              type='text'
              id='roomName'
              value={roomName}
              onChange={(e) => {
                setRoomName(e.target.value);
                if (errors.roomName) setErrors({ ...errors, roomName: '' });
              }}
              placeholder='Enter room name'
              className='w-full px-4 py-3 rounded-lg bg-black/10 border border-primary/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
              autoFocus
            />
            {errors.roomName && (
              <motion.p
                className='text-danger text-sm mt-2'
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {errors.roomName}
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
              Create Room
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};
