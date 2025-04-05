import { motion } from "framer-motion";
import { useRouter, useParams } from "next/navigation";

interface BackButtonProps {
  isVisible: boolean;
  returnToRoom?: boolean;
}

export default function BackButton({
  isVisible,
  returnToRoom = false,
}: BackButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    // Clear localStorage data before going back to home
    if (typeof window !== "undefined") {
      localStorage.removeItem("currentRoomId");
      localStorage.removeItem("currentPlayerId");
      localStorage.removeItem("currentPlayerName");
      console.log("Cleared room data from localStorage");
    }

    // Always navigate to home
    router.push("/");
  };

  return (
    <motion.button
      onClick={handleClick}
      className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-primary hover:bg-primary-dark text-white font-bold py-2 px-6 rounded-lg z-30"
      initial={{ opacity: 0 }}
      animate={isVisible ? { opacity: 1 } : { opacity: 0 }}
      transition={{ delay: 1 }}
    >
      Back to Home
    </motion.button>
  );
}
