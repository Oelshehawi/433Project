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

    // Special handling for round_start events
    const isRoundStart = event === "round_start";
    if (isRoundStart) {
      console.log(`\n=========== SENDING ROUND_START EVENT ===========`);
      console.log(`Message size: ${message.length} bytes`);
      console.log(`Round: ${finalPayload.roundNumber}`);
      console.log(`To Room: ${roomId}`);

      // Log player card data
      if (finalPayload.playerCards) {
        console.log(
          `Player cards included for ${
            Object.keys(finalPayload.playerCards).length
          } players:`
        );
        Object.keys(finalPayload.playerCards).forEach((playerId) => {
          console.log(
            `  - Player ${playerId}: ${finalPayload.playerCards[playerId].length} cards`
          );
        });
      } else {
        console.log(`ERROR: No player cards in round_start event!`);
      }
    }

    // Track if it's a gesture event for logging
    const isGestureEvent = event === "gesture_event";
    if (isGestureEvent) {
      console.log(`Sending gesture event to room ${roomId}:`, finalPayload);
    }

    // FIXED APPROACH: First, get all standard clients in the room
    const roomClients = Array.from(clients.values()).filter(
      (client) => client.roomId === roomId
    );

    if (isRoundStart) {
      // Log standard clients
      console.log(`Found ${roomClients.length} clients in room ${roomId}:`);
      roomClients.forEach((client, index) => {
        console.log(
          `  ${index + 1}. Client ID: ${client.id}, Player ID: ${
            client.playerId
          }, Type: ${client.playerType || "unknown"}, WebSocket Ready: ${
            client.readyState === 1 ? "OPEN" : "NOT OPEN"
          }`
        );
      });

      // Directly look for BeagleBoard clients that belong to this room
      console.log(
        `\nDirectly checking beagleBoards map for clients in room ${roomId}:`
      );

      // Get BeagleBoard clients specifically for this room
      const roomBeagleClients = Array.from(beagleBoards.values()).filter(
        (bb) =>
          bb.roomId === roomId &&
          bb.client &&
          bb.client.readyState === WebSocket.OPEN
      );

      console.log(
        `Found ${roomBeagleClients.length} BeagleBoard clients specifically for room ${roomId}`
      );

      roomBeagleClients.forEach((bb, index) => {
        console.log(
          `  ${index + 1}. Device ID: ${bb.deviceId}, Room ID: ${
            bb.roomId
          }, WebSocket Ready: ${
            bb.client?.readyState === 1 ? "OPEN" : "NOT OPEN"
          }`
        );

        // Make sure these clients are in our roomClients array
        if (!roomClients.some((client) => client.id === bb.client?.id)) {
          if (bb.client) {
            console.log(
              `  Adding missing BeagleBoard client to roomClients for sending`
            );
            roomClients.push(bb.client);
          }
        }
      });
    }

    // Send to all clients in the room
    let sentCount = 0;
    for (const client of roomClients) {
      if (client.readyState === WebSocket.OPEN) {
        // For beagle_board_command, check if there's a targetPlayerId
        if (event === "beagle_board_command" && finalPayload.targetPlayerId) {
          // Only send to the targeted player
          if (client.playerId === finalPayload.targetPlayerId) {
            client.send(message);
            sentCount++;
          }
        } else {
          // Send to all clients in the room
          client.send(message);
          sentCount++;

          // Log successful sends for round_start
          if (isRoundStart) {
            console.log(
              `✓ Sent round_start to client ${client.id} (${
                client.playerId || "unknown"
              })`
            );
          }

          // Log gesture events being sent to web clients
          if (isGestureEvent && client.playerType === "webviewer") {
            console.log(
              `Sent gesture event to web client ${client.id} for player ${client.playerId}`
            );
          }
        }
      } else if (isRoundStart) {
        console.log(
          `✗ Could not send to client ${client.id} - WebSocket not open (ready state: ${client.readyState})`
        );
      }
    }

    // For round_start events, do an additional direct check to ensure BeagleBoard clients get their messages
    if (isRoundStart) {
      // Direct check for BeagleBoard clients
      console.log(
        `\nDouble checking BeagleBoard map for clients we need to send to:`
      );
      let extraSentCount = 0;

      beagleBoards.forEach((bb, id) => {
        if (
          bb.roomId === roomId &&
          bb.client &&
          bb.client.readyState === WebSocket.OPEN
        ) {
          // Check if we already sent to this client
          const alreadySent = roomClients.some(
            (client) => client.id === bb.client?.id
          );

          if (!alreadySent) {
            console.log(
              `  Sending directly to BeagleBoard ${bb.deviceId} that was missed in room clients`
            );
            bb.client.send(message);
            extraSentCount++;
          }
        }
      });

      if (extraSentCount > 0) {
        console.log(
          `  Sent to ${extraSentCount} additional BeagleBoard clients directly`
        );
        sentCount += extraSentCount;
      }

      console.log(
        `\nFinal round_start event sent to ${sentCount} total clients for room ${roomId}`
      );
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
