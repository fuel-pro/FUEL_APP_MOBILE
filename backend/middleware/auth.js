const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect route - verify JWT token OR Clerk JWT token
const protect = async (req, res, next) => {
  let token;

  // Get token from header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authorized, no token provided' });
  }

  try {
    // Check if it's a Clerk JWT token (starts with 'eyJ' - JWT format)
    const isClerkToken = token.startsWith('eyJ') && token.split('.').length === 3;
    
    if (isClerkToken) {
      // Clerk token - use Clerk auth middleware
      const clerkAuth = require('./clerkAuth');
      return clerkAuth.protect(req, res, next);
    }
    
    // Legacy JWT verification
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fuelpro-secret-key');
    
    // Get user from token (synchronous for SQLite)
    const user = User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Add user to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(401).json({ error: 'Not authorized, token invalid' });
  }
};

// Authorize specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Role '${req.user.role}' is not authorized to access this resource`,
        requiredRoles: roles
      });
    }

    next();
  };
};

// Check specific permission
const hasPermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userPermissions = req.user.permissions || [];
    const hasAllPermissions = permissions.every(p => userPermissions.includes(p));

    if (!hasAllPermissions) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: permissions,
        current: userPermissions
      });
    }

    next();
  };
};

// Optional auth - set user if token exists, but don't require it
const optionalAuth = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      // Check if Clerk token
      if (token.startsWith('eyJ') && token.split('.').length === 3) {
        const clerkAuth = require('./clerkAuth');
        return clerkAuth.optionalAuth(req, res, next);
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fuelpro-secret-key');
      const user = User.findById(decoded.id);
      if (user && user.isActive) {
        req.user = user;
      }
    } catch (error) {
      // Token invalid, continue without user
    }
  }

  next();
};

module.exports = { protect, authorize, hasPermission, optionalAuth };
