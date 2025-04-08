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

// Send a message to all clients in a specific room
export function sendToRoom(
  roomId: string,
  event: ServerEventType,
  payload: any
): void {
  try {
    // Add roomId to payload if not present
    const finalPayload = { ...payload, roomId };

    // Create the message
    const message = JSON.stringify({
      event,
      payload: finalPayload,
    });

    // Track if it's a gesture event for logging
    const isGestureEvent = event === "gesture_event";
    if (isGestureEvent) {
      console.log(`Sending gesture event to room ${roomId}:`, finalPayload);
    }

    // Get all clients in the room
    const roomClients = Array.from(clients.values()).filter(
      (client) => client.roomId === roomId
    );

    // Send to all clients in the room
    for (const client of roomClients) {
      if (client.readyState === WebSocket.OPEN) {
        // For beagle_board_command, check if there's a targetPlayerId
        if (event === "beagle_board_command" && finalPayload.targetPlayerId) {
          // Only send to the targeted player
          if (client.playerId === finalPayload.targetPlayerId) {
            client.send(message);
          }
        } else {
          // Send to all clients in the room
          client.send(message);

          // Log gesture events being sent to web clients
          if (isGestureEvent && client.playerType === "webviewer") {
            console.log(
              `Sent gesture event to web client ${client.id} for player ${client.playerId}`
            );
          }
        }
      }
    }

    // Special broadcast for game events to web viewers that might not be in the room
    if (
      event === "gesture_event" ||
      event === "game_state_update" ||
      event === "turn_start" ||
      event === "turn_end"
    ) {
      // Find web viewer clients to make sure they receive updates
      const webViewerClients = Array.from(clients.values()).filter(
        (client) => client.playerType === "webviewer"
      );

      for (const client of webViewerClients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
          console.log(`Broadcast ${event} to web viewer ${client.id}`);
        }
      }
    }
  } catch (error) {
    console.error(`Error sending message to room ${roomId}:`, error);
  }
}

// Send message to all connected clients (unified broadcast function)
export const broadcastToAll = (event: ServerEventType, payload: any) => {
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      sendToClient(client, event, payload);
    }
  });
};
