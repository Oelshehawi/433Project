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

    // Special debugging for round_start events
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

    // Get all clients in the room
    const roomClients = Array.from(clients.values()).filter(
      (client) => client.roomId === roomId
    );

    // Log the clients for round_start events
    if (isRoundStart) {
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

      // Debug: check all clients to see if BeagleBoard clients might be missing from room
      console.log(
        `\nDEBUG: Checking ALL ${clients.size} connected clients for any BeagleBoard clients:`
      );
      let beagleBoardCount = 0;
      Array.from(clients.values()).forEach((client) => {
        const isBeagleBoard = client.playerId?.startsWith("bb_") || false;
        const inThisRoom = client.roomId === roomId;
        if (isBeagleBoard) {
          console.log(
            `  - BeagleBoard client found: ${
              client.playerId
            }, In room ${roomId}: ${inThisRoom}, Room ID: ${
              client.roomId || "none"
            }`
          );
          beagleBoardCount++;
        }
      });

      if (beagleBoardCount === 0) {
        console.log(
          `  WARNING: No BeagleBoard clients found among ALL connections!`
        );
      }
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

    // Log summary for round_start
    if (isRoundStart) {
      console.log(
        `Round start event sent to ${sentCount}/${roomClients.length} clients in room ${roomId}`
      );

      // Direct check for BeagleBoard clients
      const bbClients = Array.from(beagleBoards.values());
      console.log(`BeagleBoard map contains ${bbClients.length} clients`);
      bbClients.forEach((bb) => {
        console.log(
          `  - BB: ${bb.deviceId}, Room: ${bb.roomId || "none"}, Match: ${
            bb.roomId === roomId
          }`
        );

        // Try to find this client in the clients map
        let found = false;
        clients.forEach((client) => {
          if (client.playerId === bb.deviceId) {
            found = true;
            console.log(`    ✓ Found matching client with ID ${client.id}`);
          }
        });

        if (!found) {
          console.log(`    ✗ NO MATCHING CLIENT FOUND IN CLIENTS MAP!`);
        }
      });

      console.log(`=========== END OF ROUND_START SENDING ===========\n`);
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
