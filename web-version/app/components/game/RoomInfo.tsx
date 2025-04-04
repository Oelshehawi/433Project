import { motion } from "framer-motion";

interface RoomInfoProps {
  roomId: string;
  isVisible: boolean;
}

export default function RoomInfo({ roomId, isVisible }: RoomInfoProps) {
  return (
    <motion.div 
      className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/60 px-6 py-2 rounded-full text-white font-semibold z-30"
      initial={{ y: -50, opacity: 0 }}
      animate={isVisible ? { y: 0, opacity: 1 } : { y: -50, opacity: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
    >
      Room: {roomId}
    </motion.div>
  );
} 