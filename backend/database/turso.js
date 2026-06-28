/**
 * Turso Database Adapter for FuelPro
 * 
 * This provides a unified database interface that works with both:
 * - SQLite (local/development)
 * - Turso (cloud/production)
 */

const Database = require('better-sqlite3');
const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');

// Determine which database to use
const USE_TURSO = process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN;

let db = null;
let isTurso = false;

function initializeDatabase() {
  if (db) return db;

  if (USE_TURSO) {
    console.log('📦 Connecting to Turso database...');
    
    const tursoClient = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    
    isTurso = true;
    db = {
      client: tursoClient,
      
      // Unified interface for Turso
      exec: async (sql) => {
        return await tursoClient.executeMultiple(sql);
      },
      
      prepare: (sql) => ({
        run: async (...params) => {
          const result = await tursoClient.execute({
            sql,
            args: params,
          });
          return { 
            changes: result.rowsAffected,
            lastInsertRowid: result.lastInsertRowid,
          };
        },
        get: async (...params) => {
          const result = await tursoClient.execute({
            sql,
            args: params,
          });
          return result.rows[0] || null;
        },
        all: async (...params) => {
          const result = await tursoClient.execute({
            sql,
            args: params,
          });
          return result.rows;
        },
      }),
      
      close: async () => {
        // Turso client doesn't need explicit closing
      },
    };
    
    // Initialize schema
    initializeSchema();
    
    console.log('✅ Connected to Turso database');
  } else {
    console.log('📦 Using SQLite database...');
    
    // SQLite fallback
    const DB_PATH = process.env.NODE_ENV === 'production'
      ? path.join(process.cwd(), 'data', 'fuelpro.db')
      : path.join(__dirname, '..', 'data', 'fuelpro.db');
    
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    
    isTurso = false;
    
    // Initialize schema
    initializeSchema();
    
    console.log('✅ SQLite database initialized at:', DB_PATH);
  }
  
  return db;
}

function getDb() {
  if (!db) {
    initializeDatabase();
  }
  return db;
}

function initializeSchema() {
  const schema = `
    -- Users table
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
    );
    
    -- Add clerkUserId column if not exists
    PRAGMA journal_mode=WAL;
    
    -- Stations table
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
    );
    
    -- Sales table
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      stationId TEXT NOT NULL,
      userId TEXT,
      fuelType TEXT NOT NULL,
      quantity REAL NOT NULL,
      pricePerUnit REAL NOT NULL,
      total REAL NOT NULL,
      paymentMethod TEXT DEFAULT 'cash',
      mpesaCode TEXT,
      pumpNumber INTEGER,
      nozzleNumber INTEGER,
      meterBefore REAL,
      meterAfter REAL,
      customerName TEXT,
      customerPhone TEXT,
      notes TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (stationId) REFERENCES stations(id),
      FOREIGN KEY (userId) REFERENCES users(id)
    );
    
    -- Audit log table
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      event TEXT NOT NULL,
      detail TEXT,
      user TEXT,
      severity TEXT DEFAULT 'info',
      ip TEXT,
      userAgent TEXT,
      stationId TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Feature flags table
    CREATE TABLE IF NOT EXISTS feature_flags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      enabled INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Config table
    CREATE TABLE IF NOT EXISTS config (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      description TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Secrets table
    CREATE TABLE IF NOT EXISTS secrets (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  try {
    if (isTurso) {
      db.exec(schema);
    } else {
      db.exec(schema);
    }
    console.log('✅ Database schema initialized');
  } catch (error) {
    console.error('⚠️ Schema initialization warning:', error.message);
  }
}

module.exports = {
  initializeDatabase,
  getDb,
  isTurso: () => isTurso,
};
