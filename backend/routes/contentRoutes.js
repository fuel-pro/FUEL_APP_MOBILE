const express = require('express');
const router = express.Router();
const Content = require('../models/Content');
const ContentVersion = require('../models/ContentVersion');
const AuditLog = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');

// Helper function to log audit
const logAudit = async (io, event, detail, severity = 'info', user = null, metadata = {}) => {
  const entry = {
    event,
    detail,
    user: user?.name || user?.email || 'System',
    userId: user?._id,
    severity,
    metadata
  };
  
  await AuditLog.create(entry);
  
  // Emit to connected admins
  if (io) {
    io.to('admin').to('founder').emit('audit_update', entry);
  }
};

// 1. GET All Content Keys (for admin panel listing)
router.get('/', protect, authorize('founder', 'admin', 'developer'), async (req, res) => {
  try {
    const contents = await Content.find()
      .select('key versionNumber metadata updatedAt updatedBy')
      .sort({ updatedAt: -1 });
    
    res.json({ contents });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. GET Active Content by Key
router.get('/:key', async (req, res) => {
  try {
    const content = await Content.findOne({ key: req.params.key });
    
    if (!content) {
      return res.status(404).json({ message: 'Content not found' });
    }
    
    res.json(content);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. GET Version History for a Content Key
router.get('/:key/versions', protect, authorize('founder', 'admin', 'developer'), async (req, res) => {
  try {
    const versions = await ContentVersion.find({ contentKey: req.params.key })
      .sort({ versionNumber: -1 })
      .populate('createdBy', 'name email role');
    
    res.json({ versions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. GET Specific Version by ID
router.get('/:key/versions/:versionId', protect, authorize('founder', 'admin'), async (req, res) => {
  try {
    const version = await ContentVersion.findById(req.params.versionId)
      .populate('createdBy', 'name email role');
    
    if (!version) {
      return res.status(404).json({ message: 'Version not found' });
    }
    
    res.json(version);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. CREATE or UPDATE Content (Auto-Versioning)
router.put('/:key', protect, authorize('founder', 'admin', 'developer'), async (req, res) => {
  try {
    const io = req.app.get('io');
    const { key } = req.params;
    const { data, note, metadata } = req.body;

    // Step A: Find current content
    let currentContent = await Content.findOne({ key });
    const oldData = currentContent ? currentContent.data : null;

    // Step B: If exists, save OLD data to Version History before overwriting
    if (currentContent) {
      await ContentVersion.create({
        contentKey: key,
        data: oldData,
        versionNumber: currentContent.versionNumber,
        createdBy: req.user._id,
        createdByName: req.user.name,
        note: note || 'Auto-saved before update',
        action: 'update',
        snapshot: false
      });
      
      await logAudit(
        io,
        'CONTENT_UPDATE',
        `Content "${key}" updated from v${currentContent.versionNumber}`,
        'info',
        req.user,
        { key, oldVersion: currentContent.versionNumber }
      );
    }

    // Step C: Update the active content with NEW data
    const newVersionNumber = currentContent ? currentContent.versionNumber + 1 : 1;
    
    const updatedContent = await Content.findOneAndUpdate(
      { key },
      { 
        data, 
        versionNumber: newVersionNumber, 
        updatedBy: req.user._id,
        updatedAt: new Date(),
        ...(metadata && { metadata })
      },
      { new: true, upsert: true }
    );

    // Step D: Save the NEW state as current version
    await ContentVersion.create({
      contentKey: key,
      data: data,
      versionNumber: newVersionNumber,
      createdBy: req.user._id,
      createdByName: req.user.name,
      note: note || 'Updated content',
      action: 'update',
      snapshot: true
    });

    // Step E: Emit Real-Time Event to Frontend
    io.emit('content_updated', { 
      key, 
      version: newVersionNumber,
      updatedBy: req.user.name 
    });

    res.json({ 
      message: 'Content updated and version saved', 
      content: updatedContent 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. ROLLBACK to a Specific Version
router.post('/:key/rollback/:versionId', protect, authorize('founder', 'admin'), async (req, res) => {
  try {
    const io = req.app.get('io');
    const { key, versionId } = req.params;

    // Step A: Find the version we want to rollback to
    const targetVersion = await ContentVersion.findById(versionId);
    if (!targetVersion) {
      return res.status(404).json({ message: 'Version not found' });
    }

    // Step B: Get current active content to save it as a new version (Prevents data loss)
    const currentContent = await Content.findOne({ key });
    if (currentContent) {
      await ContentVersion.create({
        contentKey: key,
        data: currentContent.data,
        versionNumber: currentContent.versionNumber,
        createdBy: req.user._id,
        createdByName: req.user.name,
        note: 'Auto-saved before rollback',
        action: 'rollback'
      });
    }

    // Step C: Overwrite active content with the target version's data
    const newVersionNumber = currentContent ? currentContent.versionNumber + 1 : 1;
    const rolledBackContent = await Content.findOneAndUpdate(
      { key },
      { 
        data: targetVersion.data, 
        versionNumber: newVersionNumber, 
        updatedBy: req.user._id,
        updatedAt: new Date()
      },
      { new: true, upsert: true }
    );

    // Save rollback action as version
    await ContentVersion.create({
      contentKey: key,
      data: targetVersion.data,
      versionNumber: newVersionNumber,
      createdBy: req.user._id,
      createdByName: req.user.name,
      note: `Rolled back to version ${targetVersion.versionNumber}`,
      action: 'rollback'
    });

    // Step D: Log and Emit Real-Time Event
    await logAudit(
      io,
      'CONTENT_ROLLBACK',
      `Content "${key}" rolled back from v${currentContent?.versionNumber || 1} to v${targetVersion.versionNumber}`,
      'warning',
      req.user,
      { key, targetVersion: targetVersion.versionNumber, newVersion: newVersionNumber }
    );

    io.emit('content_updated', { 
      key, 
      version: newVersionNumber, 
      action: 'rollback',
      rolledBackTo: targetVersion.versionNumber
    });

    res.json({ 
      message: `Successfully rolled back to version ${targetVersion.versionNumber}`, 
      content: rolledBackContent 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. DELETE Content (Soft delete - marks as deleted)
router.delete('/:key', protect, authorize('founder'), async (req, res) => {
  try {
    const io = req.app.get('io');
    const { key } = req.params;

    const content = await Content.findOneAndDelete({ key });
    
    if (!content) {
      return res.status(404).json({ message: 'Content not found' });
    }

    // Save deletion as version
    await ContentVersion.create({
      contentKey: key,
      data: content.data,
      versionNumber: content.versionNumber + 1,
      createdBy: req.user._id,
      createdByName: req.user.name,
      note: 'Content deleted',
      action: 'delete'
    });

    await logAudit(
      io,
      'CONTENT_DELETED',
      `Content "${key}" deleted by ${req.user.name}`,
      'danger',
      req.user,
      { key }
    );

    io.emit('content_deleted', { key });

    res.json({ message: 'Content deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. BULK UPDATE (Update multiple content items at once)
router.post('/bulk/update', protect, authorize('founder', 'admin'), async (req, res) => {
  try {
    const io = req.app.get('io');
    const { updates } = req.body; // Array of { key, data, note }

    const results = [];
    
    for (const update of updates) {
      const { key, data, note } = update;
      let currentContent = await Content.findOne({ key });
      
      // Save old state
      if (currentContent) {
        await ContentVersion.create({
          contentKey: key,
          data: currentContent.data,
          versionNumber: currentContent.versionNumber,
          createdBy: req.user._id,
          createdByName: req.user.name,
          note: 'Auto-saved before bulk update',
          action: 'update'
        });
      }

      // Update content
      const newVersion = currentContent ? currentContent.versionNumber + 1 : 1;
      const updated = await Content.findOneAndUpdate(
        { key },
        { data, versionNumber: newVersion, updatedBy: req.user._id, updatedAt: new Date() },
        { new: true, upsert: true }
      );

      // Save new state
      await ContentVersion.create({
        contentKey: key,
        data: data,
        versionNumber: newVersion,
        createdBy: req.user._id,
        createdByName: req.user.name,
        note: note || 'Bulk update',
        action: 'update'
      });

      results.push({ key, version: newVersion });
      
      io.emit('content_updated', { key, version: newVersion });
    }

    await logAudit(
      io,
      'CONTENT_BULK_UPDATE',
      `Bulk updated ${updates.length} content items`,
      'info',
      req.user
    );

    res.json({ message: `Updated ${results.length} items`, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
