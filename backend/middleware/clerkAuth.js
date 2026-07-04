/**
 * Clerk Authentication Middleware
 * Verifies Clerk JWT tokens and maps Clerk users to app users
 */
const jwt = require('jsonwebtoken');
const jose = require('jose');
const User = require('../models/User');

// Clerk configuration - MUST be set via environment variables
const CLERK_FRONTEND_API = process.env.CLERK_FRONTEND_API;
const CLERK_API_KEY = process.env.CLERK_SECRET_KEY;

// Validate Clerk configuration on load
if (!CLERK_FRONTEND_API) {
  console.warn('⚠️ CLERK_FRONTEND_API not set. Clerk authentication will be disabled.');
}

const CLERK_JWKS_URL = CLERK_FRONTEND_API ? `${CLERK_FRONTEND_API}/.well-known/jwks.json` : null;

// Cache for JWKS
let jwksCache = null;
let jwksCacheExpiry = 0;
const JWKS_CACHE_TTL = 3600000; // 1 hour

/**
 * Fetch and cache JWKS from Clerk
 */
async function getJWKS() {
  if (!CLERK_JWKS_URL) {
    throw new Error('Clerk is not configured');
  }

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
  let user = User.findByEmail(clerkUser.email_addresses?.[0]?.email_address);

  if (!user) {
    try {
      const crypto = require('crypto');
      user = await User.create({
        email: clerkUser.email_addresses?.[0]?.email_address || `clerk_${clerkUser.id}@clerk.local`,
        password: `clerk_${clerkUser.id}_placeholder_${crypto.randomBytes(16).toString('hex')}`,
        name: clerkUser.first_name && clerkUser.last_name 
          ? `${clerkUser.first_name} ${clerkUser.last_name}`
          : clerkUser.first_name || clerkUser.username || 'Clerk User',
        role: 'user',
        permissions: ['read'],
        clerkUserId: clerkUser.id,
        isActive: true,
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
 * Detect if a token is a Clerk token by checking the issuer claim
 */
function detectClerkToken(token) {
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || !decoded.payload) return false;

    const iss = decoded.payload.iss;
    return iss && (iss.includes('clerk') || iss.includes('clerk.accounts.dev'));
  } catch {
    return false;
  }
}

/**
 * Middleware: Protect route - verify Clerk JWT token
 */
const protect = async (req, res, next) => {
  let token;
  let authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authorized, no token provided' });
  }

  try {
    const isClerkToken = detectClerkToken(token);

    if (isClerkToken) {
      console.log('Verifying Clerk JWT token...');
      const payload = await verifyClerkToken(token);

      if (payload) {
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

        req.user = user;
        req.clerkAuth = true;
        req.clerkUserId = payload.sub;
        return next();
      }
    }

    // Fallback: Try legacy JWT verification
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({ error: 'Server misconfiguration: JWT_SECRET not set' });
    }

    const decoded = jwt.verify(token, jwtSecret);
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

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Role '${req.user.role}' is not authorized`,
        requiredRoles: roles
      });
    }
    next();
  };
};

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

const optionalAuth = async (req, res, next) => {
  let token;
  let authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (token) {
    try {
      if (detectClerkToken(token)) {
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

      const jwtSecret = process.env.JWT_SECRET;
      if (jwtSecret) {
        const decoded = jwt.verify(token, jwtSecret);
        const user = User.findById(decoded.id);
        if (user && user.isActive) {
          req.user = user;
          req.clerkAuth = false;
        }
      }
    } catch (error) {
      // Token invalid, continue without user
    }
  }
  next();
};

/**
 * FAIL-SECURE: Throws if JWT_SECRET is not set - NEVER falls back to hardcoded secret
 */
const generateAppToken = (userId) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return jwt.sign(
    { id: userId },
    jwtSecret,
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