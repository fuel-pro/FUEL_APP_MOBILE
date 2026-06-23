/**
 * Clerk Authentication Middleware
 * Verifies Clerk JWT tokens and maps Clerk users to app users
 */
const jwt = require('jsonwebtoken');
const jose = require('jose');
const User = require('../models/User');

// Clerk configuration - use env vars or fallback to provided credentials
const CLERK_FRONTEND_API = process.env.CLERK_FRONTEND_API || 'https://immense-mullet-70.clerk.accounts.dev';
const CLERK_API_KEY = process.env.CLERK_SECRET_KEY;
const CLERK_JWKS_URL = `${CLERK_FRONTEND_API}/.well-known/jwks.json`;

// Cache for JWKS
let jwksCache = null;
let jwksCacheExpiry = 0;
const JWKS_CACHE_TTL = 3600000; // 1 hour

/**
 * Fetch and cache JWKS from Clerk
 */
async function getJWKS() {
  const now = Date.now();
  if (jwksCache && now < jwksCacheExpiry) {
    return jwksCache;
  }

  try {
    const response = await fetch(CLERK_JWKS_URL);
    if (!response.ok) {
      throw new Error(`JWKS fetch failed: ${response.status}`);
    }
    jwksCache = await response.json();
    jwksCacheExpiry = now + JWKS_CACHE_TTL;
    return jwksCache;
  } catch (error) {
    console.error('Failed to fetch Clerk JWKS:', error.message);
    if (jwksCache) {
      return jwksCache; // Return stale cache on error
    }
    throw error;
  }
}

/**
 * Verify Clerk JWT token using JWKS
 */
async function verifyClerkToken(token) {
  try {
    const jwks = await getJWKS();
    
    // Use jose library for JWKS verification
    const JWKS = jose.createLocalJWKSet(jwks);
    
    const { payload } = await jose.jwtVerify(token, JWKS, {
      issuer: CLERK_FRONTEND_API,
      audience: process.env.CLERK_PUBLISHABLE_KEY || 'any',
    });
    
    return payload;
  } catch (error) {
    console.error('Clerk token verification failed:', error.message);
    return null;
  }
}

/**
 * Get or create app user from Clerk user
 */
async function getOrCreateClerkUser(clerkUser) {
  // Try to find by Clerk user ID first
  let user = User.findByEmail(clerkUser.email_addresses?.[0]?.email_address);
  
  if (!user) {
    // Create a new user linked to Clerk
    try {
      user = await User.create({
        email: clerkUser.email_addresses?.[0]?.email_address || `clerk_${clerkUser.id}@clerk.local`,
        password: `clerk_${clerkUser.id}_placeholder`, // Random placeholder - user signs in via Clerk
        name: clerkUser.first_name && clerkUser.last_name 
          ? `${clerkUser.first_name} ${clerkUser.last_name}`
          : clerkUser.first_name || clerkUser.username || 'Clerk User',
        role: 'user',
        permissions: ['read'],
        clerkUserId: clerkUser.id, // Store Clerk user ID
        isActive: true,
      });
      
      // Update with Clerk metadata
      await User.update(user.id, {
        clerkUserId: clerkUser.id,
        // Additional Clerk metadata can be stored
      });
      
      user = User.findById(user.id);
      console.log(`Created new Clerk user: ${user.email} (${user.id})`);
    } catch (error) {
      console.error('Failed to create Clerk user:', error.message);
      return null;
    }
  }
  
  return user;
}

/**
 * Middleware: Protect route - verify Clerk JWT token
 * Supports both Clerk tokens and legacy JWT tokens for backward compatibility
 */
const protect = async (req, res, next) => {
  let token;
  let authHeader = req.headers.authorization;

  // Get token from Authorization header
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authorized, no token provided' });
  }

  try {
    // Check if it's a Clerk token (starts with 'eyJ' - JWT format)
    const isClerkToken = token.startsWith('eyJ') && token.split('.').length === 3;
    
    if (isClerkToken) {
      // Try Clerk JWT verification
      console.log('Verifying Clerk JWT token...');
      const payload = await verifyClerkToken(token);
      
      if (payload) {
        // Get or create user from Clerk data
        const clerkUser = {
          id: payload.sub,
          email_addresses: [{ email_address: payload.email }],
          first_name: payload.given_name,
          last_name: payload.family_name,
          username: payload.username,
          public_metadata: payload.public_metadata || {},
        };
        
        const user = await getOrCreateClerkUser(clerkUser);
        
        if (!user) {
          return res.status(401).json({ error: 'Failed to authenticate Clerk user' });
        }
        
        if (!user.isActive) {
          return res.status(401).json({ error: 'Account is deactivated' });
        }
        
        // Attach user and mark as Clerk authenticated
        req.user = user;
        req.clerkAuth = true;
        req.clerkUserId = payload.sub;
        return next();
      }
    }
    
    // Fallback: Try legacy JWT verification
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fuelpro-secret-key');
    const user = User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    req.user = user;
    req.clerkAuth = false;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(401).json({ error: 'Not authorized, token invalid' });
  }
};

/**
 * Authorize specific roles
 */
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

/**
 * Check specific permission
 */
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

/**
 * Optional auth - set user if token exists, but don't require it
 */
const optionalAuth = async (req, res, next) => {
  let token;
  let authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (token) {
    try {
      // Try Clerk token first
      if (token.startsWith('eyJ') && token.split('.').length === 3) {
        const payload = await verifyClerkToken(token);
        if (payload) {
          const clerkUser = {
            id: payload.sub,
            email_addresses: [{ email_address: payload.email }],
            first_name: payload.given_name,
            last_name: payload.family_name,
          };
          const user = await getOrCreateClerkUser(clerkUser);
          if (user && user.isActive) {
            req.user = user;
            req.clerkAuth = true;
          }
          return next();
        }
      }
      
      // Fallback to legacy JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fuelpro-secret-key');
      const user = User.findById(decoded.id);
      if (user && user.isActive) {
        req.user = user;
        req.clerkAuth = false;
      }
    } catch (error) {
      // Token invalid, continue without user
    }
  }

  next();
};

/**
 * Helper to generate a session token for Clerk users
 * (for hybrid mode where you want to issue your own JWT after Clerk auth)
 */
const generateAppToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET || 'fuelpro-secret-key',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

module.exports = { 
  protect, 
  authorize, 
  hasPermission, 
  optionalAuth,
  verifyClerkToken,
  generateAppToken,
  CLERK_FRONTEND_API
};
