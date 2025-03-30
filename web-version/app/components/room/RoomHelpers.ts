import { Player } from "../../lib/types";

// Helper function to get saved room info
export const getSavedRoomInfo = () => {
  if (typeof window !== "undefined") {
    return {
      roomId: localStorage.getItem("currentRoomId"),
      playerId: localStorage.getItem("currentPlayerId"),
      playerName: localStorage.getItem("currentPlayerName"),
    };
  }
  return { roomId: null, playerId: null, playerName: null };
};

// Helper to check if the current user is a web viewer
export const isWebViewer = (): boolean => {
  const savedInfo = getSavedRoomInfo();
  return !!(
    savedInfo.playerId?.startsWith("admin-") ||
    savedInfo.playerId?.startsWith("viewer-")
  );
};

// Helper to check if this is a BeagleBoard player
export const isBeagleBoard = (): boolean => {
  const savedInfo = getSavedRoomInfo();
  return !isWebViewer() && !!savedInfo.playerId;
};

// Helper to count BeagleBoard players
export const getBeagleBoardPlayerCount = (players: Player[]): number => {
  return players.filter((p) => p.playerType === "beagleboard").length;
};

// Helper function to get the current player
export const getCurrentPlayer = (players: Player[]): Player | null => {
  const savedInfo = getSavedRoomInfo();
  if (!savedInfo.playerId) return null;

  // For BeagleBoard players, find them in the room player list
  if (!isWebViewer()) {
    return players.find((p) => p.id === savedInfo.playerId) || null;
  }

  // For web viewers, create a virtual player object that's not in the room
  return {
    id: savedInfo.playerId,
    name: savedInfo.playerName || "Web Viewer",
    isReady: false,
    connected: true,
    isViewer: true, // Flag to identify as viewer only
    playerType: "webviewer",
  } as Player;
};
