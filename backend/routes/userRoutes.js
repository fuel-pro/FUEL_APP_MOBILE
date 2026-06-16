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

    const allUsers = User.findAll(query);
    const total = allUsers.length;
    
    // Manual pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const users = allUsers.slice(startIndex, endIndex);

    res.json({
      users: users.map(u => u.toJSON()),
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

// 2. GET Single User
router.get('/:id', protect, authorize('founder', 'admin'), async (req, res) => {
  try {
    const user = User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: user.toJSON() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. UPDATE User
router.put('/:id', protect, authorize('founder', 'admin'), async (req, res) => {
  try {
    const { name, role, permissions, isActive } = req.body;
    
    const user = User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent founder from being demoted
    if (user.role === 'founder' && role && role !== 'founder') {
      return res.status(403).json({ error: 'Cannot demote founder account' });
    }

    const oldRole = user.role;
    
    // Update user
    const updateData = {};
    if (name) updateData.name = name;
    if (role) updateData.role = role;
    if (permissions) updateData.permissions = permissions;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    const updatedUser = await User.update(req.params.id, updateData);

    // Log change
    await AuditLog.create({
      action: 'USER_UPDATED',
      detail: `User ${user.email} updated by ${req.user.email}`,
      user: req.user.email,
      userId: req.user.id,
      metadata: {
        targetUserId: user.id,
        changes: { oldRole, newRole: role }
      }
    });

    res.json({ message: 'User updated', user: updatedUser.toJSON() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. DELETE User (soft delete)
router.delete('/:id', protect, authorize('founder'), async (req, res) => {
  try {
    const user = User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'founder') {
      return res.status(403).json({ error: 'Cannot delete founder account' });
    }

    await User.update(req.params.id, { isActive: false });

    await AuditLog.create({
      action: 'USER_DELETED',
      detail: `User ${user.email} deactivated by ${req.user.email}`,
      user: req.user.email,
      userId: req.user.id,
      metadata: { targetUserId: user.id }
    });

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. GET User Login History
router.get('/:id/login-history', protect, authorize('founder', 'admin'), async (req, res) => {
  try {
    const user = User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ loginHistory: user.loginHistory || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
