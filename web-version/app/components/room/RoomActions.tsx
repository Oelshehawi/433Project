import React from "react";
import { motion } from "framer-motion";
import { Player } from "../../lib/types";

interface RoomActionsProps {
  isWebViewer: boolean;
  isHost: boolean;
  currentPlayer: Player | null;
  beagleBoardPlayerCount: number;
  maxPlayers: number;
  roomId: string;
  status: string;
  allPlayersReady: boolean;
  onToggleReady: () => void;
}

export const RoomActions: React.FC<RoomActionsProps> = ({
  isWebViewer,
  isHost,
  currentPlayer,
  beagleBoardPlayerCount,
  maxPlayers,
  roomId,
  status,
  allPlayersReady,
  onToggleReady,
}) => {
  return (
    <div className="flex flex-col space-y-3">
      {/* Current player actions */}
      <div className="flex space-x-3">
        {/* Only show Ready button for BeagleBoard players (not for web viewer) */}
        {!isWebViewer && (
          <button
            className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-lg"
            onClick={onToggleReady}
          >
            {currentPlayer?.isReady ? "Not Ready" : "Ready Up"}
          </button>
        )}
      </div>

      {/* Status message */}
      {allPlayersReady && beagleBoardPlayerCount > 0 && (
        <div className="bg-success/20 text-success p-3 rounded-md mt-1 text-center">
          All players ready! Game will start shortly with a countdown.
        </div>
      )}

      {/* If web viewer, show explanatory text */}
      {isWebViewer && (
        <p className="text-sm text-white/70 italic mt-2">
          You are viewing as a web client. Only BeagleBoard players appear in
          the player list.
        </p>
      )}

      {/* Room info */}
      <div className="mt-6 text-sm text-white/70">
        <p>Room ID: {roomId}</p>
        <p>Status: {status}</p>
        <p>
          Players: {beagleBoardPlayerCount}/{maxPlayers}
        </p>
      </div>
    </div>
  );
};
