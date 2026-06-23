/**
 * Clerk Webhook Routes
 * Handles Clerk webhook events for user sync
 * 
 * Set up webhooks in Clerk Dashboard:
 * 1. Go to Clerk Dashboard → Webhooks
 * 2. Add Endpoint: https://your-backend-url/api/clerk/webhook
 * 3. Subscribe to events: user.created, user.updated, user.deleted
 * 4. Copy webhook signing secret to CLERK_WEBHOOK_SECRET env var
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

/**
 * Verify Clerk webhook signature
 */
function verifyWebhookSignature(req) {
  if (!CLERK_WEBHOOK_SECRET) {
    console.warn('CLERK_WEBHOOK_SECRET not set - skipping webhook verification');
    return true; // Skip verification in development
  }

  const signature = req.headers['clerk-signature'];
  if (!signature) {
    return false;
  }

  const timestamp = req.headers['svix-timestamp'];
  const payload = req.body;
  
  if (!timestamp || !payload) {
    return false;
  }

  // Verify timestamp to prevent replay attacks (5 min tolerance)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    console.error('Webhook timestamp out of range');
    return false;
  }

  // Compute expected signature
  const toSign = `${timestamp}.${JSON.stringify(payload)}`;
  const secretBytes = Buffer.from(CLERK_WEBHOOK_SECRET, 'utf8');
  const toSignBytes = Buffer.from(toSign, 'utf8');
  
  const computedSignature = crypto
    .createHmac('sha256', secretBytes)
    .update(toSignBytes)
    .digest('hex');

  const receivedSignature = signature.startsWith('v1=') 
    ? signature.slice(3) 
    : signature;

  return crypto.timingSafeEqual(
    Buffer.from(computedSignature, 'hex'),
    Buffer.from(receivedSignature, 'hex')
  );
}

/**
 * Handle user.created event
 */
async function handleUserCreated(data) {
  const { id, email_addresses, first_name, last_name, username, public_metadata } = data;
  const email = email_addresses?.[0]?.email_address;
  
  console.log(`Clerk: Creating user ${email} (${id})`);
  
  try {
    // Check if user already exists
    let user = email ? User.findByEmail(email) : null;
    
    if (user) {
      // Update existing user with Clerk ID
      await User.update(user.id, {
        clerkUserId: id,
        name: user.name || `${first_name || ''} ${last_name || ''}`.trim() || username || 'Clerk User',
      });
      console.log(`Clerk: Linked existing user ${user.id} to Clerk user ${id}`);
    } else {
      // Create new user
      user = await User.create({
        email: email || `clerk_${id}@clerk.local`,
        password: `clerk_${id}_placeholder`,
        name: `${first_name || ''} ${last_name || ''}`.trim() || username || 'Clerk User',
        role: public_metadata?.role || 'user',
        permissions: public_metadata?.permissions || ['read'],
        clerkUserId: id,
        isActive: true,
      });
      console.log(`Clerk: Created new user ${user.id} for Clerk user ${id}`);
    }

    await AuditLog.create({
      action: 'CLERK_USER_CREATED',
      detail: `Clerk user created: ${email || id}`,
      user: email || id,
      metadata: { clerkUserId: id },
    });

    return user;
  } catch (error) {
    console.error('Clerk user.created handler error:', error.message);
    throw error;
  }
}

/**
 * Handle user.updated event
 */
async function handleUserUpdated(data) {
  const { id, email_addresses, first_name, last_name, username, public_metadata, updated_at } = data;
  const email = email_addresses?.[0]?.email_address;
  
  console.log(`Clerk: Updating user ${email || id}`);
  
  try {
    // Find user by Clerk ID
    let user = User.findAll().find(u => u.clerkUserId === id);
    
    // Also try by email
    if (!user && email) {
      user = User.findByEmail(email);
    }
    
    if (!user) {
      console.warn(`Clerk: User not found for update: ${id}`);
      // Try to create instead
      return handleUserCreated(data);
    }

    const updates = {};
    if (first_name || last_name) {
      updates.name = `${first_name || ''} ${last_name || ''}`.trim();
    }
    if (public_metadata?.role) {
      updates.role = public_metadata.role;
    }
    if (public_metadata?.permissions) {
      updates.permissions = public_metadata.permissions;
    }
    if (email) {
      updates.email = email;
    }

    if (Object.keys(updates).length > 0) {
      await User.update(user.id, updates);
      console.log(`Clerk: Updated user ${user.id} with Clerk data`);
    }

    await AuditLog.create({
      action: 'CLERK_USER_UPDATED',
      detail: `Clerk user updated: ${email || id}`,
      user: user.email,
      userId: user.id,
      metadata: { clerkUserId: id, updates },
    });

    return user;
  } catch (error) {
    console.error('Clerk user.updated handler error:', error.message);
    throw error;
  }
}

/**
 * Handle user.deleted event
 */
async function handleUserDeleted(data) {
  const { id } = data;
  
  console.log(`Clerk: Deleting/deactivating user ${id}`);
  
  try {
    // Find user by Clerk ID
    let user = User.findAll().find(u => u.clerkUserId === id);
    
    if (!user) {
      console.warn(`Clerk: User not found for deletion: ${id}`);
      return null;
    }

    // Deactivate instead of delete to preserve audit trail
    await User.update(user.id, {
      isActive: false,
      clerkUserId: null, // Unlink Clerk account
    });

    await AuditLog.create({
      action: 'CLERK_USER_DELETED',
      detail: `Clerk user deleted: ${user.email}`,
      user: user.email,
      userId: user.id,
      metadata: { clerkUserId: id },
    });

    console.log(`Clerk: Deactivated user ${user.id}`);
    return user;
  } catch (error) {
    console.error('Clerk user.deleted handler error:', error.message);
    throw error;
  }
}

/**
 * POST /api/clerk/webhook
 * Main webhook endpoint
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Verify signature
    if (!verifyWebhookSignature(req)) {
      console.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { type, data } = req.body;
    
    console.log(`Clerk webhook received: ${type}`);

    switch (type) {
      case 'user.created':
        await handleUserCreated(data);
        break;
        
      case 'user.updated':
        await handleUserUpdated(data);
        break;
        
      case 'user.deleted':
        await handleUserDeleted(data);
        break;
        
      default:
        console.log(`Unhandled webhook type: ${type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * POST /api/clerk/sync-user
 * Manual sync endpoint (for testing or manual triggers)
 */
router.post('/sync-user', async (req, res) => {
  try {
    const { clerk_user_id, email } = req.body;
    
    // In production, use Clerk API to fetch user
    // For now, just acknowledge the request
    res.json({
      message: 'User sync acknowledged',
      clerk_user_id,
      email,
      note: 'Configure CLERK_SECRET_KEY to enable auto-sync'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/clerk/jwks
 * Expose JWKS for frontend token verification (optional)
 */
router.get('/jwks', async (req, res) => {
  try {
    const CLERK_FRONTEND_API = process.env.CLERK_FRONTEND_API || 'https://immense-mullet-70.clerk.accounts.dev';
    const response = await fetch(`${CLERK_FRONTEND_API}/.well-known/jwks.json`);
    const jwks = await response.json();
    res.json(jwks);
  } catch (error) {
    console.error('Failed to fetch JWKS:', error);
    res.status(500).json({ error: 'Failed to fetch JWKS' });
  }
});

module.exports = router;
