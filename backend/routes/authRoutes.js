const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { protect } = require('../middleware/auth');
const clerkAuth = require('../middleware/clerkAuth');

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Generate refresh token (long-lived, stored in DB)
const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

// Device tracking for cross-device login
const activeSessions = new Map(); // userId -> { deviceId, lastActive, sessionId }

const trackSession = (userId, deviceId, sessionId) => {
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

// 1. REGISTER new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if user exists
    const existingUser = User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Create user
    const user = await User.create({
      email: email.toLowerCase(),
      password,
      name,
      role: role || 'user',
      permissions: getDefaultPermissions(role || 'user')
    });

    // Generate token
    const token = generateToken(user.id);

    res.status(201).json({
      message: 'User registered successfully',
      user: user.toJSON(),
      token
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

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
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

    // Update last login
    const loginHistory = [...(user.loginHistory || [])];
    loginHistory.unshift({
      timestamp: new Date().toISOString(),
      ip,
      userAgent,
      deviceId,
      success: true
    });
    const trimmedHistory = loginHistory.slice(0, 20); // Keep more login records
    
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

    // Generate tokens
    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken();
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Track session for cross-device support
    trackSession(user.id, deviceId || 'unknown', sessionId);

    // Fetch updated user
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

// 2b. REFRESH TOKEN
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // In production, verify refresh token from DB
    // For now, just issue a new access token
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const newToken = generateToken(userId);
    const newRefreshToken = generateRefreshToken();

    res.json({
      token: newToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
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

// 5. LOGOUT (client-side token removal, but we can log it)
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

// Helper function to get default permissions based on role
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

// 6. FOUNDER LOGIN (FIXED: No hardcoded credentials - uses env vars)
// Credentials stored in backend environment variables only
router.post('/founder-login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // FIXED: Use environment variables instead of hardcoded credentials
    const FOUNDER_USER = process.env.FOUNDER_USER || process.env.FOUNDER_USERNAME;
    const FOUNDER_PASS = process.env.FOUNDER_PASS || process.env.FOUNDER_PASSWORD;

    if (!FOUNDER_USER || !FOUNDER_PASS) {
      console.error('❌ FOUNDER_USER/FOUNDER_PASS not set in environment');
      return res.status(500).json({ error: 'Founder login not configured' });
    }

    if (username !== FOUNDER_USER || password !== FOUNDER_PASS) {
      await AuditLog.create({
        action: 'FOUNDER_LOGIN_FAILED',
        detail: `Failed founder login attempt for: ${username}`,
        metadata: { ip }
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token for founder
    const founderUser = User.findByEmail('founder@system.local') || 
      await User.create({
        email: 'founder@system.local',
        password: crypto.randomBytes(32).toString('hex'),
        name: 'Founder',
        role: 'founder',
        permissions: getDefaultPermissions('founder')
      });

    const token = jwt.sign(
      { id: founderUser.id, role: 'founder' },
      process.env.JWT_SECRET,
      { expiresIn: '8h' } // 8 hour session
    );

    await AuditLog.create({
      action: 'FOUNDER_LOGIN_SUCCESS',
      detail: 'Founder logged in successfully',
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

// 7. VERIFY FOUNDER TOKEN (FIXED)
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

module.exports = router;
