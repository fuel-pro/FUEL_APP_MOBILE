const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { getDb } = require('../database/sqlite');
const { protect } = require('../middleware/auth');
const clerkAuth = require('../middleware/clerkAuth');

// Generate JWT Token
const generateToken = (userId) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return jwt.sign(
    { id: userId },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

// Session tracking with cleanup
const activeSessions = new Map();
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
const MAX_SESSIONS = 10000;

function cleanupSessions() {
  const now = Date.now();
  for (const [userId, session] of activeSessions.entries()) {
    if (now - session.lastActive > SESSION_TIMEOUT) {
      activeSessions.delete(userId);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupSessions, 60 * 60 * 1000);

const trackSession = (userId, deviceId, sessionId) => {
  if (activeSessions.size >= MAX_SESSIONS) {
    const oldestKey = activeSessions.keys().next().value;
    activeSessions.delete(oldestKey);
  }
  activeSessions.set(userId, {
    deviceId,
    sessionId,
    lastActive: Date.now(),
    lastIp: null
  });
};

const updateSessionActivity = (userId, ip) => {
  const session = activeSessions.get(userId);
  if (session) {
    session.lastActive = Date.now();
    if (ip) session.lastIp = ip;
  }
};

const getActiveSession = (userId) => {
  return activeSessions.get(userId) || null;
};

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 1. REGISTER new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existingUser = User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    const allUsers = User.findAll ? User.findAll() : [];
    const isFirstUser = allUsers.length === 0;
    const assignedRole = isFirstUser ? 'founder' : (role || 'user');

    const user = await User.create({
      email: email.toLowerCase(),
      password,
      name,
      role: assignedRole,
      permissions: getDefaultPermissions(assignedRole)
    });

    const token = generateToken(user.id);

    res.status(201).json({
      message: isFirstUser ? 'Welcome! You are now the founder.' : 'User registered successfully',
      user: user.toJSON(),
      token,
      isFirstUser
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password, deviceId } = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'Unknown';

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = User.findByEmail(email);

    if (!user) {
      await AuditLog.create({
        action: 'LOGIN_FAILED',
        detail: `Failed login attempt for non-existent user: ${email}`,
        user: email,
        metadata: { ip, userAgent }
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isActive) {
      await AuditLog.create({
        action: 'LOGIN_BLOCKED',
        detail: `Login blocked for deactivated account: ${email}`,
        user: email,
        metadata: { ip, userAgent }
      });
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    const isMatch = await User.comparePassword(user, password);

    if (!isMatch) {
      await AuditLog.create({
        action: 'LOGIN_FAILED',
        detail: `Failed login attempt for user: ${email}`,
        user: email,
        metadata: { ip, userAgent }
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const loginHistory = [...(user.loginHistory || [])];
    loginHistory.unshift({
      timestamp: new Date().toISOString(),
      ip,
      userAgent,
      deviceId,
      success: true
    });
    const trimmedHistory = loginHistory.slice(0, 20);

    await User.update(user.id, {
      lastLoginAt: new Date().toISOString(),
      lastLoginIp: ip,
      loginHistory: trimmedHistory
    });

    await AuditLog.create({
      action: 'LOGIN_SUCCESS',
      detail: `User logged in: ${email}`,
      user: email,
      userId: user.id,
      metadata: { ip, userAgent, deviceId }
    });

    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken();
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Store refresh token in database
    const db = getDb();
    db.prepare(`
      INSERT INTO sessions (id, userId, refreshToken, expiresAt)
      VALUES (?, ?, ?, ?)
    `).run(sessionId, user.id, refreshToken, expiresAt);

    trackSession(user.id, deviceId || 'unknown', sessionId);

    const updatedUser = User.findById(user.id);

    res.json({
      message: 'Login successful',
      user: updatedUser.toJSON(),
      token,
      refreshToken,
      sessionId,
      role: updatedUser.role,
      session: getActiveSession(user.id)
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// FIX: REFRESH TOKEN - Proper implementation with DB verification
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Verify refresh token from database
    const db = getDb();
    const session = db.prepare(`
      SELECT * FROM sessions 
      WHERE refreshToken = ? AND expiresAt > datetime('now')
    `).get(refreshToken);

    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Get user
    const user = User.findById(session.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or deactivated' });
    }

    // Generate new tokens
    const newToken = generateToken(user.id);
    const newRefreshToken = generateRefreshToken();
    const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Update session in database
    db.prepare(`
      UPDATE sessions SET refreshToken = ?, expiresAt = ? WHERE id = ?
    `).run(newRefreshToken, newExpiry, session.id);

    res.json({
      token: newToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2c. GET SESSION INFO
router.get('/session', clerkAuth.protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = User.findById(userId);

    res.json({
      session: getActiveSession(userId),
      user: user?.toJSON(),
      loginHistory: user?.loginHistory || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. GET CURRENT USER
router.get('/me', clerkAuth.protect, async (req, res) => {
  try {
    const user = User.findById(req.user.id);
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. UPDATE PASSWORD
router.put('/password', clerkAuth.protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const user = User.findById(req.user.id);

    const isMatch = await User.comparePassword(user, currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    await User.update(user.id, { password: newPassword });

    await AuditLog.create({
      action: 'PASSWORD_CHANGED',
      detail: `Password changed for user: ${user.email}`,
      user: user.email,
      userId: user.id,
      metadata: { ip }
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. LOGOUT
router.post('/logout', clerkAuth.protect, async (req, res) => {
  try {
    await AuditLog.create({
      action: 'LOGOUT',
      detail: `User logged out: ${req.user.email}`,
      user: req.user.email,
      userId: req.user.id
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function getDefaultPermissions(role) {
  switch (role) {
    case 'founder':
      return ['read', 'write', 'delete', 'rollback', 'manage_users', 'manage_content', 'view_audit'];
    case 'admin':
      return ['read', 'write', 'manage_users', 'manage_content', 'view_audit'];
    case 'developer':
      return ['read', 'write', 'manage_content'];
    case 'user':
      return ['read'];
    default:
      return ['read'];
  }
}

// FOUNDER LOGIN
router.post('/founder-login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const FOUNDER_USER = process.env.FOUNDER_USER;
    const FOUNDER_PASS = process.env.FOUNDER_PASS;

    if (!FOUNDER_USER || !FOUNDER_PASS) {
      console.error('❌ FOUNDER_USER/FOUNDER_PASS not set');
      return res.status(500).json({ error: 'Founder login not configured' });
    }

    if (username !== FOUNDER_USER || password !== FOUNDER_PASS) {
      await AuditLog.create({
        action: 'FOUNDER_LOGIN_FAILED',
        detail: `Failed founder login for: ${username}`,
        metadata: { ip }
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    let founderUser = User.findByEmail('founder@system.local');
    if (!founderUser) {
      founderUser = await User.create({
        email: 'founder@system.local',
        password: crypto.randomBytes(32).toString('hex'),
        name: 'Founder',
        role: 'founder',
        permissions: getDefaultPermissions('founder')
      });
    }

    const token = generateToken(founderUser.id);

    await AuditLog.create({
      action: 'FOUNDER_LOGIN_SUCCESS',
      detail: 'Founder logged in',
      userId: founderUser.id,
      metadata: { ip }
    });

    res.json({
      success: true,
      token,
      user: { id: founderUser.id, role: 'founder', email: founderUser.email }
    });
  } catch (error) {
    console.error('Founder login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// VERIFY FOUNDER TOKEN
router.get('/verify-founder', protect, async (req, res) => {
  try {
    if (req.user.role !== 'founder') {
      return res.status(403).json({ valid: false, error: 'Not a founder' });
    }
    res.json({ valid: true, role: 'founder' });
  } catch (error) {
    res.status(500).json({ valid: false, error: error.message });
  }
});

// SETUP - Create initial founder user
router.post('/setup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    const existingUsers = User.findAll();
    if (existingUsers.length > 0) {
      return res.status(403).json({ 
        error: 'System already has users. Use /api/auth/register instead.',
        userCount: existingUsers.length 
      });
    }

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const user = await User.create({
      email: email.toLowerCase(),
      password,
      name,
      role: 'founder',
      permissions: getDefaultPermissions('founder')
    });

    const token = generateToken(user.id);

    console.log(`✅ Founder account created: ${email}`);

    res.status(201).json({
      success: true,
      message: 'Founder account created successfully!',
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token
    });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// STATUS - Check if setup is needed
router.get('/status', async (req, res) => {
  try {
    const users = User.findAll();
    res.json({
      needsSetup: users.length === 0,
      userCount: users.length,
      hasFounder: users.some(u => u.role === 'founder')
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;