const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');

// 1. GET Audit Logs (with filters)
router.get('/', protect, authorize('founder', 'admin'), async (req, res) => {
  try {
    const { action, user, resourceType, startDate, endDate, page = 1, limit = 50 } = req.query;
    
    const query = {};
    if (action) query.action = action;
    if (user) query.user = user;
    if (resourceType) query.resourceType = resourceType;
    if (startDate) query.startDate = startDate;
    if (endDate) query.endDate = endDate;
    
    const allLogs = AuditLog.findAll(query);
    const total = allLogs.length;

    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const logs = allLogs.slice(startIndex, endIndex);

    res.json({
      logs,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. GET Single Audit Log Entry
router.get('/:id', protect, authorize('founder', 'admin'), async (req, res) => {
  try {
    const log = AuditLog.findById(req.params.id);
    if (!log) return res.status(404).json({ error: 'Audit log not found' });
    res.json({ log });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. GET Audit Summary/Stats
router.get('/stats/summary', protect, authorize('founder', 'admin'), async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    const allLogs = AuditLog.findAll({ startDate: startDate.toISOString() });

    const actionCounts = {};
    allLogs.forEach(log => {
      const act = log.action || 'UNKNOWN';
      actionCounts[act] = (actionCounts[act] || 0) + 1;
    });
    
    const byAction = Object.entries(actionCounts).map(([action, count]) => ({ _id: action, count }))
      .sort((a, b) => b.count - a.count).slice(0, 10);

    const userCounts = {};
    allLogs.forEach(log => {
      const u = log.user || 'Unknown';
      userCounts[u] = (userCounts[u] || 0) + 1;
    });
    const byUser = Object.entries(userCounts).map(([user, count]) => ({ _id: user, count }))
      .sort((a, b) => b.count - a.count).slice(0, 10);

    res.json({ summary: { period: `${days} days`, totalCount: allLogs.length, byAction, byUser } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. CREATE Manual Audit Entry
router.post('/', protect, async (req, res) => {
  try {
    const { action, detail, metadata = {} } = req.body;
    if (!action || !detail) return res.status(400).json({ error: 'Action and detail are required' });

    const log = await AuditLog.create({
      action, detail, user: req.user.email, userId: req.user.id,
      metadata: { ...metadata, ip: req.ip, userAgent: req.headers['user-agent'] }
    });

    const io = req.app.get('io');
    io.to('admin').to('founder').emit('audit_update', log);

    res.status(201).json({ message: 'Audit log created', log });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. EXPORT Audit Logs (CSV)
router.get('/export/csv', protect, authorize('founder', 'admin'), async (req, res) => {
  try {
    const { startDate, endDate, action } = req.query;
    const query = {};
    if (startDate) query.startDate = startDate;
    if (endDate) query.endDate = endDate;
    if (action) query.action = action;

    const logs = AuditLog.findAll(query);
    const csvHeaders = 'Timestamp,Action,Detail,User\n';
    const csvRows = logs.map(log => `"${log.timestamp}","${log.action}","${(log.detail || '').replace(/"/g, '""')}","${log.user}"`).join('\n');
    const csv = csvHeaders + csvRows;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
