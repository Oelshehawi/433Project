'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { RoomListItem } from '../lib/types/room';

interface RoomListProps {
  rooms: RoomListItem[];
  loading: boolean;
  onCreateClick: () => void;
}

export const RoomList: React.FC<RoomListProps> = ({
  rooms,
  loading,
  onCreateClick,
}) => {
  // Animation variants
  const containerVariants = {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    initial: { y: 20, opacity: 0 },
    animate: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 20,
      },
    },
  };

  const buttonVariants = {
    hover: {
      scale: 1.03,
      transition: {
        type: 'spring',
        stiffness: 400,
        damping: 10,
      },
    },
    tap: { scale: 0.97 },
  };

  return (
    <div className='fixed left-0 bottom-0 w-full p-4 bg-gradient-to-t from-background to-transparent'>
      <div className='max-w-screen-lg mx-auto'>
        {/* Header with Create Room button */}
        <div className='flex items-center justify-between mb-2'>
          <h2 className='text-xl font-bold text-foreground/90'>
            Available Rooms
          </h2>
          <motion.button
            className='px-4 py-2 bg-primary text-white rounded-md shadow-md'
            onClick={onCreateClick}
            variants={buttonVariants}
            whileHover='hover'
            whileTap='tap'
          >
            Create Room
          </motion.button>
        </div>

        {/* Room list */}
        <div className='bg-black/20 backdrop-blur-sm rounded-lg p-2 border border-white/10'>
          {loading ? (
            <p className='text-center py-4 text-foreground/70'>
              Loading rooms...
            </p>
          ) : rooms.length === 0 ? (
            <p className='text-center py-4 text-foreground/70'>
              No rooms available. Create a room to get started!
            </p>
          ) : (
            <motion.div
              className='grid grid-cols-1 md:grid-cols-2 gap-2'
              variants={containerVariants}
              initial='initial'
              animate='animate'
            >
              {rooms.map((room) => (
                <motion.div
                  key={room.id}
                  className='bg-black/30 p-3 rounded-md border border-white/5 flex justify-between items-center'
                  variants={itemVariants}
                >
                  <div>
                    <h3 className='font-medium text-foreground'>{room.name}</h3>
                    <p className='text-sm text-foreground/70'>
                      {room.playerCount}/{room.maxPlayers} players |{' '}
                      {room.status}
                    </p>
                    <p className='text-xs text-foreground/50'>ID: {room.id}</p>
                  </div>
                  <div className='flex items-center'>
                    <span
                      className={`inline-block w-2 h-2 rounded-full mr-2 ${
                        room.playerCount >= room.maxPlayers
                          ? 'bg-red-500'
                          : room.status === 'playing'
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                    ></span>
                    <span className='text-xs text-foreground/70'>
                      {room.playerCount >= room.maxPlayers
                        ? 'Full'
                        : room.status === 'playing'
                        ? 'In Game'
                        : 'Join on Device'}
                    </span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};
