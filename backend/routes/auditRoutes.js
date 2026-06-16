const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');

// 1. GET Audit Logs (with filters)
router.get('/', protect, authorize('founder', 'admin'), async (req, res) => {
  try {
    const { 
      event, 
      user, 
      severity, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 50 
    } = req.query;
    
    const query = {};
    
    if (event) query.event = { $regex: event, $options: 'i' };
    if (user) query.user = { $regex: user, $options: 'i' };
    if (severity) query.severity = severity;
    
    // Date range filter
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(query)
      .populate('userId', 'name email role')
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await AuditLog.countDocuments(query);

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. GET Single Audit Log Entry
router.get('/:id', protect, authorize('founder', 'admin'), async (req, res) => {
  try {
    const log = await AuditLog.findById(req.params.id)
      .populate('userId', 'name email role');
    
    if (!log) {
      return res.status(404).json({ error: 'Audit log not found' });
    }

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

    // Count by severity
    const bySeverity = await AuditLog.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      { $group: { _id: '$severity', count: { $sum: 1 } } }
    ]);

    // Count by event type
    const byEvent = await AuditLog.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      { $group: { _id: '$event', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Count by user
    const byUser = await AuditLog.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      { $group: { _id: '$user', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Daily activity
    const dailyActivity = await AuditLog.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Total count
    const totalCount = await AuditLog.countDocuments({ timestamp: { $gte: startDate } });

    res.json({
      summary: {
        period: `${days} days`,
        startDate: startDate.toISOString(),
        totalCount,
        bySeverity,
        byEvent,
        byUser,
        dailyActivity
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. CREATE Manual Audit Entry (for frontend use)
router.post('/', protect, async (req, res) => {
  try {
    const { event, detail, severity = 'info' } = req.body;

    if (!event || !detail) {
      return res.status(400).json({ error: 'Event and detail are required' });
    }

    const log = await AuditLog.create({
      event,
      detail,
      user: req.user.email,
      userId: req.user._id,
      severity,
      metadata: {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent']
      }
    });

    // Emit to connected admins
    const io = req.app.get('io');
    io.to('admin').to('founder').emit('audit_update', log);

    res.status(201).json({ message: 'Audit log created', log });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. EXPORT Audit Logs (CSV format)
router.get('/export/csv', protect, authorize('founder', 'admin'), async (req, res) => {
  try {
    const { startDate, endDate, event } = req.query;
    
    const query = {};
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    if (event) query.event = { $regex: event, $options: 'i' };

    const logs = await AuditLog.find(query)
      .populate('userId', 'name email role')
      .sort({ timestamp: -1 })
      .limit(10000);

    // Generate CSV
    const csvHeaders = 'Timestamp,Event,Detail,User,Role,Severity\n';
    const csvRows = logs.map(log => 
      `"${log.timestamp.toISOString()}","${log.event}","${log.detail.replace(/"/g, '""')}","${log.user}","${log.userId?.role || 'N/A'}","${log.severity}"`
    ).join('\n');

    const csv = csvHeaders + csvRows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
