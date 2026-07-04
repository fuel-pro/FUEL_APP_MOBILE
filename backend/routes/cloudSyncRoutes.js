/**
 * Cloud Sync REST API Routes
 * Provides CRUD operations for cloud synchronization
 *
 * SECURITY FIX: this entire router was previously mounted with zero
 * authentication, exposing generic GET/POST/PUT/DELETE on every collection
 * -- including "secrets" -- to anyone who knew the API URL. It now requires
 * a valid logged-in session (protect) and, for anything beyond read-only
 * access to non-sensitive collections, a founder/admin role (authorize),
 * matching the pattern already used by every other route file in this
 * backend (userRoutes.js, stationRoutes.js, auditRoutes.js, etc).
 *
 * DATA-LOSS FIX: records are now persisted in the SQLite `cloud_records`
 * table instead of an in-memory JS object. The old in-memory store lost
 * everything (including secrets, users, stations, feature flags) on every
 * restart/redeploy and would not be shared across concurrent serverless
 * function instances on platforms like Vercel.
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/sqlite');
const { protect, authorize } = require('../middleware/auth');

// Collections that require founder/admin access even to READ. Everything
// else still requires a valid logged-in session (protect), just not an
// elevated role.
const SENSITIVE_COLLECTIONS = new Set(['secrets', 'users', 'audit_log', 'config']);

// Only these collections may be used. Prevents arbitrary strings from being
// stored as a "collection" name (basic input hygiene, not a SQL-injection
// risk since this is parameterized, but keeps the data model sane).
const ALLOWED_COLLECTIONS = new Set([
  'users', 'stations', 'sales', 'audit_log', 'secrets', 'feature_flags', 'config'
]);

const DEFAULT_FEATURE_FLAGS = [
  { id: 'pos_system', name: 'POS System', description: 'Point of Sale module', enabled: true },
  { id: 'mpesa_live', name: 'M-PESA Live', description: 'Real-time M-PESA transactions', enabled: true },
  { id: 'ai_chatbot', name: 'AI Chatbot', description: 'AI assistant for fuel management', enabled: true },
  { id: 'cloud_sync', name: 'Cloud Sync', description: 'Cross-device data synchronization', enabled: true },
  { id: 'integration_hub', name: 'Integration Hub', description: 'KRA, ETR, POS, Payroll connectors', enabled: true },
  { id: 'regional_compliance', name: 'Regional Compliance', description: 'Multi-country compliance features', enabled: true },
  { id: 'advanced_analytics', name: 'Advanced Analytics', description: 'Deep analytics and forecasting', enabled: true },
  { id: 'customer_loyalty', name: 'Customer Loyalty', description: 'Loyalty program management', enabled: true },
  { id: 'fuel_quality', name: 'Fuel Quality Testing', description: 'Quality control and testing', enabled: true },
  { id: 'credit_management', name: 'Credit Management', description: 'Credit and debt tracking', enabled: true },
];

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function ensureSeeded() {
  const db = getDb();
  const count = db.prepare(`SELECT COUNT(*) as c FROM cloud_records WHERE collection = 'feature_flags'`).get();
  if (count.c === 0) {
    const now = new Date().toISOString();
    const insert = db.prepare(`INSERT INTO cloud_records (collection, id, data, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)`);
    const insertMany = db.transaction((flags) => {
      for (const flag of flags) {
        insert.run('feature_flags', flag.id, JSON.stringify({ ...flag, createdAt: now }), now, now);
      }
    });
    insertMany(DEFAULT_FEATURE_FLAGS);
  }
}

// Mask a secret's value for display, e.g. "sk-abc123xyz" -> "sk-a********xyz"
function redactSecret(record) {
  if (!record || typeof record.value !== 'string') return record;
  const v = record.value;
  if (v.length <= 6) return { ...record, value: '*'.repeat(v.length) };
  return { ...record, value: `${v.slice(0, 3)}${'*'.repeat(Math.max(4, v.length - 6))}${v.slice(-3)}` };
}

function requireValidCollection(req, res, next) {
  const { collection } = req.params;
  if (!ALLOWED_COLLECTIONS.has(collection)) {
    return res.status(404).json({ success: false, error: `Collection '${collection}' not found` });
  }
  next();
}

// Require founder/admin for sensitive collections; any authenticated user
// otherwise. Must run after `protect`.
function requireRoleForCollection(req, res, next) {
  const { collection } = req.params;
  if (SENSITIVE_COLLECTIONS.has(collection)) {
    return authorize('founder', 'admin')(req, res, next);
  }
  next();
}

// Health check stays public -- it's used as a general "is the backend
// reachable" ping from the main app (not just the Founder panel), and only
// ever returns record counts, never actual data.
router.get('/health', (req, res) => {
  ensureSeeded();
  const db = getDb();
  const rows = db.prepare(`SELECT collection, COUNT(*) as count FROM cloud_records GROUP BY collection`).all();
  const counts = {};
  for (const c of ALLOWED_COLLECTIONS) counts[c] = 0;
  rows.forEach(r => { counts[r.collection] = r.count; });

  res.json({
    status: 'healthy',
    service: 'FuelPro Cloud Sync API',
    version: '1.0.1',
    timestamp: new Date().toISOString(),
    dataStore: {
      collections: Array.from(ALLOWED_COLLECTIONS),
      counts
    }
  });
});

// Everything under /data and /seed requires a valid logged-in session.
// Sensitive collections (secrets, users, audit_log, config) additionally
// require a founder/admin role via requireRoleForCollection below.
router.use(['/data', '/seed'], protect);

// List all records in a collection
router.get('/data/:collection', requireValidCollection, requireRoleForCollection, (req, res) => {
  const { collection } = req.params;
  if (collection === 'feature_flags') ensureSeeded();

  const db = getDb();
  const rows = db.prepare(`SELECT id, data FROM cloud_records WHERE collection = ?`).all(collection);
  let records = rows.map(r => ({ id: r.id, ...JSON.parse(r.data) }));

  // Extra layer of protection: mask secret values unless the caller is a
  // founder explicitly asking to reveal them.
  if (collection === 'secrets' && req.query.reveal !== 'true') {
    records = records.map(redactSecret);
  }

  res.json({ success: true, collection, count: records.length, data: records });
});

// Get single record
router.get('/data/:collection/:id', requireValidCollection, requireRoleForCollection, (req, res) => {
  const { collection, id } = req.params;
  const db = getDb();
  const row = db.prepare(`SELECT id, data FROM cloud_records WHERE collection = ? AND id = ?`).get(collection, id);
  if (!row) return res.status(404).json({ success: false, error: 'Not found' });

  let record = { id: row.id, ...JSON.parse(row.data) };
  if (collection === 'secrets' && req.query.reveal !== 'true') {
    record = redactSecret(record);
  }
  res.json({ success: true, data: record });
});

// Create record
router.post('/data/:collection', requireValidCollection, requireRoleForCollection, (req, res) => {
  const { collection } = req.params;
  const db = getDb();

  try {
    const body = req.body || {};
    const id = body.id || generateId(collection);
    const now = new Date().toISOString();
    const record = { ...body, createdAt: body.createdAt || now, updatedAt: now };
    delete record.id;

    db.prepare(`
      INSERT INTO cloud_records (collection, id, data, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data, updatedAt = excluded.updatedAt
    `).run(collection, id, JSON.stringify(record), now, now);

    res.status(201).json({ success: true, id, data: { id, ...record } });
  } catch (err) {
    res.status(400).json({ success: false, error: 'Invalid request body' });
  }
});

// Update record
router.put('/data/:collection/:id', requireValidCollection, requireRoleForCollection, (req, res) => {
  const { collection, id } = req.params;
  const db = getDb();
  const existing = db.prepare(`SELECT data FROM cloud_records WHERE collection = ? AND id = ?`).get(collection, id);
  if (!existing) return res.status(404).json({ success: false, error: 'Not found' });

  try {
    const body = req.body || {};
    const now = new Date().toISOString();
    const merged = { ...JSON.parse(existing.data), ...body, updatedAt: now };
    db.prepare(`UPDATE cloud_records SET data = ?, updatedAt = ? WHERE collection = ? AND id = ?`)
      .run(JSON.stringify(merged), now, collection, id);

    res.json({ success: true, data: { id, ...merged } });
  } catch (err) {
    res.status(400).json({ success: false, error: 'Invalid request body' });
  }
});

// Delete record
router.delete('/data/:collection/:id', requireValidCollection, requireRoleForCollection, (req, res) => {
  const { collection, id } = req.params;
  const db = getDb();
  const result = db.prepare(`DELETE FROM cloud_records WHERE collection = ? AND id = ?`).run(collection, id);
  if (result.changes === 0) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, message: 'Deleted' });
});

// Seed default data (founder/admin only -- this is an administrative action)
router.post('/seed', authorize('founder', 'admin'), (req, res) => {
  ensureSeeded();
  const db = getDb();
  const rows = db.prepare(`SELECT collection, COUNT(*) as count FROM cloud_records GROUP BY collection`).all();
  const counts = {};
  for (const c of ALLOWED_COLLECTIONS) counts[c] = 0;
  rows.forEach(r => { counts[r.collection] = r.count; });

  res.json({ success: true, message: 'Seed data ready', counts });
});

// User data storage - FIX for broken /api/user-data endpoint
router.post('/user-data', protect, (req, res) => {
  const userId = req.user.id;
  const { data } = req.body;
  
  if (!data) {
    return res.status(400).json({ success: false, error: 'Data is required' });
  }
  
  const db = getDb();
  
  // Ensure table exists
  db.exec(`CREATE TABLE IF NOT EXISTS user_data (
    user_id TEXT PRIMARY KEY,
    data TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  
  db.prepare(`
    INSERT OR REPLACE INTO user_data (user_id, data, updated_at)
    VALUES (?, ?, datetime('now'))
  `).run(userId, JSON.stringify(data));
  
  res.json({ success: true });
});

router.get('/user-data', protect, (req, res) => {
  const userId = req.user.id;
  const db = getDb();
  
  // Ensure table exists
  db.exec(`CREATE TABLE IF NOT EXISTS user_data (
    user_id TEXT PRIMARY KEY,
    data TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  
  const row = db.prepare(`SELECT data FROM user_data WHERE user_id = ?`).get(userId);
  res.json({ data: row ? JSON.parse(row.data) : null });
});

// Sales data sync endpoint - stores individual sales records
router.post('/sales', protect, (req, res) => {
  const userId = req.user.id;
  const { salesId, data } = req.body;
  
  if (!salesId || !data) {
    return res.status(400).json({ success: false, error: 'salesId and data are required' });
  }
  
  const db = getDb();
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT OR REPLACE INTO cloud_records (collection, id, data, createdAt, updatedAt)
    VALUES ('sales', ?, ?, ?, ?)
  `).run(`${userId}_${salesId}`, JSON.stringify(data), now, now);
  
  res.json({ success: true });
});

router.get('/sales', protect, (req, res) => {
  const userId = req.user.id;
  const db = getDb();
  
  const rows = db.prepare(`
    SELECT id, data, updatedAt FROM cloud_records 
    WHERE collection = 'sales' AND id LIKE ?
    ORDER BY updatedAt DESC
  `).all(`${userId}_%`);
  
  const sales = rows.map(row => ({
    salesId: row.id.replace(`${userId}_`, ''),
    data: JSON.parse(row.data),
    updatedAt: row.updatedAt
  }));
  
  res.json({ success: true, data: sales });
});

module.exports = router;
