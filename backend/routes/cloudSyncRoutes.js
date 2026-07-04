/**
 * Cloud Sync REST API Routes
 * FIXED: Added authentication and database persistence
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../database/sqlite');
const { protect, authorize } = require('../middleware/auth');

// Apply authentication to all routes (was completely open)
router.use(protect);

// Founder-only collections (secrets, users, config)
const founderOnlyCollections = ['secrets', 'users', 'config'];
router.use('/data/:collection', (req, res, next) => {
  const { collection } = req.params;
  if (founderOnlyCollections.includes(collection) && req.user.role !== 'founder') {
    return res.status(403).json({ 
      success: false, 
      error: 'Access denied. Founder role required.' 
    });
  }
  next();
});

// Helper to generate IDs
function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Database-based storage (FIXED: was in-memory)
function getCloudData(collection) {
  const db = getDb();
  try {
    const records = db.prepare(`
      SELECT * FROM cloud_data WHERE collection = ? ORDER BY updatedAt DESC
    `).all(collection);
    return records;
  } catch (error) {
    console.error('Error reading cloud data:', error);
    return [];
  }
}

function getCloudRecord(collection, id) {
  const db = getDb();
  try {
    return db.prepare(`
      SELECT * FROM cloud_data WHERE collection = ? AND id = ?
    `).get(collection, id);
  } catch (error) {
    console.error('Error reading cloud record:', error);
    return null;
  }
}

function saveCloudRecord(collection, id, data, userId = null) {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = getCloudRecord(collection, id);
  
  if (existing) {
    db.prepare(`
      UPDATE cloud_data SET data = ?, updatedAt = ?, updatedBy = ?
      WHERE collection = ? AND id = ?
    `).run(JSON.stringify(data), now, userId, collection, id);
  } else {
    db.prepare(`
      INSERT INTO cloud_data (id, collection, data, createdAt, updatedAt, updatedBy)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, collection, JSON.stringify(data), now, now, userId);
  }
  return { id, ...data };
}

function deleteCloudRecord(collection, id) {
  const db = getDb();
  try {
    db.prepare('DELETE FROM cloud_data WHERE collection = ? AND id = ?').run(collection, id);
  } catch (error) {
    console.error('Error deleting cloud record:', error);
  }
}

// Health check (public endpoint)
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'FuelPro Cloud Sync API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    auth: 'enabled'
  });
});

// List all records in a collection
router.get('/data/:collection', (req, res) => {
  const { collection } = req.params;
  const records = getCloudData(collection);
  
  res.json({
    success: true,
    collection,
    count: records.length,
    data: records.map(r => ({ ...r, data: JSON.parse(r.data) }))
  });
});

// Get single record
router.get('/data/:collection/:id', (req, res) => {
  const { collection, id } = req.params;
  const record = getCloudRecord(collection, id);
  
  if (!record) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }
  
  res.json({
    success: true,
    data: { ...record, data: JSON.parse(record.data) }
  });
});

// Create record
router.post('/data/:collection', (req, res) => {
  const { collection } = req.params;
  
  try {
    const body = req.body;
    const id = body.id || generateId(collection);
    delete body.id;
    
    const record = saveCloudRecord(collection, id, body, req.user?.id);
    
    res.status(201).json({
      success: true,
      id,
      data: record
    });
  } catch (err) {
    console.error('Cloud sync create error:', err);
    res.status(400).json({ success: false, error: 'Invalid request' });
  }
});

// Update record
router.put('/data/:collection/:id', (req, res) => {
  const { collection, id } = req.params;
  
  const existing = getCloudRecord(collection, id);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }
  
  try {
    const body = req.body;
    const existingData = JSON.parse(existing.data);
    const updatedData = { ...existingData, ...body };
    
    const record = saveCloudRecord(collection, id, updatedData, req.user?.id);
    
    res.json({
      success: true,
      data: record
    });
  } catch (err) {
    console.error('Cloud sync update error:', err);
    res.status(400).json({ success: false, error: 'Invalid request' });
  }
});

// Delete record
router.delete('/data/:collection/:id', (req, res) => {
  const { collection, id } = req.params;
  
  const existing = getCloudRecord(collection, id);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }
  
  deleteCloudRecord(collection, id);
  
  res.json({ success: true, message: 'Deleted' });
});

// Seed data (founder only)
router.post('/seed', authorize('founder'), (req, res) => {
  const seedData = {
    feature_flags: {
      name: 'Feature Flags',
      enabled: true,
      flags: {
        pos_system: true,
        mpesa_live: true,
        ai_chatbot: true
      }
    }
  };
  
  for (const [collection, data] of Object.entries(seedData)) {
    saveCloudRecord(collection, collection, data, req.user?.id);
  }
  
  res.json({ success: true, message: 'Seed data created' });
});

module.exports = router;
