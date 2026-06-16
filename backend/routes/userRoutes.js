const express = require('express');
const router = express.Router();
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');

// 1. GET All Users (admin only)
router.get('/', protect, authorize('founder', 'admin'), async (req, res) => {
  try {
    const { role, isActive, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const users = await User.find(query)
      .select('-password -twoFactorSecret')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
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

// 2. GET Single User
router.get('/:id', protect, authorize('founder', 'admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -twoFactorSecret');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. UPDATE User
router.put('/:id', protect, authorize('founder', 'admin'), async (req, res) => {
  try {
    const { name, role, permissions, isActive } = req.body;
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent founder from being demoted
    if (user.role === 'founder' && role && role !== 'founder') {
      return res.status(403).json({ error: 'Cannot demote founder account' });
    }

    const oldRole = user.role;
    
    if (name) user.name = name;
    if (role) user.role = role;
    if (permissions) user.permissions = permissions;
    if (isActive !== undefined) user.isActive = isActive;
    
    await user.save();

    // Log change
    await AuditLog.create({
      event: 'USER_UPDATED',
      detail: `User ${user.email} updated by ${req.user.email}`,
      user: req.user.email,
      userId: req.user._id,
      severity: 'info',
      metadata: {
        targetUserId: user._id,
        changes: { oldRole, newRole: role }
      }
    });

    res.json({ message: 'User updated', user: user.toJSON() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. DELETE User (soft delete)
router.delete('/:id', protect, authorize('founder'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'founder') {
      return res.status(403).json({ error: 'Cannot delete founder account' });
    }

    user.isActive = false;
    await user.save();

    await AuditLog.create({
      event: 'USER_DELETED',
      detail: `User ${user.email} deactivated by ${req.user.email}`,
      user: req.user.email,
      userId: req.user._id,
      severity: 'warning',
      metadata: { targetUserId: user._id }
    });

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. GET User Login History
router.get('/:id/login-history', protect, authorize('founder', 'admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ loginHistory: user.loginHistory });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
