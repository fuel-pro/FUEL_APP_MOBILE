const { db } = require('../database/sqlite');
const { v4: uuidv4 } = require('uuid');

class Station {
  static table = 'stations';

  static create(data) {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO stations (id, name, location, ownerId, ownerName, status, members, settings, stats, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      data.name,
      data.location,
      data.ownerId,
      data.ownerName || null,
      data.status || 'active',
      JSON.stringify(data.members || []),
      JSON.stringify(data.settings || { currency: 'USD', timezone: 'UTC', fuelTypes: [] }),
      JSON.stringify(data.stats || { totalSales: 0, totalRevenue: 0, totalTransactions: 0 }),
      now,
      now
    );
    
    return this.findById(id);
  }

  static findById(id) {
    const stmt = db.prepare(`SELECT * FROM stations WHERE id = ?`);
    const row = stmt.get(id);
    return row ? this._parseRow(row) : null;
  }

  static findByOwnerId(ownerId) {
    const stmt = db.prepare(`SELECT * FROM stations WHERE ownerId = ? ORDER BY createdAt DESC`);
    const rows = stmt.all(ownerId);
    return rows.map(row => this._parseRow(row));
  }

  static findAll(query = {}) {
    let sql = `SELECT * FROM stations WHERE 1=1`;
    const params = [];
    
    if (query.status) {
      sql += ` AND status = ?`;
      params.push(query.status);
    }
    
    sql += ` ORDER BY createdAt DESC`;
    
    const stmt = db.prepare(sql);
    const rows = stmt.all(...params);
    return rows.map(row => this._parseRow(row));
  }

  static update(id, data) {
    const now = new Date().toISOString();
    const updates = [];
    const params = [];
    
    if (data.name) {
      updates.push(`name = ?`);
      params.push(data.name);
    }
    if (data.location) {
      updates.push(`location = ?`);
      params.push(data.location);
    }
    if (data.ownerId) {
      updates.push(`ownerId = ?`);
      params.push(data.ownerId);
    }
    if (data.ownerName) {
      updates.push(`ownerName = ?`);
      params.push(data.ownerName);
    }
    if (data.status) {
      updates.push(`status = ?`);
      params.push(data.status);
    }
    if (data.members) {
      updates.push(`members = ?`);
      params.push(JSON.stringify(data.members));
    }
    if (data.settings) {
      updates.push(`settings = ?`);
      params.push(JSON.stringify(data.settings));
    }
    if (data.stats) {
      updates.push(`stats = ?`);
      params.push(JSON.stringify(data.stats));
    }
    
    updates.push(`updatedAt = ?`);
    params.push(now);
    params.push(id);
    
    const sql = `UPDATE stations SET ${updates.join(', ')} WHERE id = ?`;
    const stmt = db.prepare(sql);
    stmt.run(...params);
    
    return this.findById(id);
  }

  static delete(id) {
    const stmt = db.prepare(`DELETE FROM stations WHERE id = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  static _parseRow(row) {
    if (!row) return null;
    return {
      ...row,
      members: JSON.parse(row.members || '[]'),
      settings: JSON.parse(row.settings || '{}'),
      stats: JSON.parse(row.stats || '{}')
    };
  }
}

module.exports = Station;
