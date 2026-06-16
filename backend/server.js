require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io with CORS for Vercel frontend
const io = new Server(server, {
  cors: {
    origin: [
      "https://fuel-app-mobile.vercel.app",
      "http://localhost:5173",
      "http://localhost:3000"
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

// Middleware
app.use(cors({ 
  origin: [
    "https://fuel-app-mobile.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000"
  ], 
  credentials: true 
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Make 'io' instance available to routes
app.set('io', io);

// Database Connection
const MONGO_URI = process.env.MONGO_URI;
console.log('🔧 MONGO_URI loaded:', MONGO_URI ? 'YES (length: ' + MONGO_URI.length + ')' : 'NO');
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    env: {
      hasMongoUri: !!process.env.MONGO_URI,
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT
    }
  });
});

// Debug endpoint
app.get('/debug', (req, res) => {
  res.json({
    env: {
      MONGO_URI: process.env.MONGO_URI ? '***' : 'NOT SET',
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      JWT_SECRET: process.env.JWT_SECRET ? '***' : 'NOT SET'
    },
    mongoose: {
      readyState: mongoose.connection.readyState,
      states: ['disconnected', 'connected', 'connecting', 'disconnecting']
    }
  });
});

// API Routes
app.use('/api/content', require('./routes/contentRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/stations', require('./routes/stationRoutes'));
app.use('/api/audit', require('./routes/auditRoutes'));

// Socket.io Connection Handler
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  
  // Join rooms based on user role
  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`👤 ${socket.id} joined room: ${room}`);
  });

  socket.on('leave_room', (room) => {
    socket.leave(room);
    console.log(`👤 ${socket.id} left room: ${room}`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket ready for connections`);
  console.log(`🌐 CORS enabled for: https://fuel-app-mobile.vercel.app`);
});
