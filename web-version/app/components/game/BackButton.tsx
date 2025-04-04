import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

interface BackButtonProps {
  isVisible: boolean;
}

export default function BackButton({ isVisible }: BackButtonProps) {
  const router = useRouter();
  
  return (
    <motion.button
      onClick={() => router.push("/")}
      className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-primary hover:bg-primary-dark text-white font-bold py-2 px-6 rounded-lg z-30"
      initial={{ opacity: 0 }}
      animate={isVisible ? { opacity: 1 } : { opacity: 0 }}
      transition={{ delay: 1 }}
    >
      Back to Home
    </motion.button>
  );
} 