const express = require('express');
const router = express.Router();
const Station = require('../models/Station');
const AuditLog = require('../models/AuditLog');
const { protect, authorize, optionalAuth } = require('../middleware/auth');

// 1. GET All Stations (with filters)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { status, ownerId, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (ownerId) query.ownerId = ownerId;

    // Non-authenticated users only see active stations
    if (!req.user) {
      query.status = 'active';
    }

    const allStations = Station.findAll(query);
    const total = allStations.length;

    // Manual pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const stations = allStations.slice(startIndex, endIndex);

    res.json({
      stations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. GET Single Station
router.get('/:id', async (req, res) => {
  try {
    const station = Station.findById(req.params.id);
    
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

    const owner = ownerId || req.user.id;

    const station = Station.create({
      name,
      location,
      ownerId: owner,
      ownerName: req.user.name,
      settings: settings || {}
    });

    await AuditLog.create({
      action: 'STATION_CREATED',
      detail: `Station "${name}" created`,
      user: req.user.email,
      userId: req.user.id,
      metadata: { stationId: station.id }
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
    
    const station = Station.findById(req.params.id);
    
    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (location) updateData.location = location;
    if (status) updateData.status = status;
    if (settings) updateData.settings = { ...station.settings, ...settings };
    if (stats) updateData.stats = { ...station.stats, ...stats };

    const updatedStation = Station.update(req.params.id, updateData);

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('station_updated', { stationId: updatedStation.id });

    res.json({ message: 'Station updated', station: updatedStation });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. DELETE Station (founder only)
router.delete('/:id', protect, authorize('founder'), async (req, res) => {
  try {
    const station = Station.findById(req.params.id);
    
    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }

    Station.delete(req.params.id);

    await AuditLog.create({
      action: 'STATION_DELETED',
      detail: `Station "${station.name}" deleted`,
      user: req.user.email,
      userId: req.user.id,
      metadata: { stationId: station.id }
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
    const station = Station.findById(req.params.id);
    
    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }

    const analytics = {
      stationId: station.id,
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
