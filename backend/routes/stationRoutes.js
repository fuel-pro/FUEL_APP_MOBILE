const express = require('express');
const router = express.Router();
const Station = require('../models/Station');
const AuditLog = require('../models/AuditLog');
const { protect, authorize, optionalAuth } = require('../middleware/auth');

// 1. GET All Stations (with filters)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { status, ownerId, page = 1, limit = 20, sortBy = 'createdAt', order = 'desc' } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (ownerId) query.ownerId = ownerId;

    // Non-authenticated users only see active stations
    if (!req.user) {
      query.status = 'active';
    }

    const sortObj = { [sortBy]: order === 'desc' ? -1 : 1 };

    const stations = await Station.find(query)
      .populate('ownerId', 'name email')
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Station.countDocuments(query);

    res.json({
      stations,
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

// 2. GET Single Station
router.get('/:id', async (req, res) => {
  try {
    const station = await Station.findById(req.params.id)
      .populate('ownerId', 'name email')
      .populate('members', 'name email role');
    
    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }

    res.json({ station });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. CREATE Station (founder/admin only)
router.post('/', protect, authorize('founder', 'admin'), async (req, res) => {
  try {
    const { name, location, ownerId, settings } = req.body;

    if (!name || !location) {
      return res.status(400).json({ error: 'Name and location are required' });
    }

    const owner = ownerId || req.user._id;

    const station = await Station.create({
      name,
      location,
      ownerId: owner,
      ownerName: req.user.name,
      settings: settings || {}
    });

    await AuditLog.create({
      event: 'STATION_CREATED',
      detail: `Station "${name}" created`,
      user: req.user.email,
      userId: req.user._id,
      severity: 'success',
      metadata: { stationId: station._id }
    });

    res.status(201).json({ message: 'Station created', station });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. UPDATE Station
router.put('/:id', protect, authorize('founder', 'admin'), async (req, res) => {
  try {
    const { name, location, status, settings, stats } = req.body;
    
    const station = await Station.findById(req.params.id);
    
    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }

    if (name) station.name = name;
    if (location) station.location = location;
    if (status) station.status = status;
    if (settings) station.settings = { ...station.settings, ...settings };
    if (stats) station.stats = { ...station.stats, ...stats };
    
    await station.save();

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('station_updated', { stationId: station._id });

    res.json({ message: 'Station updated', station });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. DELETE Station (founder only)
router.delete('/:id', protect, authorize('founder'), async (req, res) => {
  try {
    const station = await Station.findByIdAndDelete(req.params.id);
    
    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }

    await AuditLog.create({
      event: 'STATION_DELETED',
      detail: `Station "${station.name}" deleted`,
      user: req.user.email,
      userId: req.user._id,
      severity: 'danger',
      metadata: { stationId: station._id }
    });

    res.json({ message: 'Station deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. GET Station Analytics (with date range)
router.get('/:id/analytics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const station = await Station.findById(req.params.id);
    
    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }

    // Build date filter
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    // For now, return the station stats
    // In production, you'd aggregate transaction data
    const analytics = {
      stationId: station._id,
      stationName: station.name,
      stats: station.stats,
      dateRange: { startDate, endDate },
      period: startDate && endDate 
        ? Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))
        : null
    };

    res.json({ analytics });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
