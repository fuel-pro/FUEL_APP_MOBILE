const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { protect } = require('../middleware/auth');

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET || 'fuelpro-secret-key',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
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
    const existingUser = await User.findOne({ email: email.toLowerCase() });
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
    const token = generateToken(user._id);

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
    const { email, password } = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'Unknown';

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user with password field
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    
    if (!user) {
      // Log failed attempt
      await AuditLog.create({
        event: 'LOGIN_FAILED',
        detail: `Failed login attempt for non-existent user: ${email}`,
        user: email,
        severity: 'warning',
        metadata: { ip, userAgent }
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if account is active
    if (!user.isActive) {
      await AuditLog.create({
        event: 'LOGIN_BLOCKED',
        detail: `Login blocked for deactivated account: ${email}`,
        user: email,
        severity: 'danger',
        metadata: { ip, userAgent }
      });
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Compare password
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      // Log failed attempt
      await AuditLog.create({
        event: 'LOGIN_FAILED',
        detail: `Failed login attempt for user: ${email}`,
        user: email,
        severity: 'warning',
        metadata: { ip, userAgent }
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    user.lastLoginAt = new Date();
    user.lastLoginIp = ip;
    user.loginHistory.unshift({
      timestamp: new Date(),
      ip,
      userAgent,
      success: true
    });
    // Keep only last 10 login records
    user.loginHistory = user.loginHistory.slice(0, 10);
    await user.save();

    // Log successful login
    await AuditLog.create({
      event: 'LOGIN_SUCCESS',
      detail: `User logged in: ${email}`,
      user: email,
      userId: user._id,
      severity: 'success',
      metadata: { ip, userAgent }
    });

    // Generate token
    const token = generateToken(user._id);

    res.json({
      message: 'Login successful',
      user: user.toJSON(),
      token,
      role: user.role
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. GET CURRENT USER
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. UPDATE PASSWORD
router.put('/password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const user = await User.findById(req.user._id).select('+password');
    
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    await AuditLog.create({
      event: 'PASSWORD_CHANGED',
      detail: `Password changed for user: ${user.email}`,
      user: user.email,
      userId: user._id,
      severity: 'warning',
      metadata: { ip }
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. LOGOUT (client-side token removal, but we can log it)
router.post('/logout', protect, async (req, res) => {
  try {
    await AuditLog.create({
      event: 'LOGOUT',
      detail: `User logged out: ${req.user.email}`,
      user: req.user.email,
      userId: req.user._id,
      severity: 'info'
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

module.exports = router;
