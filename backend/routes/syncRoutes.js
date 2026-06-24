const express = require('express');
const router = express.Router();
const { db } = require('../database/sqlite');
const crypto = require('crypto');

// Generate UUID
function generateId() {
  return crypto.randomUUID();
}

// Calculate checksum for data integrity
function calculateChecksum(data) {
  return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
}

// Middleware to verify JWT token
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.split(' ')[1];
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// GET /api/sync/status - Get sync status for user
router.get('/status', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get storage preferences
    const prefs = db.prepare(`
      SELECT * FROM user_storage_preferences WHERE userId = ?
    `).get(userId);
    
    // Get devices
    const devices = db.prepare(`
      SELECT * FROM user_devices WHERE userId = ? AND isActive = 1
    `).all(userId);
    
    // Get sync metadata count
    const syncMetaCount = db.prepare(`
      SELECT COUNT(*) as count FROM cloud_sync_meta WHERE userId = ?
    `).get(userId);
    
    res.json({
      syncEnabled: prefs?.syncEnabled ?? true,
      storeLocally: prefs?.storeLocally ?? false,
      autoSyncInterval: prefs?.autoSyncInterval ?? 30000,
      syncOnWifiOnly: prefs?.syncOnWifiOnly ?? false,
      lastSyncAt: prefs?.lastSyncAt ?? null,
      deviceCount: devices.length,
      devices: devices.map(d => ({
        deviceId: d.deviceId,
        deviceName: d.deviceName,
        deviceType: d.deviceType,
        lastSeenAt: d.lastSeenAt
      })),
      syncedDataCount: syncMetaCount.count
    });
  } catch (err) {
    console.error('Sync status error:', err);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

// GET /api/sync/preferences - Get user storage preferences
router.get('/preferences', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    
    let prefs = db.prepare(`
      SELECT * FROM user_storage_preferences WHERE userId = ?
    `).get(userId);
    
    // Create default preferences if not exists
    if (!prefs) {
      const id = generateId();
      db.prepare(`
        INSERT INTO user_storage_preferences (id, userId, storeLocally, syncEnabled, autoSyncInterval, syncOnWifiOnly)
        VALUES (?, ?, 0, 1, 30000, 0)
      `).run(id, userId);
      
      prefs = db.prepare(`SELECT * FROM user_storage_preferences WHERE userId = ?`).get(userId);
    }
    
    res.json({
      storeLocally: Boolean(prefs.storeLocally),
      syncEnabled: Boolean(prefs.syncEnabled),
      autoSyncInterval: prefs.autoSyncInterval,
      syncOnWifiOnly: Boolean(prefs.syncOnWifiOnly),
      lastSyncAt: prefs.lastSyncAt
    });
  } catch (err) {
    console.error('Get preferences error:', err);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

// PUT /api/sync/preferences - Update user storage preferences
router.put('/preferences', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const { storeLocally, syncEnabled, autoSyncInterval, syncOnWifiOnly } = req.body;
    
    // Get or create preferences
    let prefs = db.prepare(`SELECT * FROM user_storage_preferences WHERE userId = ?`).get(userId);
    
    if (!prefs) {
      const id = generateId();
      db.prepare(`
        INSERT INTO user_storage_preferences (id, userId, storeLocally, syncEnabled, autoSyncInterval, syncOnWifiOnly)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, userId, storeLocally ? 1 : 0, syncEnabled ? 1 : 0, autoSyncInterval || 30000, syncOnWifiOnly ? 1 : 0);
    } else {
      db.prepare(`
        UPDATE user_storage_preferences 
        SET storeLocally = ?, syncEnabled = ?, autoSyncInterval = ?, syncOnWifiOnly = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE userId = ?
      `).run(
        storeLocally !== undefined ? (storeLocally ? 1 : 0) : prefs.storeLocally,
        syncEnabled !== undefined ? (syncEnabled ? 1 : 0) : prefs.syncEnabled,
        autoSyncInterval || prefs.autoSyncInterval,
        syncOnWifiOnly !== undefined ? (syncOnWifiOnly ? 1 : 0) : prefs.syncOnWifiOnly,
        userId
      );
    }
    
    res.json({ success: true, message: 'Preferences updated' });
  } catch (err) {
    console.error('Update preferences error:', err);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// POST /api/sync/register-device - Register a new device
router.post('/register-device', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const { deviceId, deviceName, deviceType } = req.body;
    
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }
    
    // Update or insert device
    const existing = db.prepare(`SELECT * FROM user_devices WHERE userId = ? AND deviceId = ?`).get(userId, deviceId);
    
    if (existing) {
      db.prepare(`
        UPDATE user_devices SET lastSeenAt = CURRENT_TIMESTAMP, isActive = 1 WHERE userId = ? AND deviceId = ?
      `).run(userId, deviceId);
    } else {
      const id = generateId();
      db.prepare(`
        INSERT INTO user_devices (id, userId, deviceId, deviceName, deviceType)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, userId, deviceId, deviceName || 'Unknown', deviceType || 'unknown');
    }
    
    res.json({ success: true, message: 'Device registered' });
  } catch (err) {
    console.error('Register device error:', err);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

// GET /api/sync/devices - Get user's registered devices
router.get('/devices', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    
    const devices = db.prepare(`
      SELECT * FROM user_devices WHERE userId = ? AND isActive = 1
    `).all(userId);
    
    res.json({ devices });
  } catch (err) {
    console.error('Get devices error:', err);
    res.status(500).json({ error: 'Failed to get devices' });
  }
});

// DELETE /api/sync/devices/:deviceId - Remove a device
router.delete('/devices/:deviceId', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const { deviceId } = req.params;
    
    db.prepare(`
      UPDATE user_devices SET isActive = 0 WHERE userId = ? AND deviceId = ?
    `).run(userId, deviceId);
    
    res.json({ success: true, message: 'Device removed' });
  } catch (err) {
    console.error('Remove device error:', err);
    res.status(500).json({ error: 'Failed to remove device' });
  }
});

// POST /api/sync/push - Push data to cloud (create or update)
router.post('/push', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const { dataKey, dataType, data, version, deviceId } = req.body;
    
    if (!dataKey || !data) {
      return res.status(400).json({ error: 'dataKey and data are required' });
    }
    
    const checksum = calculateChecksum(data);
    const now = new Date().toISOString();
    
    // Get existing sync meta
    const existing = db.prepare(`
      SELECT * FROM cloud_sync_meta WHERE userId = ? AND dataKey = ?
    `).get(userId, dataKey);
    
    // Check for conflicts (if version provided and doesn't match)
    let conflict = null;
    if (existing && version !== undefined && version < existing.version) {
      conflict = {
        serverVersion: existing.version,
        clientVersion: version,
        serverData: existing.lastModified,
        serverChecksum: existing.checksum
      };
      
      // If forcePush is set, overwrite; otherwise return conflict
      if (!req.body.forcePush) {
        return res.status(409).json({
          error: 'Version conflict',
          conflict,
          serverData: req.body.conflictResolution === 'server' ? data : null
        });
      }
    }
    
    const newVersion = existing ? existing.version + 1 : 1;
    
    if (existing) {
      // Update existing
      db.prepare(`
        UPDATE cloud_sync_meta 
        SET version = ?, checksum = ?, lastModified = ?, syncedAt = ?, deviceId = ?
        WHERE userId = ? AND dataKey = ?
      `).run(newVersion, checksum, now, now, deviceId, userId, dataKey);
    } else {
      // Insert new
      const id = generateId();
      db.prepare(`
        INSERT INTO cloud_sync_meta (id, userId, dataKey, dataType, version, checksum, lastModified, syncedAt, deviceId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, userId, dataKey, dataType || 'unknown', newVersion, checksum, now, now, deviceId);
    }
    
    // Update user's last sync time
    db.prepare(`
      UPDATE user_storage_preferences SET lastSyncAt = ? WHERE userId = ?
    `).run(now, userId);
    
    res.json({
      success: true,
      version: newVersion,
      checksum,
      syncedAt: now,
      conflictResolved: conflict ? true : false
    });
  } catch (err) {
    console.error('Push sync error:', err);
    res.status(500).json({ error: 'Failed to push data' });
  }
});

// POST /api/sync/push-bulk - Push multiple data items at once
router.post('/push-bulk', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const { items, deviceId, forcePush } = req.body;
    
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'items array is required' });
    }
    
    const results = [];
    const now = new Date().toISOString();
    
    for (const item of items) {
      const { dataKey, dataType, data, version } = item;
      if (!dataKey || !data) continue;
      
      const checksum = calculateChecksum(data);
      
      const existing = db.prepare(`
        SELECT * FROM cloud_sync_meta WHERE userId = ? AND dataKey = ?
      `).get(userId, dataKey);
      
      let conflict = null;
      if (existing && version !== undefined && version < existing.version) {
        conflict = {
          dataKey,
          serverVersion: existing.version,
          clientVersion: version
        };
        
        if (!forcePush) {
          results.push({ dataKey, success: false, error: 'Version conflict', conflict });
          continue;
        }
      }
      
      const newVersion = existing ? existing.version + 1 : 1;
      
      if (existing) {
        db.prepare(`
          UPDATE cloud_sync_meta 
          SET version = ?, checksum = ?, lastModified = ?, syncedAt = ?, deviceId = ?
          WHERE userId = ? AND dataKey = ?
        `).run(newVersion, checksum, now, now, deviceId, userId, dataKey);
      } else {
        const id = generateId();
        db.prepare(`
          INSERT INTO cloud_sync_meta (id, userId, dataKey, dataType, version, checksum, lastModified, syncedAt, deviceId)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, userId, dataKey, dataType || 'unknown', newVersion, checksum, now, now, deviceId);
      }
      
      results.push({ dataKey, success: true, version: newVersion });
    }
    
    // Update user's last sync time
    db.prepare(`
      UPDATE user_storage_preferences SET lastSyncAt = ? WHERE userId = ?
    `).run(now, userId);
    
    res.json({ success: true, results, syncedAt: now });
  } catch (err) {
    console.error('Bulk push sync error:', err);
    res.status(500).json({ error: 'Failed to push data' });
  }
});

// GET /api/sync/pull - Pull data from cloud
router.get('/pull', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const { keys, since, dataType } = req.query;
    
    let query = 'SELECT * FROM cloud_sync_meta WHERE userId = ?';
    const params = [userId];
    
    // Filter by specific keys
    if (keys) {
      const keyArray = keys.split(',');
      query += ` AND dataKey IN (${keyArray.map(() => '?').join(',')})`;
      params.push(...keyArray);
    }
    
    // Filter by data type
    if (dataType) {
      query += ' AND dataType = ?';
      params.push(dataType);
    }
    
    // Filter by modified since
    if (since) {
      query += ' AND lastModified > ?';
      params.push(since);
    }
    
    query += ' ORDER BY lastModified ASC';
    
    const syncMeta = db.prepare(query).all(...params);
    
    res.json({
      items: syncMeta.map(m => ({
        dataKey: m.dataKey,
        dataType: m.dataType,
        version: m.version,
        checksum: m.checksum,
        lastModified: m.lastModified
      })),
      pulledAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Pull sync error:', err);
    res.status(500).json({ error: 'Failed to pull data' });
  }
});

// GET /api/sync/pull/:dataKey - Pull specific data item
router.get('/pull/:dataKey', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const { dataKey } = req.params;
    const { version } = req.query;
    
    const syncMeta = db.prepare(`
      SELECT * FROM cloud_sync_meta WHERE userId = ? AND dataKey = ?
    `).get(userId, dataKey);
    
    if (!syncMeta) {
      return res.status(404).json({ error: 'Data not found' });
    }
    
    // Check if client has latest version
    if (version && parseInt(version) >= syncMeta.version) {
      return res.json({
        dataKey,
        version: syncMeta.version,
        upToDate: true,
        lastModified: syncMeta.lastModified
      });
    }
    
    // Return the sync metadata (actual data is stored separately)
    // For full data retrieval, use the content table or a dedicated data table
    res.json({
      dataKey: syncMeta.dataKey,
      dataType: syncMeta.dataType,
      version: syncMeta.version,
      checksum: syncMeta.checksum,
      lastModified: syncMeta.lastModified,
      syncedAt: syncMeta.syncedAt,
      deviceId: syncMeta.deviceId
    });
  } catch (err) {
    console.error('Pull single error:', err);
    res.status(500).json({ error: 'Failed to pull data' });
  }
});

// GET /api/sync/changes - Get all changes since timestamp (for delta sync)
router.get('/changes', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const { since, dataType } = req.query;
    
    let query = 'SELECT * FROM cloud_sync_meta WHERE userId = ?';
    const params = [userId];
    
    if (since) {
      query += ' AND lastModified > ?';
      params.push(since);
    }
    
    if (dataType) {
      query += ' AND dataType = ?';
      params.push(dataType);
    }
    
    query += ' ORDER BY lastModified ASC';
    
    const changes = db.prepare(query).all(...params);
    
    // Get deleted items (we track deletions separately)
    const deleted = db.prepare(`
      SELECT * FROM cloud_sync_meta WHERE userId = ? AND lastModified > ? AND syncedAt IS NULL
    `).all(userId, since || '1970-01-01');
    
    res.json({
      changes: changes.map(c => ({
        dataKey: c.dataKey,
        dataType: c.dataType,
        version: c.version,
        lastModified: c.lastModified,
        action: c.syncedAt ? 'update' : 'delete'
      })),
      deletedKeys: deleted.map(d => d.dataKey),
      syncTimestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Get changes error:', err);
    res.status(500).json({ error: 'Failed to get changes' });
  }
});

// DELETE /api/sync/data/:dataKey - Delete data from cloud
router.delete('/data/:dataKey', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const { dataKey } = req.params;
    
    // Soft delete - mark as deleted
    db.prepare(`
      UPDATE cloud_sync_meta SET syncedAt = NULL, lastModified = ? WHERE userId = ? AND dataKey = ?
    `).run(new Date().toISOString(), userId, dataKey);
    
    res.json({ success: true, message: 'Data deleted from cloud' });
  } catch (err) {
    console.error('Delete sync data error:', err);
    res.status(500).json({ error: 'Failed to delete data' });
  }
});

module.exports = router;
