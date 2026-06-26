require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { initializeDatabase } = require('./database/sqlite');

const app = express();
const server = http.createServer(app);

// Initialize SQLite database
initializeDatabase();

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

// Root endpoint - Render needs this for health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'FuelPro Backend API',
    version: '3.1-CLOUD-SYNC-REST',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint - SQLite version 3.0
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '3.0-SQLITE-MIGRATION-COMPLETE',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: 'sqlite',
    migration: 'MongoDB-to-SQLite-2024-06-18',
    env: {
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT
    }
  });
});

// Debug endpoint
app.get('/debug', (req, res) => {
  res.json({
    env: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      JWT_SECRET: process.env.JWT_SECRET ? '***' : 'NOT SET'
    },
    database: {
      type: 'sqlite',
      status: 'connected'
    }
  });
});

// API Routes
app.use('/api/content', require('./routes/contentRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/stations', require('./routes/stationRoutes'));
app.use('/api/audit', require('./routes/auditRoutes'));

// Cloud Sync REST API
app.use('/api', require('./routes/cloudSyncRoutes'));

// Clerk Backend Integration Routes
app.use('/api/clerk', require('./routes/clerkRoutes'));

// M-PESA Callback Routes (NEW!)
app.use('/api/mpesa', require('./routes/mpesaCallback'));

// Clerk Backend Integration Status
console.log(`🔐 Clerk Backend Integration: ${process.env.CLERK_SECRET_KEY ? 'Enabled' : 'Disabled'}`);
console.log(`📱 M-PESA Integration: ${process.env.MPESA_SHORTCODE ? 'Enabled' : 'Disabled'}`);

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

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket ready for connections`);
  console.log(`🌐 CORS enabled for: https://fuel-app-mobile.vercel.app`);
});
