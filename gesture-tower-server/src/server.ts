import WebSocket from 'ws';
import express from 'express';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import { ExtendedWebSocket, WebSocketMessage, ServerEventType } from './types';
import {
  handleCreateRoom,
  handleJoinRoom,
  handleLeaveRoom,
  handlePlayerReady,
  handleRoomList,
  handleGetRoom,
  handleGameStart,
  handleGestureEvent,
  handleRoundEndAck,
  handleGameReady,
  handleNextRoundReady,
  handleRoundStartEvent,
  handleWebClientRoundEnd,
} from './roomManager';
import { clients } from './messaging';
import {
  setupPingHandler,
  setPingTimeout,
  resetPingTimeoutOnMessage,
} from './webSocketManager';

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// HTTP server
const server = createServer(app);

// WebSocket server
const wss = new WebSocket.Server({ server });

// Export server and wss for main.ts
export { server, wss };

// Broadcast to all clients
export const broadcastToAllClients = (message: WebSocketMessage) => {
  const messageStr = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
};

// Handle WebSocket connections
wss.on('connection', (ws: WebSocket) => {
  const clientId = uuidv4();
  console.log(`Client connected: ${clientId}`);

  // Cast to our extended type
  const client = ws as ExtendedWebSocket;
  client.id = clientId;
  client.isAlive = true;

  // Store client in the map
  clients.set(clientId, client);

  // Set up ping handler for this client
  setupPingHandler(client);

  // Initialize ping timeout for this client
  setPingTimeout(client);

  // Handle messages
  client.on('message', (message: WebSocket.Data) => {
    try {
      const data = JSON.parse(message.toString());
      console.log(`Received event: ${data.event}`);

      // Fix payload logging for ping events and add null check
      if (data.event === 'ping') {
        // Add a default empty payload if none exists
        data.payload = data.payload || { timestamp: Date.now() };
        console.log(`Payload for ${data.event}:`, JSON.stringify(data.payload));
      } else {
        console.log(`Payload for ${data.event}:`, JSON.stringify(data.payload));
      }

      // Reset ping timeout when any message is received
      resetPingTimeoutOnMessage(client);

      // Route to appropriate handler based on event type
      switch (data.event) {
        case 'create_room':
          console.log('Processing create_room event');
          handleCreateRoom(client, data.payload);
          break;
        case 'join_room':
          handleJoinRoom(client, data.payload);
          break;
        case 'leave_room':
          handleLeaveRoom(client, data.payload);
          break;
        case 'player_ready':
          handlePlayerReady(client, data.payload);
          break;
        case 'game_start':
          handleGameStart(client, data.payload);
          break;
        case 'gesture_event':
          handleGestureEvent(client, data.payload);
          break;
        case 'room_list':
          handleRoomList(client);
          break;
        case 'get_room':
          handleGetRoom(client, data.payload);
          break;
        case 'round_end_ack':
          handleRoundEndAck(client, data.payload);
          break;
        case 'game_ready':
          handleGameReady(client, data.payload);
          break;
        case 'round_start':
          console.log('Processing round_start event');
          handleRoundStartEvent(client, data.payload);
          break;
        case 'round_end':
          console.log('Processing round_end event from web client');
          handleWebClientRoundEnd(client, data.payload);
          break;
        case 'next_round_ready':
          handleNextRoundReady(client, data.payload);
          break;
        case 'ping':
          // Handle ping explicitly here as well as in setupPingHandler
          client.send(
            JSON.stringify({
              event: 'pong',
              payload: { timestamp: Date.now() },
            })
          );
          break;
        default:
          console.log(`Unknown event type: ${data.event}`);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });
});
