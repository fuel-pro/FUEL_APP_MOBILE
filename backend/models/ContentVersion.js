const { db } = require('../database/sqlite');
const { v4: uuidv4 } = require('uuid');

class ContentVersion {
  static table = 'content_versions';

  static create(data) {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO content_versions (id, contentId, data, versionNumber, changedBy, changedAt, changeDescription)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      data.contentId || data.contentKey,
      JSON.stringify(data.data),
      data.versionNumber,
      data.changedBy || data.createdBy || null,
      now,
      data.note || data.changeDescription || 'Manual update'
    );
    
    return this.findById(id);
  }

  static findById(id) {
    const stmt = db.prepare(`SELECT * FROM content_versions WHERE id = ?`);
    const row = stmt.get(id);
    return row ? this._parseRow(row) : null;
  }

  static findByContentId(contentId) {
    const stmt = db.prepare(`SELECT * FROM content_versions WHERE contentId = ? ORDER BY versionNumber DESC`);
    const rows = stmt.all(contentId);
    return rows.map(row => this._parseRow(row));
  }

  static findByVersion(contentId, versionNumber) {
    const stmt = db.prepare(`SELECT * FROM content_versions WHERE contentId = ? AND versionNumber = ?`);
    const row = stmt.get(contentId, versionNumber);
    return row ? this._parseRow(row) : null;
  }

  static _parseRow(row) {
    if (!row) return null;
    return {
      ...row,
      data: JSON.parse(row.data || '{}')
    };
  }
}

module.exports = ContentVersion;
