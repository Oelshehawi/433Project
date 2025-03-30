import React, { useState } from "react";
import { motion } from "framer-motion";

interface ViewRoomFormProps {
  onSubmit: (roomId: string) => void;
  onCancel: () => void;
}

export const ViewRoomForm: React.FC<ViewRoomFormProps> = ({
  onSubmit,
  onCancel,
}) => {
  const [roomId, setRoomId] = useState("");
  const [errors, setErrors] = useState({ roomId: "" });

  const validateForm = (): boolean => {
    const newErrors = { roomId: "" };
    let isValid = true;

    if (!roomId.trim()) {
      newErrors.roomId = "Room ID is required";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      onSubmit(roomId);
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
        type: "spring",
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
        type: "spring",
        stiffness: 400,
        damping: 10,
      },
    },
    tap: { scale: 0.95 },
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      variants={backdropVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      onClick={onCancel}
    >
      <motion.div
        className="bg-background p-8 rounded-xl shadow-xl w-full max-w-md"
        variants={formVariants}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="game-title text-2xl font-bold mb-6 text-foreground">
          View a Room
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label
              htmlFor="roomId"
              className="block text-sm font-medium text-foreground/80 mb-2"
            >
              Room ID
            </label>
            <input
              type="text"
              id="roomId"
              value={roomId}
              onChange={(e) => {
                setRoomId(e.target.value);
                if (errors.roomId) setErrors({ ...errors, roomId: "" });
              }}
              placeholder="Enter Room ID"
              className="w-full px-4 py-3 rounded-lg bg-black/10 border border-primary/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              autoFocus
            />
            {errors.roomId && (
              <motion.p
                className="text-danger text-sm mt-2"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {errors.roomId}
              </motion.p>
            )}
          </div>

          <div className="flex justify-end space-x-4">
            <motion.button
              type="button"
              className="px-4 py-2 rounded-lg border border-foreground/20 text-foreground/80 hover:bg-foreground/5"
              onClick={onCancel}
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
            >
              Cancel
            </motion.button>
            <motion.button
              type="submit"
              className="px-6 py-2 rounded-lg bg-accent text-white shadow-md hover:bg-accent-dark"
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
            >
              View Room
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};
