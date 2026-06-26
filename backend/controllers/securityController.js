/**
 * Security Controller - bcrypt, JWT, Password Reset
 * Replaces insecure client-side XOR encryption with industry-standard backend security
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

// Email configuration (supports Gmail, SendGrid, Mailgun, etc.)
let transporter = null;
if (process.env.EMAIL_HOST) {
  const nodemailer = require('nodemailer');
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

// Generate JWT Token
const generateToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET || 'fuelpro-secret-key',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Generate 6-digit reset code
const generateResetCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// REGISTER - Hash password with bcrypt
exports.register = async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existingUser = User.findByEmail(email.toLowerCase());
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      role: role || 'user',
      permissions: getDefaultPermissions(role || 'user')
    });

    const token = generateToken(user.id, user.role);

    await AuditLog.create({
      action: 'USER_REGISTERED',
      detail: `New user registered: ${email}`,
      user: email,
      metadata: { role: user.role }
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: user.toJSON(),
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
};

// LOGIN - Compare hashed passwords
exports.login = async (req, res) => {
  try {
    const { email, password, deviceId } = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'Unknown';

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = User.findByEmail(email.toLowerCase());
    
    if (!user) {
      await AuditLog.create({
        action: 'LOGIN_FAILED',
        detail: `Failed login for non-existent user: ${email}`,
        user: email,
        metadata: { ip, userAgent }
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    
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
    
    await User.update(user.id, {
      lastLoginAt: new Date().toISOString(),
      lastLoginIp: ip,
      loginHistory: loginHistory.slice(0, 20)
    });

    const token = generateToken(user.id, user.role);
    const refreshToken = crypto.randomBytes(64).toString('hex');

    await AuditLog.create({
      action: 'LOGIN_SUCCESS',
      detail: `User logged in: ${email}`,
      user: email,
      userId: user.id,
      metadata: { ip, userAgent, deviceId }
    });

    res.json({
      message: 'Login successful',
      user: User.findById(user.id).toJSON(),
      token,
      refreshToken,
      role: user.role
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
};

// FORGOT PASSWORD
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = User.findByEmail(email.toLowerCase());
    if (!user) {
      return res.json({ message: 'If an account exists, a reset code has been sent' });
    }

    const resetCode = generateResetCode();
    const codeExpires = Date.now() + 10 * 60 * 1000;

    await User.update(user.id, {
      resetCode: resetCode,
      resetCodeExpires: codeExpires
    });

    if (transporter) {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: user.email,
        subject: 'FuelPro Password Reset Code',
        text: `Your password reset code is: ${resetCode}\n\nThis code expires in 10 minutes.`
      });
    } else {
      console.log(`🔐 Password Reset Code for ${email}: ${resetCode}`);
    }

    await AuditLog.create({
      action: 'PASSWORD_RESET_REQUESTED',
      detail: `Password reset requested for: ${email}`,
      user: email
    });

    res.json({ 
      message: 'If an account exists, a reset code has been sent',
      devCode: process.env.NODE_ENV === 'development' ? resetCode : undefined
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: error.message });
  }
};

// VERIFY RESET CODE
exports.verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }

    const user = User.findByEmail(email.toLowerCase());
    if (!user) {
      return res.status(400).json({ error: 'Invalid code' });
    }

    if (user.resetCode !== code) {
      return res.status(400).json({ error: 'Invalid code' });
    }

    if (Date.now() > user.resetCodeExpires) {
      return res.status(400).json({ error: 'Code has expired' });
    }

    res.json({ message: 'Code verified successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// RESET PASSWORD
exports.resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const user = User.findByEmail(email.toLowerCase());
    if (!user) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    if (user.resetCode !== code || Date.now() > user.resetCodeExpires) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await User.update(user.id, {
      password: hashedPassword,
      resetCode: null,
      resetCodeExpires: null
    });

    await AuditLog.create({
      action: 'PASSWORD_RESET',
      detail: `Password reset for user: ${email}`,
      user: email,
      userId: user.id
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// CHANGE PASSWORD
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const user = User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await User.update(user.id, { password: hashedPassword });

    await AuditLog.create({
      action: 'PASSWORD_CHANGED',
      detail: `Password changed for user: ${user.email}`,
      user: user.email,
      userId: user.id
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

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

module.exports = exports;
