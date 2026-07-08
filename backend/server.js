require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { initializeDatabase } = require('./database/sqlite');
const { createWebSocketServer } = require('../api/ws-server');

// SECURITY: Verify critical environment variables at startup
const REQUIRED_ENV_VARS = ['JWT_SECRET'];
const REQUIRED_IN_PRODUCTION = ['FOUNDER_USER', 'FOUNDER_PASS'];

// Check required vars
for (const varName of REQUIRED_ENV_VARS) {
  if (!process.env[varName]) {
    console.error(`❌ FATAL: ${varName} is not set. This is required.`);
    process.exit(1);
  }
}

// Check production-only vars
if (process.env.NODE_ENV === 'production') {
  for (const varName of REQUIRED_IN_PRODUCTION) {
    if (!process.env[varName]) {
      console.error(`❌ FATAL: ${varName} is not set. Required in production.`);
      process.exit(1);
    }
  }
}

const app = express();
const server = http.createServer(app);

// Initialize SQLite database
initializeDatabase();

// CORS Origins - configurable via environment
const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://fuel-app-mobile.vercel.app'
];

// Parse CORS origins from environment if provided
let corsOrigins = DEFAULT_CORS_ORIGINS;
if (process.env.CORS_ORIGINS) {
  try {
    corsOrigins = JSON.parse(process.env.CORS_ORIGINS);
  } catch (e) {
    console.warn('⚠️ Failed to parse CORS_ORIGINS, using defaults');
  }
}

// Add custom domain if provided
if (process.env.CUSTOM_DOMAIN) {
  corsOrigins.push(process.env.CUSTOM_DOMAIN);
}

console.log(`📡 CORS Origins: ${corsOrigins.join(', ')}`);

// Initialize Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

// Create custom WebSocket server for additional features
createWebSocketServer(server);

// Middleware
app.use(cors({ 
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS rejected: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true 
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`⏱️ Slow request: ${req.method} ${req.path} took ${duration}ms`);
    }
  });
  next();
});

// Make 'io' instance available to routes
app.set('io', io);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'FuelPro Backend API',
    version: '3.2-SECURITY-PATCH',
    timestamp: new Date().toISOString(),
    features: ['authentication', 'real-time', 'payments', 'cloud-sync']
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '3.2-SECURITY-PATCH',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
    },
    env: {
      nodeEnv: process.env.NODE_ENV,
      corsOrigins: corsOrigins.length
    }
  });
});

// Debug endpoint - returns 404 in production to prevent info leakage
app.get('/debug', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json({
    env: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      JWT_SECRET_SET: !!process.env.JWT_SECRET,
      FOUNDER_USER_SET: !!process.env.FOUNDER_USER,
      CORS_ORIGINS: corsOrigins
    },
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
      external: Math.round(process.memoryUsage().external / 1024 / 1024) + 'MB'
    }
  });
});

// API Routes
app.use('/api/content', require('./routes/contentRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/stations', require('./routes/stationRoutes'));
app.use('/api/audit', require('./routes/auditRoutes'));

// Dashboard Analytics Routes
app.use('/api', require('./routes/dashboardRoutes'));

// Cloud Sync REST API
app.use('/api', require('./routes/cloudSyncRoutes'));

// Clerk Backend Integration Routes
app.use('/api/clerk', require('./routes/clerkRoutes'));

// M-PESA Routes
app.use('/api/mpesa', require('./routes/mpesaCallback'));
app.use('/api/mpesa', require('./routes/mpesaStk'));

// Feature status logging
console.log(`🔐 Clerk Backend: ${process.env.CLERK_SECRET_KEY ? 'Enabled' : 'Disabled'}`);
console.log(`📱 M-PESA: ${process.env.MPESA_SHORTCODE ? 'Enabled' : 'Disabled'}`);
console.log(`🔒 Security: Hardcoded secrets removed, env validation active`);

// Socket.io Connection Handler
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  
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

// Error handling middleware - structured error responses
app.use((err, req, res, next) => {
  // Don't leak error details in production
  const isDev = process.env.NODE_ENV !== 'production';
  
  console.error('❌ Server Error:', {
    message: err.message,
    stack: isDev ? err.stack : undefined,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Handle specific error types
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ 
      error: 'Unauthorized',
      code: 'AUTH_FAILED'
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: isDev ? err.details : undefined
    });
  }

  // Generic error response
  res.status(err.status || 500).json({ 
    error: 'Internal Server Error',
    code: 'SERVER_ERROR',
    message: isDev ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.path
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket ready for connections`);
  console.log(`🌐 CORS enabled for configured origins`);
  console.log(`⚡ Environment: ${process.env.NODE_ENV || 'development'}`);
});