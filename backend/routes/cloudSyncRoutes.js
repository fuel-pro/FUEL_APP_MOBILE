/**
 * Cloud Sync REST API Routes
 * Provides CRUD operations for cloud synchronization
 */

const express = require('express');
const router = express.Router();

// In-memory data store (in production, use the existing SQLite database)
const dataStore = {
  users: {},
  stations: {},
  sales: {},
  audit_log: {},
  secrets: {},
  feature_flags: {},
  config: {}
};

// Helper to generate IDs
function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Initialize default feature flags
dataStore.feature_flags = {
  pos_system: { id: 'pos_system', name: 'POS System', description: 'Point of Sale module', enabled: true, createdAt: new Date().toISOString() },
  mpesa_live: { id: 'mpesa_live', name: 'M-PESA Live', description: 'Real-time M-PESA transactions', enabled: true, createdAt: new Date().toISOString() },
  ai_chatbot: { id: 'ai_chatbot', name: 'AI Chatbot', description: 'AI assistant for fuel management', enabled: true, createdAt: new Date().toISOString() },
  cloud_sync: { id: 'cloud_sync', name: 'Cloud Sync', description: 'Cross-device data synchronization', enabled: true, createdAt: new Date().toISOString() },
  integration_hub: { id: 'integration_hub', name: 'Integration Hub', description: 'KRA, ETR, POS, Payroll connectors', enabled: true, createdAt: new Date().toISOString() },
  regional_compliance: { id: 'regional_compliance', name: 'Regional Compliance', description: 'Multi-country compliance features', enabled: true, createdAt: new Date().toISOString() },
  advanced_analytics: { id: 'advanced_analytics', name: 'Advanced Analytics', description: 'Deep analytics and forecasting', enabled: true, createdAt: new Date().toISOString() },
  customer_loyalty: { id: 'customer_loyalty', name: 'Customer Loyalty', description: 'Loyalty program management', enabled: true, createdAt: new Date().toISOString() },
  fuel_quality: { id: 'fuel_quality', name: 'Fuel Quality Testing', description: 'Quality control and testing', enabled: true, createdAt: new Date().toISOString() },
  credit_management: { id: 'credit_management', name: 'Credit Management', description: 'Credit and debt tracking', enabled: true, createdAt: new Date().toISOString() }
};

// Health check
router.get('/health', (req, res) => {
  const counts = {};
  for (const [key, value] of Object.entries(dataStore)) {
    counts[key] = Object.keys(value).length;
  }
  
  res.json({
    status: 'healthy',
    service: 'FuelPro Cloud Sync API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    dataStore: {
      collections: Object.keys(dataStore),
      counts
    }
  });
});

// List all records in a collection
router.get('/data/:collection', (req, res) => {
  const { collection } = req.params;
  
  if (!dataStore[collection]) {
    return res.status(404).json({ success: false, error: `Collection '${collection}' not found` });
  }
  
  const records = Object.entries(dataStore[collection]).map(([id, record]) => ({
    id,
    ...record
  }));
  
  res.json({
    success: true,
    collection,
    count: records.length,
    data: records
  });
});

// Get single record
router.get('/data/:collection/:id', (req, res) => {
  const { collection, id } = req.params;
  
  if (!dataStore[collection] || !dataStore[collection][id]) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }
  
  res.json({
    success: true,
    data: { id, ...dataStore[collection][id] }
  });
});

// Create record
router.post('/data/:collection', (req, res) => {
  const { collection } = req.params;
  
  if (!dataStore[collection]) {
    dataStore[collection] = {};
  }
  
  try {
    const body = req.body;
    const id = body.id || generateId(collection);
    const record = {
      ...body,
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    delete record.id;
    dataStore[collection][id] = record;
    
    res.status(201).json({
      success: true,
      id,
      data: { id, ...record }
    });
  } catch (err) {
    res.status(400).json({ success: false, error: 'Invalid JSON body' });
  }
});

// Update record
router.put('/data/:collection/:id', (req, res) => {
  const { collection, id } = req.params;
  
  if (!dataStore[collection] || !dataStore[collection][id]) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }
  
  try {
    const body = req.body;
    dataStore[collection][id] = {
      ...dataStore[collection][id],
      ...body,
      updatedAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: { id, ...dataStore[collection][id] }
    });
  } catch (err) {
    res.status(400).json({ success: false, error: 'Invalid JSON body' });
  }
});

// Delete record
router.delete('/data/:collection/:id', (req, res) => {
  const { collection, id } = req.params;
  
  if (!dataStore[collection] || !dataStore[collection][id]) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }
  
  delete dataStore[collection][id];
  
  res.json({ success: true, message: 'Deleted' });
});

// Seed data
router.post('/seed', (req, res) => {
  const counts = {};
  for (const [key, value] of Object.entries(dataStore)) {
    counts[key] = Object.keys(value).length;
  }
  
  res.json({
    success: true,
    message: 'Seed data ready',
    counts
  });
});

module.exports = router;
