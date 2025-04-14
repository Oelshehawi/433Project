// Single source of truth for WebSocket connection
let socket: WebSocket | null = null;
let socketStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
let pingInterval: NodeJS.Timeout | null = null; // Track ping interval
let lastPongTime: number = 0; // Track last pong received
let connectionTimeout: NodeJS.Timeout | null = null; // Connection timeout handler

// Initialize WebSocket connection
export const initializeSocket = (
  url: string = 'wss://four33project.onrender.com'
): WebSocket | null => {
  console.log(
    '[websocket.ts] Initializing WebSocket, current status:',
    socketStatus
  );

  // If we have an existing healthy connection, use it
  if (isSocketHealthy()) {
    console.log('[websocket.ts] Using existing healthy socket connection');
    // Dispatch connected event to ensure components update correctly after navigation
    setTimeout(() => {
      if (isSocketHealthy()) {
        window.dispatchEvent(new CustomEvent('ws_connected'));
      }
    }, 50);
    return socket;
  }

  // If we have a socket that is in CONNECTING state, wait for it
  if (socket && socket.readyState === WebSocket.CONNECTING) {
    console.log(
      '[websocket.ts] Socket already connecting, waiting for completion'
    );
    return socket;
  }

  // Set status to connecting
  socketStatus = 'connecting';
  console.log('[websocket.ts] Setting socket status to CONNECTING');

  // Clear any existing timeout
  if (connectionTimeout) {
    clearTimeout(connectionTimeout);
    connectionTimeout = null;
  }

  // Set connection timeout (10 seconds)
  connectionTimeout = setTimeout(() => {
    if (socketStatus === 'connecting') {
      console.error('[websocket.ts] Connection timeout after 10 seconds');

      // If socket exists but is still in CONNECTING state, close it
      if (socket && socket.readyState === WebSocket.CONNECTING) {
        console.log('[websocket.ts] Forcing close of stalled connection');
        socket.close();
      }

      socket = null;
      socketStatus = 'disconnected';

      // Dispatch connection failure event
      window.dispatchEvent(
        new CustomEvent('ws_connection_failed', {
          detail: { reason: 'timeout' },
        })
      );
    }
  }, 10000);

  try {
    console.log('[websocket.ts] Creating new WebSocket connection to', url);

    // Create WebSocket connection
    socket = new WebSocket(url);

    // Handle connection open
    socket.onopen = () => {
      console.log('[websocket.ts] WebSocket connection established');

      // Clear connection timeout
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }

      socketStatus = 'connected';
      lastPongTime = Date.now(); // Initialize pong time

      // Start ping interval to keep connection alive
      startPingInterval();

      // Dispatch a custom event that components can listen for
      window.dispatchEvent(new CustomEvent('ws_connected'));

      // If we have saved room info, immediately request room data
      const savedInfo = getSavedRoomInfo();
      if (savedInfo.roomId) {
        console.log(
          '[websocket.ts] Found saved room info, requesting room data:',
          savedInfo.roomId
        );
        sendMessage('get_room', { roomId: savedInfo.roomId }).catch((err) => {
          console.error('[websocket.ts] Error requesting room data:', err);
        });
      }
    };

    socket.onclose = (event) => {
      console.log(
        `[websocket.ts] WebSocket connection closed: Code ${event.code}${
          event.reason ? ' - ' + event.reason : ''
        }`
      );

      // Clear connection timeout if it exists
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }

      socket = null;
      socketStatus = 'disconnected';
      stopPingInterval();

      // Dispatch connection closed event
      window.dispatchEvent(
        new CustomEvent('ws_connection_closed', {
          detail: { code: event.code, reason: event.reason },
        })
      );

      // Auto reconnect if it wasn't intentionally closed
      if (event.code !== 1000) {
        console.log('[websocket.ts] Attempting to reconnect in 2 seconds...');
        setTimeout(() => initializeSocket(url), 2000);
      }
    };

    socket.onerror = (error) => {
      console.error('[websocket.ts] WebSocket connection error:', error);
      socketStatus = 'disconnected';

      // Dispatch connection error event
      window.dispatchEvent(
        new CustomEvent('ws_connection_error', {
          detail: { error },
        })
      );
    };

    socket.onmessage = (event) => {
      try {
        // Check if event.data exists
        if (!event || !event.data) {
          console.error(
            '[websocket.ts] Received empty or invalid WebSocket message'
          );
          return;
        }

        // Safely parse the data
        let data;
        try {
          data = JSON.parse(event.data);
        } catch (parseError) {
          console.error(
            '[websocket.ts] Error parsing WebSocket message:',
            parseError,
            event.data
          );
          return;
        }

        // Validate data structure
        if (!data || typeof data !== 'object') {
          console.error(
            '[websocket.ts] Received invalid data structure:',
            event.data
          );
          return;
        }

        // Handle pong messages separately
        if (data.event === 'pong') {
          lastPongTime = Date.now();
          return;
        }

        // Log the message safely
        console.log(
          '[websocket.ts] WebSocket message received:',
          data
            ? typeof data === 'object'
              ? JSON.stringify(data)
              : data
            : 'undefined data'
        );

        // Safely check event type and log appropriately
        const eventType = data.event || 'unknown';
        const payload = data.payload || {};

        // Special handling for game_starting to make it more visible in logs
        if (eventType === 'game_starting') {
          console.log(
            '[websocket.ts] GAME STARTING EVENT RECEIVED:',
            payload
          );
        }

        // Special tracking for round events
        if (eventType === 'round_start') {
          console.log(
            '[websocket.ts] ROUND START EVENT RECEIVED:',
            payload
          );
        }

        if (eventType === 'round_end') {
          console.log(
            '[websocket.ts] ROUND END EVENT RECEIVED:',
            payload
          );
        }

        // Create a simple custom event with the data - with safe fallbacks
        try {
          const customEvent = new CustomEvent(eventType, {
            detail: payload,
            bubbles: true,
          });

          // Dispatch a single event - all components can listen for specific event types
          window.dispatchEvent(customEvent);
        } catch (eventError) {
          console.error(
            '[websocket.ts] Error creating or dispatching event:',
            eventError,
            {
              event: eventType,
              payload: payload,
            }
          );
        }
      } catch (error) {
        console.error(
          '[websocket.ts] Error processing WebSocket message:',
          error,
          event ? event.data || 'No data' : 'Invalid event'
        );
      }
    };

    return socket;
  } catch (error) {
    console.error('[websocket.ts] Failed to initialize WebSocket:', error);

    // Clear connection timeout
    if (connectionTimeout) {
      clearTimeout(connectionTimeout);
      connectionTimeout = null;
    }

    socketStatus = 'disconnected';
    socket = null;

    // Dispatch connection error event
    window.dispatchEvent(
      new CustomEvent('ws_connection_error', {
        detail: { error },
      })
    );

    return null;
  }
};

// Start regular ping interval to keep connection alive
const startPingInterval = () => {
  // Clear any existing interval first
  stopPingInterval();

  // Send ping every 15 seconds instead of 30 to prevent server timeouts
  pingInterval = setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      console.log('[websocket.ts] Sending ping to server');
      sendMessage('ping', { timestamp: Date.now() }).catch((err) => {
        console.error('[websocket.ts] Error sending ping:', err);
      });

      // Check if we've received a pong in the last 30 seconds (reduced from 45)
      const now = Date.now();
      if (now - lastPongTime > 30000) {
        console.warn(
          '[websocket.ts] No pong received in 30 seconds, reconnecting'
        );
        closeSocket();
        initializeSocket();
      }
    } else if (socketStatus === 'connected') {
      // If socket is not open but status says connected, reconnect
      console.warn('[websocket.ts] Socket not open during ping, reconnecting');
      closeSocket();
      initializeSocket();
    }
  }, 15000); // Reduced from 30000 to 15000
};

// Stop ping interval
const stopPingInterval = () => {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
};

// Function to clear room data from localStorage
export const clearRoomData = (): void => {
  localStorage.removeItem('currentRoomId');
  localStorage.removeItem('currentPlayerId');
  localStorage.removeItem('currentPlayerName');
  console.log('[websocket.ts] Cleared room data from localStorage');
};

// Get saved room info from localStorage
export const getSavedRoomInfo = () => {
  if (typeof window === 'undefined')
    return { roomId: null, playerId: null, playerName: null };
  return {
    roomId: localStorage.getItem('currentRoomId'),
    playerId: localStorage.getItem('currentPlayerId'),
    playerName: localStorage.getItem('currentPlayerName'),
  };
};

// Save room info to localStorage
export const saveRoomInfo = (
  roomId: string,
  playerId: string,
  playerName: string
): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('currentRoomId', roomId);
  localStorage.setItem('currentPlayerId', playerId);
  localStorage.setItem('currentPlayerName', playerName);
  console.log('Saved room info to localStorage:', {
    roomId,
    playerId,
    playerName,
  });
};

// Simple send message function
export const sendMessage = <T>(type: string, payload: T): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Initialize if needed
    if (!socket) {
      console.log(
        '[websocket.ts] Initializing socket for sendMessage:',
        type
      );
      socket = initializeSocket();
    }

    if (!socket) {
      const error = new Error('Could not initialize WebSocket connection');
      console.error(
        '[websocket.ts] Socket initialization failed:',
        error.message
      );
      reject(error);
      return;
    }

    if (socket.readyState !== WebSocket.OPEN) {
      const state = getReadyStateLabel(socket.readyState);
      const error = new Error(`WebSocket not ready (${state})`);
      console.error('[websocket.ts] Socket not ready:', error.message);
      reject(error);
      return;
    }

    try {
      const message = { event: type, payload };

      if (message.event !== 'ping' && message.event !== 'pong') {
        console.log('[websocket.ts] Sending WebSocket message:', message);
      }

      socket.send(JSON.stringify(message));

      // Confirm sent for important messages
      if (type === 'next_round_ready' || type === 'game_ready') {
        console.log('[websocket.ts] Successfully sent', type);
      }

      resolve();
    } catch (error) {
      console.error('[websocket.ts] Error sending message:', error);
      reject(error);
    }
  });
};

// A simplified version of sendMessage that doesn't return a Promise
export const sendWebSocketMessage = (message: {
  event: string;
  payload: Record<string, unknown>;
}): void => {
  try {
    sendMessage(message.event, message.payload).catch((error) => {
      console.error('Error sending WebSocket message:', error);
    });
  } catch (error) {
    console.error('Error in sendWebSocketMessage:', error);
  }
};

// Get WebSocket connection status
export const getSocketStatus = () => socketStatus;

// Close WebSocket connection
export const closeSocket = (): void => {
  if (socket) {
    console.log('[websocket.ts] Closing WebSocket connection');
    stopPingInterval();
    socket.close();
    socket = null;
  }
};

// Close WebSocket and clear data
export const closeSocketAndClearData = (): void => {
  closeSocket();
  clearRoomData();
};

// Helper to get readable WebSocket state
const getReadyStateLabel = (readyState: number): string => {
  switch (readyState) {
    case WebSocket.CONNECTING:
      return 'CONNECTING';
    case WebSocket.OPEN:
      return 'OPEN';
    case WebSocket.CLOSING:
      return 'CLOSING';
    case WebSocket.CLOSED:
      return 'CLOSED';
    default:
      return `UNKNOWN (${readyState})`;
  }
};

// Utility function to signal client is ready for the next round
export const signalNextRoundReady = (
  roomId: string,
  roundNumber: number
): void => {
  console.log(
    `[websocket.ts] Signaling server that web client is ready for round ${roundNumber}`
  );

  try {
    // Check socket health first
    if (!isSocketHealthy()) {
      console.warn(
        '[websocket.ts] Socket not healthy, refreshing connection'
      );
      refreshConnectionStatus();

      // Wait for connection to be established, then try again
      setTimeout(() => {
        if (isSocketHealthy()) {
          console.log(
            `[websocket.ts] Retrying next_round_ready for round ${roundNumber} after refresh`
          );
          sendMessage('next_round_ready', { roomId, roundNumber }).catch(
            (error) => {
              console.error(
                '[websocket.ts] Error sending next_round_ready after refresh:',
                error
              );
            }
          );
        } else {
          console.error(
            '[websocket.ts] Still not healthy after refresh, cannot send next_round_ready'
          );
        }
      }, 500);

      return;
    }

    // Send with normal flow if socket is healthy
    sendMessage('next_round_ready', { roomId, roundNumber }).catch((error) => {
      console.error(
        '[websocket.ts] Error sending next_round_ready signal:',
        error
      );
    });
  } catch (error) {
    console.error(
      '[websocket.ts] Exception sending next_round_ready signal:',
      error
    );
  }
};

// Add a helper function to mark page transition
export const markPageTransition = (): void => {
  console.log('[websocket.ts] Marking page transition');

  // Instead of using a flag, we'll ensure the socket stays alive
  // Force a refresh of socket status
  if (socket && socket.readyState === WebSocket.OPEN) {
    // Send an immediate ping to keep the connection alive
    sendMessage('ping', { timestamp: Date.now(), transition: true }).catch(
      (err) => {
        console.error('[websocket.ts] Error sending transition ping:', err);
      }
    );
  }
};

// Force connection status refresh (call this after navigation)
export const refreshConnectionStatus = (): void => {
  console.log('[websocket.ts] Refreshing connection status');

  // If socket exists and is open, dispatch connected event
  if (isSocketHealthy()) {
    console.log(
      '[websocket.ts] Socket is healthy, dispatching connected event'
    );
    window.dispatchEvent(new CustomEvent('ws_connected'));
    return;
  }

  // If no socket or socket is closed/closing but we're marked as connected, fix the state
  if (socketStatus === 'connected' && (!socket || socket.readyState > 1)) {
    console.log('[websocket.ts] Fixing inconsistent socket state');
    socketStatus = 'disconnected';
    window.dispatchEvent(new CustomEvent('ws_connection_closed'));

    // Try to reconnect
    initializeSocket();
  }
};

// Add a more comprehensive socket health check
export const isSocketHealthy = (): boolean => {
  const isOpen = socket !== null && socket.readyState === WebSocket.OPEN;
  const isStatusConnected = socketStatus === 'connected';

  // Log detailed health status when it's inconsistent
  if (isOpen !== isStatusConnected) {
    console.warn('[websocket.ts] Socket health inconsistency:', {
      socket: socket ? 'exists' : 'null',
      readyState: socket ? socket.readyState : 'N/A',
      socketStatus,
    });
  }

  return isOpen && isStatusConnected;
};
