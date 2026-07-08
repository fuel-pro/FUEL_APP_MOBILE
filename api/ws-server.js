/**
 * WebSocket Server for Real-time Features
 * SECURITY: Added origin validation and rate limiting
 */

const { WebSocketServer } = require('ws');

const stations = new Map();
const rooms = new Map();

// Rate limiting
const connectionRateLimit = new Map();
const MAX_CONNECTIONS_PER_MINUTE = 5;
const RATE_LIMIT_WINDOW = 60000;

// Allowed origins for WebSocket connections
const ALLOWED_ORIGINS = [
  'https://fuel-app-mobile.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173'
];

// Clean up rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of connectionRateLimit.entries()) {
    if (now - data.windowStart > RATE_LIMIT_WINDOW) {
      connectionRateLimit.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW);

function createWebSocketServer(server) {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws',
    clientTracking: true
  });

  // Validate origin on connection
  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    const origin = req.headers.origin || req.headers.host;

    console.log(`[WS] Connection attempt from ${clientIp} origin: ${origin}`);

    // SECURITY: Rate limiting per IP
    const rateData = connectionRateLimit.get(clientIp) || { count: 0, windowStart: Date.now() };
    const now = Date.now();
    
    if (now - rateData.windowStart > RATE_LIMIT_WINDOW) {
      rateData.count = 1;
      rateData.windowStart = now;
    } else {
      rateData.count++;
    }
    
    connectionRateLimit.set(clientIp, rateData);
    
    if (rateData.count > MAX_CONNECTIONS_PER_MINUTE) {
      console.warn(`[WS] Rate limited: ${clientIp}`);
      ws.close(1008, 'Rate limit exceeded');
      return;
    }

    // SECURITY: Validate origin (skip for localhost in development)
    const isLocalhost = clientIp === '::1' || clientIp === '127.0.0.1' || clientIp.startsWith('::ffff:127.');
    if (process.env.NODE_ENV === 'production' && !isLocalhost) {
      if (!origin || !ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed))) {
        console.warn(`[WS] Rejected connection from invalid origin: ${origin}`);
        ws.close(1008, 'Invalid origin');
        return;
      }
    }

    ws.isAlive = true;
    ws.clientIp = clientIp;

    // Heartbeat to detect dead connections
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(ws, message);
      } catch (error) {
        console.error('[WS] Message parse error:', error.message);
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Invalid message format' 
        }));
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`[WS] Client disconnected: ${clientIp} code: ${code}`);
      // Clean up rooms
      cleanupDisconnectedClient(ws);
    });

    ws.on('error', (error) => {
      console.error(`[WS] Error from ${clientIp}:`, error.message);
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to FuelPro',
      timestamp: new Date().toISOString()
    }));
  });

  // Heartbeat interval to detect dead connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        console.log(`[WS] Terminating dead connection: ${ws.clientIp}`);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  return wss;
}

function handleMessage(ws, message) {
  const { type, payload } = message;

  // Validate message type
  if (!type || typeof type !== 'string') {
    return ws.send(JSON.stringify({ 
      type: 'error', 
      message: 'Message type required' 
    }));
  }

  switch (type) {
    case 'join_room':
      handleJoinRoom(ws, payload);
      break;
    case 'leave_room':
      handleLeaveRoom(ws, payload);
      break;
    case 'broadcast':
      handleBroadcast(ws, payload);
      break;
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;
    default:
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: `Unknown message type: ${type}` 
      }));
  }
}

function handleJoinRoom(ws, payload) {
  if (!payload || !payload.roomId) {
    return ws.send(JSON.stringify({ 
      type: 'error', 
      message: 'roomId required' 
    }));
  }

  const roomId = payload.roomId.toString().substring(0, 50); // Limit room ID length

  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }

  rooms.get(roomId).add(ws);
  ws.currentRoom = roomId;

  console.log(`[WS] Client joined room: ${roomId}`);

  ws.send(JSON.stringify({
    type: 'room_joined',
    roomId,
    clientCount: rooms.get(roomId).size
  }));
}

function handleLeaveRoom(ws, payload) {
  if (!payload || !payload.roomId) return;

  const roomId = payload.roomId;

  if (rooms.has(roomId)) {
    rooms.get(roomId).delete(ws);
    if (rooms.get(roomId).size === 0) {
      rooms.delete(roomId);
    }
  }

  ws.currentRoom = null;

  ws.send(JSON.stringify({ 
    type: 'room_left', 
    roomId 
  }));
}

function handleBroadcast(ws, payload) {
  if (!ws.currentRoom) {
    return ws.send(JSON.stringify({ 
      type: 'error', 
      message: 'Not in a room' 
    }));
  }

  const room = rooms.get(ws.currentRoom);
  if (!room) return;

  const broadcastMessage = JSON.stringify({
    type: 'broadcast',
    payload: payload,
    timestamp: new Date().toISOString(),
    from: ws.clientIp
  });

  room.forEach((client) => {
    if (client !== ws && client.readyState === 1) {
      client.send(broadcastMessage);
    }
  });
}

function cleanupDisconnectedClient(ws) {
  if (ws.currentRoom) {
    const room = rooms.get(ws.currentRoom);
    if (room) {
      room.delete(ws);
      if (room.size === 0) {
        rooms.delete(ws.currentRoom);
      }
    }
  }
}

module.exports = { createWebSocketServer };