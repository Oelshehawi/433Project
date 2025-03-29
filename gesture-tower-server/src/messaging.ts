import WebSocket from "ws";
import {
  ExtendedWebSocket,
  WebSocketMessage,
  ServerEventType,
  BeagleBoardsMap,
} from "./types";

// Store client connections with custom properties
export const clients: Map<string, ExtendedWebSocket> = new Map();

// Store connected beagle boards with their device IDs
export const beagleBoards: BeagleBoardsMap = new Map();

// Send message to a specific client
export const sendToClient = (
  client: ExtendedWebSocket,
  event: ServerEventType,
  payload: any
) => {
  if (client.readyState === WebSocket.OPEN) {
    const message: WebSocketMessage = { event, payload };
    client.send(JSON.stringify(message));
  }
};

// Send message to all clients in a room
export const sendToRoom = (
  roomId: string,
  event: ServerEventType,
  payload: any
) => {
  clients.forEach((client) => {
    if (client.roomId === roomId && client.readyState === WebSocket.OPEN) {
      sendToClient(client, event, payload);
    }
  });
};

// Send message to all connected clients (unified broadcast function)
export const broadcastToAll = (event: ServerEventType, payload: any) => {
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      sendToClient(client, event, payload);
    }
  });
};
