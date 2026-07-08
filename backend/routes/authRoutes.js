const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { protect } = require('../middleware/auth');
const clerkAuth = require('../middleware/clerkAuth');

// SECURITY: Verify JWT_SECRET is available
if (!process.env.JWT_SECRET) {
  console.error('❌ CRITICAL: JWT_SECRET not set. Auth routes will not function.');
}

// Generate JWT Token
const generateToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('Server configuration error: JWT_SECRET not set');
  }
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
// FIX: Add session cleanup to prevent memory leak
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

const activeSessions = new Map(); // userId -> { deviceId, lastActive, sessionId }

// Periodic cleanup of stale sessions
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [userId, session] of activeSessions.entries()) {
    if (now - session.lastActive > SESSION_MAX_AGE) {
      activeSessions.delete(userId);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.debug(`[Sessions] Cleaned ${cleaned} stale sessions`);
  }
}, SESSION_CLEANUP_INTERVAL);

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
  const session = activeSessions.get(userId);
  if (!session) return null;
  
  // Return null if session is stale
  if (Date.now() - session.lastActive > SESSION_MAX_AGE) {
    activeSessions.delete(userId);
    return null;
  }
  return session;
};

// Input validation helpers
const validateEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim().toLowerCase());
};

const validatePassword = (password) => {
  if (!password || typeof password !== 'string') return false;
  // At least 8 chars, contains uppercase, lowercase, and number
  return password.length >= 8 && 
         /[A-Z]/.test(password) && 
         /[a-z]/.test(password) && 
         /[0-9]/.test(password);
};

const validatePhone = (phone) => {
  if (!phone) return false;
  // Kenya phone format: 254XXXXXXXXX or 07XXXXXXXX or 01XXXXXXXX
  const clean = phone.replace(/[\s-]/g, '');
  return /^(254|0[17])[0-9]{8,9}$/.test(clean);
};

// 1. REGISTER new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Trim and validate email
    const trimmedEmail = email.trim().toLowerCase();
    if (!validateEmail(trimmedEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if user exists
    const existingUser = User.findByEmail(trimmedEmail);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Check if this is the first user - make them founder
    const allUsers = User.findAll ? User.findAll() : [];
    const isFirstUser = allUsers.length === 0;
    const assignedRole = isFirstUser ? 'founder' : (role || 'user');

    // Create user
    const user = await User.create({
      email: trimmedEmail,
      password,
      name: name.trim(),
      role: assignedRole,
      permissions: getDefaultPermissions(assignedRole)
    });

    // Generate token
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

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Find user
    const user = User.findByEmail(trimmedEmail);
    
    if (!user) {
      await AuditLog.create({
        action: 'LOGIN_FAILED',
        detail: `Failed login attempt for non-existent user`,
        user: trimmedEmail,
        metadata: { ip, userAgent }
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isActive) {
      await AuditLog.create({
        action: 'LOGIN_BLOCKED',
        detail: `Login blocked for deactivated account`,
        user: trimmedEmail,
        metadata: { ip, userAgent }
      });
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    const isMatch = await User.comparePassword(user, password);
    
    if (!isMatch) {
      await AuditLog.create({
        action: 'LOGIN_FAILED',
        detail: `Failed login attempt`,
        user: trimmedEmail,
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
      deviceId: deviceId ? deviceId.substring(0, 50) : 'unknown', // Limit device ID length
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
      detail: `User logged in`,
      user: trimmedEmail,
      userId: user.id,
      metadata: { ip, userAgent }
    });

    // Generate tokens
    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken();
    const sessionId = `sess_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

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
      detail: `Password changed`,
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
    // Remove session from active sessions
    if (req.user?.id) {
      activeSessions.delete(req.user.id);
    }

    await AuditLog.create({
      action: 'LOGOUT',
      detail: `User logged out`,
      user: req.user?.email,
      userId: req.user?.id
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function
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
// SECURITY: Requires FOUNDER_USER and FOUNDER_PASS env vars - NO DEFAULTS
router.post('/founder-login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // SECURITY: No defaults - must be configured via environment
    if (!process.env.FOUNDER_USER || !process.env.FOUNDER_PASS) {
      console.error('❌ ERROR: FOUNDER_USER and FOUNDER_PASS must be set in environment variables');
      await AuditLog.create({
        action: 'FOUNDER_LOGIN_FAILED',
        detail: `Founder login attempted without env configuration`,
        metadata: { ip, error: 'ENV_NOT_SET' }
      });
      return res.status(500).json({ error: 'Server configuration error' });
    }

    if (username !== process.env.FOUNDER_USER || password !== process.env.FOUNDER_PASS) {
      await AuditLog.create({
        action: 'FOUNDER_LOGIN_FAILED',
        detail: `Failed founder login`,
        metadata: { ip }
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Find or create founder user
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

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Create founder user
    const user = await User.create({
      email: email.toLowerCase().trim(),
      password,
      name: name.trim(),
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