import { motion } from "framer-motion";

interface TowerControlsProps {
  onAdd: () => void;
  onRemove: () => void;
  blockCount: number;
  playerSide: 'left' | 'right';
  isVisible: boolean;
}

export default function TowerControls({
  onAdd,
  onRemove,
  blockCount,
  playerSide,
  isVisible
}: TowerControlsProps) {
  if (!isVisible) return null;

  return (
    <motion.div 
      className={`absolute top-24 ${playerSide === 'left' ? 'left-12' : 'right-12'} z-40`}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7 }}
    >
      <div className="bg-gray-800 p-2 rounded-lg shadow-lg">
        <div className="flex flex-col space-y-2">
          <div className="flex items-center justify-between bg-gray-700 px-3 py-1 rounded-md">
            <span className="text-white font-medium mr-3">Tower</span>
            <div className="text-white bg-gray-900 px-2 py-0.5 rounded-md font-bold min-w-[28px] text-center">
              {blockCount}
            </div>
          </div>
          
          <div className="flex justify-between space-x-2">
            {/* Add Block Button */}
            <motion.button
              className="bg-green-600 hover:bg-green-500 text-white p-2 rounded-md flex items-center justify-center"
              onClick={onAdd}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.05 }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </motion.button>
            
            {/* Remove Block Button */}
            <motion.button
              className={`${blockCount > 0 ? 'bg-red-600 hover:bg-red-500' : 'bg-red-900 cursor-not-allowed'} text-white p-2 rounded-md flex items-center justify-center`}
              onClick={onRemove}
              whileTap={blockCount > 0 ? { scale: 0.95 } : {}}
              whileHover={blockCount > 0 ? { scale: 1.05 } : {}}
              disabled={blockCount === 0}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
} 