const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Database path - use /tmp for serverless/ephemeral, or ./data for persistent
const DB_PATH = process.env.NODE_ENV === 'production' 
  ? path.join(process.cwd(), 'data', 'fuel-app.db')
  : path.join(__dirname, '..', 'data', 'fuel-app.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Initialize database schema
function initializeDatabase() {
  console.log('📦 Initializing SQLite database...');
  
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      permissions TEXT DEFAULT '[]',
      isActive INTEGER DEFAULT 1,
      lastLoginAt TEXT,
      lastLoginIp TEXT,
      loginHistory TEXT DEFAULT '[]',
      twoFactorEnabled INTEGER DEFAULT 0,
      twoFactorSecret TEXT,
      clerkUserId TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add clerkUserId column if it doesn't exist (for existing databases)
  try {
    db.exec(`ALTER TABLE users ADD COLUMN clerkUserId TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Stations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS stations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      ownerId TEXT NOT NULL,
      ownerName TEXT,
      status TEXT DEFAULT 'active',
      members TEXT DEFAULT '[]',
      settings TEXT DEFAULT '{}',
      stats TEXT DEFAULT '{}',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ownerId) REFERENCES users(id)
    )
  `);

  // Content table
  db.exec(`
    CREATE TABLE IF NOT EXISTS content (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      data TEXT NOT NULL,
      versionNumber INTEGER DEFAULT 1,
      updatedBy TEXT,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT DEFAULT '{}',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (updatedBy) REFERENCES users(id)
    )
  `);

  // Content versions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS content_versions (
      id TEXT PRIMARY KEY,
      contentId TEXT NOT NULL,
      data TEXT NOT NULL,
      versionNumber INTEGER NOT NULL,
      changedBy TEXT,
      changedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      changeDescription TEXT,
      FOREIGN KEY (contentId) REFERENCES content(id),
      FOREIGN KEY (changedBy) REFERENCES users(id)
    )
  `);

  // Audit logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      userId TEXT,
      action TEXT NOT NULL,
      resourceType TEXT,
      resourceId TEXT,
      details TEXT DEFAULT '{}',
      ipAddress TEXT,
      userAgent TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  // Sessions table for JWT refresh tokens
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      refreshToken TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  // User storage preferences (for controlling local vs cloud storage)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_storage_preferences (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL UNIQUE,
      storeLocally INTEGER DEFAULT 0,
      syncEnabled INTEGER DEFAULT 1,
      autoSyncInterval INTEGER DEFAULT 30000,
      syncOnWifiOnly INTEGER DEFAULT 0,
      lastSyncAt TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  // Cloud sync metadata for tracking data changes
  db.exec(`
    CREATE TABLE IF NOT EXISTS cloud_sync_meta (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      dataKey TEXT NOT NULL,
      dataType TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      checksum TEXT,
      lastModified TEXT DEFAULT CURRENT_TIMESTAMP,
      syncedAt TEXT,
      deviceId TEXT,
      FOREIGN KEY (userId) REFERENCES users(id),
      UNIQUE(userId, dataKey)
    )
  `);

  // Device registrations for multi-device sync
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_devices (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      deviceId TEXT NOT NULL,
      deviceName TEXT,
      deviceType TEXT,
      lastSeenAt TEXT DEFAULT CURRENT_TIMESTAMP,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id),
      UNIQUE(userId, deviceId)
    )
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_clerkUserId ON users(clerkUserId);
    CREATE INDEX IF NOT EXISTS idx_stations_ownerId ON stations(ownerId);
    CREATE INDEX IF NOT EXISTS idx_stations_status ON stations(status);
    CREATE INDEX IF NOT EXISTS idx_content_key ON content(key);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_userId ON audit_logs(userId);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_cloud_sync_meta_userId ON cloud_sync_meta(userId);
    CREATE INDEX IF NOT EXISTS idx_cloud_sync_meta_dataKey ON cloud_sync_meta(dataKey);
    CREATE INDEX IF NOT EXISTS idx_user_devices_userId ON user_devices(userId);
  `);

  console.log('✅ SQLite database initialized');
}

module.exports = { db, initializeDatabase };
