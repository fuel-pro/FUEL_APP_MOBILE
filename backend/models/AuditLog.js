const { db } = require('../database/sqlite');
const { v4: uuidv4 } = require('uuid');

class AuditLog {
  static table = 'audit_logs';

  static create(data) {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO audit_logs (id, userId, action, resourceType, resourceId, details, ipAddress, userAgent, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      data.userId || null,
      data.action || data.event,
      data.resourceType || null,
      data.resourceId || null,
      JSON.stringify(data.details || data.metadata || {}),
      data.ipAddress || data.metadata?.ip || null,
      data.userAgent || data.metadata?.userAgent || null,
      data.timestamp || now
    );
    
    return this.findById(id);
  }

  static findById(id) {
    const stmt = db.prepare(`SELECT * FROM audit_logs WHERE id = ?`);
    const row = stmt.get(id);
    return row ? this._parseRow(row) : null;
  }

  static findAll(query = {}) {
    let sql = `SELECT * FROM audit_logs WHERE 1=1`;
    const params = [];
    
    if (query.userId) {
      sql += ` AND userId = ?`;
      params.push(query.userId);
    }
    
    if (query.action) {
      sql += ` AND action = ?`;
      params.push(query.action);
    }
    
    if (query.resourceType) {
      sql += ` AND resourceType = ?`;
      params.push(query.resourceType);
    }
    
    if (query.startDate) {
      sql += ` AND timestamp >= ?`;
      params.push(query.startDate);
    }
    
    if (query.endDate) {
      sql += ` AND timestamp <= ?`;
      params.push(query.endDate);
    }
    
    sql += ` ORDER BY timestamp DESC`;
    
    if (query.limit) {
      sql += ` LIMIT ?`;
      params.push(query.limit);
    }
    
    const stmt = db.prepare(sql);
    const rows = stmt.all(...params);
    return rows.map(row => this._parseRow(row));
  }

  static _parseRow(row) {
    if (!row) return null;
    return {
      ...row,
      details: JSON.parse(row.details || '{}'),
      metadata: JSON.parse(row.details || '{}')
    };
  }
}

module.exports = AuditLog;
