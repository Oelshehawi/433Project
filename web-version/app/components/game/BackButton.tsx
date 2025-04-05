import { motion } from "framer-motion";
import { useRouter, useParams } from "next/navigation";

interface BackButtonProps {
  isVisible: boolean;
  returnToRoom?: boolean;
}

export default function BackButton({ isVisible, returnToRoom = false }: BackButtonProps) {
  const router = useRouter();
  const params = useParams();
  
  const handleClick = () => {
    if (returnToRoom) {
      // Navigate back to room view
      const roomId = params.id;
      router.push(`/game/${roomId}`);
    } else {
      // Navigate to home
      router.push("/");
    }
  };
  
  return (
    <motion.button
      onClick={handleClick}
      className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-primary hover:bg-primary-dark text-white font-bold py-2 px-6 rounded-lg z-30"
      initial={{ opacity: 0 }}
      animate={isVisible ? { opacity: 1 } : { opacity: 0 }}
      transition={{ delay: 1 }}
    >
      {returnToRoom ? "Back to Room" : "Back to Home"}
    </motion.button>
  );
} 