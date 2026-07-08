/**
 * Role-Based Access Control (RBAC) Middleware
 * Protects routes by verifying user role on the backend
 * 
 * SECURITY: No hardcoded JWT secret fallback - server will reject tokens
 * if JWT_SECRET is not properly configured
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

// SECURITY: Check JWT_SECRET at module load time
if (!process.env.JWT_SECRET) {
  console.error('❌ CRITICAL: JWT_SECRET environment variable is not set!');
  console.error('   All JWT verification will fail. Set JWT_SECRET before starting the server.');
}

// 1. Verify JWT Token
exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(403).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  // SECURITY: No fallback secret - must use environment variable
  if (!process.env.JWT_SECRET) {
    console.error('❌ JWT_SECRET not configured - cannot verify token');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user info to request
    req.user = {
      id: decoded.id,
      role: decoded.role
    };
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// 2. Check User Role
exports.requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({ error: 'Authentication required' });
    }

    if (!req.user.role) {
      return res.status(403).json({ error: 'Role not found' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      // Log unauthorized access attempt
      AuditLog.create({
        action: 'ACCESS_DENIED',
        detail: `User with role '${req.user.role}' attempted to access restricted resource`,
        userId: req.user.id,
        metadata: { 
          requiredRoles: allowedRoles, 
          userRole: req.user.role,
          path: req.path,
          method: req.method
        }
      }).catch(console.error);
      
      return res.status(403).json({ 
        error: 'Access denied',
        message: `This action requires: ${allowedRoles.join(' or ')}`
      });
    }

    next();
  };
};

// 3. Check Permission
exports.requirePermission = (...requiredPermissions) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({ error: 'Authentication required' });
    }

    try {
      const user = User.findById(req.user.id);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userPermissions = user.permissions || [];
      const hasPermission = requiredPermissions.every(perm => userPermissions.includes(perm));

      if (!hasPermission) {
        AuditLog.create({
          action: 'PERMISSION_DENIED',
          detail: `User lacks required permissions: ${requiredPermissions.join(', ')}`,
          userId: req.user.id,
          userEmail: user.email,
          metadata: { 
            requiredPermissions, 
            userPermissions 
          }
        }).catch(console.error);
        
        return res.status(403).json({ 
          error: 'Permission denied',
          message: `Required permissions: ${requiredPermissions.join(', ')}`
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Error checking permissions' });
    }
  };
};

// 4. Optional Auth - Attach user if token exists, but don't block
exports.optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  // SECURITY: No fallback - skip user attachment if no secret
  if (!process.env.JWT_SECRET) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      role: decoded.role
    };
  } catch (error) {
    // Token invalid, but we don't block - just continue without user
    // Log for debugging purposes
    console.debug('Optional auth token invalid:', error.message);
  }
  
  next();
};

// 5. Rate Limiter for Auth Routes (with automatic cleanup)
const rateLimitStore = new Map();

// Clean up rate limit store every 5 minutes
setInterval(() => {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutes
  let cleaned = 0;
  for (const [k, v] of rateLimitStore.entries()) {
    if (now - v.windowStart > maxAge) {
      rateLimitStore.delete(k);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.debug(`[RateLimit] Cleaned ${cleaned} stale entries`);
  }
}, 5 * 60 * 1000);

exports.rateLimit = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    const record = rateLimitStore.get(key) || { count: 0, windowStart: now };

    if (now - record.windowStart > windowMs) {
      record.count = 1;
      record.windowStart = now;
    } else {
      record.count++;
    }

    rateLimitStore.set(key, record);

    if (record.count > maxAttempts) {
      return res.status(429).json({ 
        error: 'Too many attempts',
        message: 'Please try again later',
        retryAfter: Math.ceil((windowMs - (now - record.windowStart)) / 1000)
      });
    }

    res.setHeader('X-RateLimit-Limit', maxAttempts);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxAttempts - record.count));
    
    next();
  };
};

module.exports = exports;