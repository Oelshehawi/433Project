import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useRoomStore } from "../../lib/room/store";

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

    // Reset the room store state to initial values
    useRoomStore.setState({
      currentRoom: null,
      gameStarting: false,
      gameStartTimestamp: null,
      error: null,
    });

    // Navigate to home with query parameter to indicate we're coming from a game
    router.push("/?fromGame=true");
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
