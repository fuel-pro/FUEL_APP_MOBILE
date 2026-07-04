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

// FIX: Enable foreign key enforcement (was disabled by default)
db.pragma('foreign_keys = ON');

// FIX: Set automatic WAL checkpointing to prevent unbounded growth
db.pragma('wal_autocheckpoint = 1000');

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

  // Add clerkUserId column if it doesn't exist
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
      totalSales REAL DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ownerId) REFERENCES users(id)
    )
  `);

  // Add totalSales column to stations if it doesn't exist
  try {
    db.exec(`ALTER TABLE stations ADD COLUMN totalSales REAL DEFAULT 0`);
  } catch (e) {
    // Column already exists, ignore
  }

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

  // Transactions table (M-PESA STK Push / B2C / manual payments)
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      checkout_request_id TEXT UNIQUE,
      merchant_request_id TEXT,
      station_id TEXT,
      user_id TEXT,
      phone_number TEXT,
      amount REAL,
      status TEXT DEFAULT 'PENDING',
      mpesa_receipt TEXT,
      payment_phone TEXT,
      payment_date TEXT,
      failure_reason TEXT,
      paid_at TEXT,
      failed_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (station_id) REFERENCES stations(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Generic persisted key/value store
  db.exec(`
    CREATE TABLE IF NOT EXISTS cloud_records (
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      data TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (collection, id)
    )
  `);

  // FIX: Add user_data table (previously created dynamically in routes)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_data (
      user_id TEXT PRIMARY KEY,
      data TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
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
    CREATE INDEX IF NOT EXISTS idx_transactions_checkout ON transactions(checkout_request_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
    CREATE INDEX IF NOT EXISTS idx_cloud_records_collection ON cloud_records(collection);
    CREATE INDEX IF NOT EXISTS idx_sessions_refresh ON sessions(refreshToken);
  `);

  console.log('✅ SQLite database initialized');
}

function getDb() {
  return db;
}

module.exports = { db, getDb, initializeDatabase };