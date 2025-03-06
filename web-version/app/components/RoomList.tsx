'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { RoomListItem } from '../lib/room/types';

interface RoomListProps {
  rooms: RoomListItem[];
  loading: boolean;
  onJoinClick: (roomId: string) => void;
  onCreateClick: () => void;
}

export const RoomList: React.FC<RoomListProps> = ({
  rooms,
  loading,
  onJoinClick,
  onCreateClick,
}) => {
  // Animation variants for the floating list
  const floatingVariants = {
    initial: { opacity: 0, y: 10 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: 'easeOut',
      },
    },
  };

  // Room item animation variants
  const itemVariants = {
    initial: { opacity: 0, x: -5 },
    animate: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.3,
      },
    },
    hover: {
      scale: 1.02,
      backgroundColor: 'rgba(124, 58, 237, 0.15)',
      transition: {
        duration: 0.2,
      },
    },
  };

  return (
    <motion.div
      className='fixed left-4 md:left-8 top-1/2 transform -translate-y-1/2 w-64 md:w-72 bg-black/60 backdrop-blur-md rounded-lg p-4 shadow-lg border border-primary/30'
      variants={floatingVariants}
      initial='initial'
      animate='animate'
    >
      <h2 className='text-xl text-white font-bold mb-4 flex items-center justify-between'>
        Available Rooms
        {loading && (
          <svg
            className='animate-spin h-4 w-4 text-white ml-2'
            xmlns='http://www.w3.org/2000/svg'
            fill='none'
            viewBox='0 0 24 24'
          >
            <circle
              className='opacity-25'
              cx='12'
              cy='12'
              r='10'
              stroke='currentColor'
              strokeWidth='4'
            ></circle>
            <path
              className='opacity-75'
              fill='currentColor'
              d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
            ></path>
          </svg>
        )}
      </h2>

      <div className='custom-scrollbar max-h-96 overflow-y-auto pr-2 -mr-2'>
        {loading ? (
          <p className='text-gray-300 text-sm text-center py-4'>
            Loading rooms...
          </p>
        ) : rooms.length > 0 ? (
          <ul className='space-y-2'>
            {rooms.map((room) => (
              <motion.li
                key={room.id}
                className='bg-black/40 rounded-md p-3 cursor-pointer border border-primary/20'
                onClick={() => onJoinClick(room.id)}
                variants={itemVariants}
                initial='initial'
                animate='animate'
                whileHover='hover'
              >
                <div className='flex items-center justify-between'>
                  <span className='text-white font-medium truncate max-w-[70%]'>
                    {room.name}
                  </span>
                  <span className='text-xs px-2 py-1 rounded-full bg-accent/80 text-white'>
                    {room.playerCount}/{room.maxPlayers}
                  </span>
                </div>
                <div className='mt-1 flex items-center'>
                  <span
                    className={`w-2 h-2 rounded-full mr-2 ${
                      room.status === 'waiting'
                        ? 'bg-green-500'
                        : 'bg-yellow-500'
                    }`}
                  ></span>
                  <span className='text-xs text-gray-300 capitalize'>
                    {room.status}
                  </span>
                </div>
              </motion.li>
            ))}
          </ul>
        ) : (
          <div className='text-center py-4'>
            <p className='text-gray-300 text-sm mb-3'>No rooms available</p>
            <button
              className='bg-primary hover:bg-primary-dark text-white text-sm font-medium py-2 px-4 rounded-md'
              onClick={onCreateClick}
            >
              Create a Room
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};
