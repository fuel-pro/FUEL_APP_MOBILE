const { db } = require('../database/sqlite');
const { v4: uuidv4 } = require('uuid');

class Content {
  static table = 'content';

  static create(data) {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO content (id, key, data, versionNumber, updatedBy, metadata, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      data.key,
      JSON.stringify(data.data),
      data.versionNumber || 1,
      data.updatedBy || null,
      JSON.stringify(data.metadata || { category: 'general', description: '', tags: [] }),
      now,
      now
    );
    
    return this.findById(id);
  }

  static findById(id) {
    const stmt = db.prepare(`SELECT * FROM content WHERE id = ?`);
    const row = stmt.get(id);
    return row ? this._parseRow(row) : null;
  }

  static findByKey(key) {
    const stmt = db.prepare(`SELECT * FROM content WHERE key = ?`);
    const row = stmt.get(key);
    return row ? this._parseRow(row) : null;
  }

  static findAll(query = {}) {
    let sql = `SELECT * FROM content WHERE 1=1`;
    const params = [];
    
    if (query.category) {
      sql += ` AND json_extract(metadata, '$.category') = ?`;
      params.push(query.category);
    }
    
    sql += ` ORDER BY updatedAt DESC`;
    
    const stmt = db.prepare(sql);
    const rows = stmt.all(...params);
    return rows.map(row => this._parseRow(row));
  }

  static update(id, data) {
    const now = new Date().toISOString();
    const current = this.findById(id);
    
    if (!current) return null;
    
    const newVersion = current.versionNumber + 1;
    
    const updates = [];
    const params = [];
    
    if (data.data !== undefined) {
      updates.push(`data = ?`);
      params.push(JSON.stringify(data.data));
    }
    if (data.key) {
      updates.push(`key = ?`);
      params.push(data.key);
    }
    if (data.updatedBy) {
      updates.push(`updatedBy = ?`);
      params.push(data.updatedBy);
    }
    if (data.metadata) {
      updates.push(`metadata = ?`);
      params.push(JSON.stringify(data.metadata));
    }
    
    updates.push(`versionNumber = ?`);
    params.push(newVersion);
    updates.push(`updatedAt = ?`);
    params.push(now);
    params.push(id);
    
    const sql = `UPDATE content SET ${updates.join(', ')} WHERE id = ?`;
    const stmt = db.prepare(sql);
    stmt.run(...params);
    
    return this.findById(id);
  }

  static delete(id) {
    const stmt = db.prepare(`DELETE FROM content WHERE id = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  static _parseRow(row) {
    if (!row) return null;
    return {
      ...row,
      data: JSON.parse(row.data || '{}'),
      metadata: JSON.parse(row.metadata || '{}')
    };
  }
}

module.exports = Content;
