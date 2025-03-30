import React from "react";
import { Player } from "../../lib/types";

interface PlayerListProps {
  players: Player[];
  hostId: string;
}

export const PlayerList: React.FC<PlayerListProps> = ({ players, hostId }) => {
  return (
    <div className="bg-black/40 rounded-md p-4 mb-4">
      <h2 className="text-lg font-semibold mb-2">Players</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {/* Filter to only show BeagleBoard players */}
        {players
          .filter((player) => player.playerType === "beagleboard")
          .map((player) => (
            <div
              key={player.id}
              className="flex items-center justify-between p-3 rounded-md border border-white/10 bg-black/20"
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    player.connected ? "bg-green-500" : "bg-gray-500"
                  }`}
                />
                <span>
                  {player.name}
                  {hostId === player.id && " (Host)"}
                </span>
              </div>
              <div
                className={`px-2 py-1 text-sm rounded ${
                  player.isReady
                    ? "bg-green-800/70 text-green-200"
                    : "bg-gray-700/50 text-gray-300"
                }`}
              >
                {player.isReady ? "Ready" : "Not Ready"}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
