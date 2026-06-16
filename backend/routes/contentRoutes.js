const express = require('express');
const router = express.Router();
const Content = require('../models/Content');
const ContentVersion = require('../models/ContentVersion');
const AuditLog = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');

// Helper function to log audit
const logAudit = async (io, action, detail, severity = 'info', user = null, metadata = {}) => {
  const entry = {
    action,
    detail,
    user: user?.name || user?.email || 'System',
    userId: user?.id,
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
    const contents = Content.findAll();
    res.json({ contents });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. GET Active Content by Key
router.get('/:key', async (req, res) => {
  try {
    const content = Content.findByKey(req.params.key);
    
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
    const versions = ContentVersion.findByContentId(req.params.key);
    res.json({ versions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. GET Specific Version by ID
router.get('/:key/versions/:versionId', protect, authorize('founder', 'admin'), async (req, res) => {
  try {
    const version = ContentVersion.findById(req.params.versionId);
    
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
    let currentContent = Content.findByKey(key);
    const oldData = currentContent ? currentContent.data : null;

    // Step B: If exists, save OLD data to Version History before overwriting
    if (currentContent) {
      await ContentVersion.create({
        contentId: key,
        data: oldData,
        versionNumber: currentContent.versionNumber,
        changedBy: req.user.id,
        changeDescription: note || 'Auto-saved before update'
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
    
    let updatedContent;
    if (currentContent) {
      updatedContent = Content.update(currentContent.id, {
        data,
        versionNumber: newVersionNumber,
        updatedBy: req.user.id,
        metadata: metadata || currentContent.metadata
      });
    } else {
      updatedContent = Content.create({
        key,
        data,
        versionNumber: newVersionNumber,
        updatedBy: req.user.id,
        metadata: metadata || {}
      });
    }

    // Step D: Save the NEW state as current version
    await ContentVersion.create({
      contentId: key,
      data: data,
      versionNumber: newVersionNumber,
      changedBy: req.user.id,
      changeDescription: note || 'Updated content'
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
    const targetVersion = ContentVersion.findById(versionId);
    if (!targetVersion) {
      return res.status(404).json({ message: 'Version not found' });
    }

    // Step B: Get current active content to save it as a new version (Prevents data loss)
    const currentContent = Content.findByKey(key);
    if (currentContent) {
      await ContentVersion.create({
        contentId: key,
        data: currentContent.data,
        versionNumber: currentContent.versionNumber,
        changedBy: req.user.id,
        changeDescription: 'Auto-saved before rollback'
      });
    }

    // Step C: Update content with the target version's data
    const newVersionNumber = currentContent ? currentContent.versionNumber + 1 : 1;
    const rolledBackContent = currentContent 
      ? Content.update(currentContent.id, {
          data: targetVersion.data,
          versionNumber: newVersionNumber,
          updatedBy: req.user.id
        })
      : Content.create({
          key,
          data: targetVersion.data,
          versionNumber: newVersionNumber,
          updatedBy: req.user.id
        });

    // Save rollback action as version
    await ContentVersion.create({
      contentId: key,
      data: targetVersion.data,
      versionNumber: newVersionNumber,
      changedBy: req.user.id,
      changeDescription: `Rolled back to version ${targetVersion.versionNumber}`
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

// 7. DELETE Content
router.delete('/:key', protect, authorize('founder'), async (req, res) => {
  try {
    const io = req.app.get('io');
    const { key } = req.params;

    const content = Content.findByKey(key);
    
    if (!content) {
      return res.status(404).json({ message: 'Content not found' });
    }

    // Save deletion as version
    await ContentVersion.create({
      contentId: key,
      data: content.data,
      versionNumber: content.versionNumber + 1,
      changedBy: req.user.id,
      changeDescription: 'Content deleted'
    });

    Content.delete(content.id);

    await logAudit(
      io,
      'CONTENT_DELETED',
      `Content "${key}" deleted by ${req.user.name}`,
      'info',
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
      let currentContent = Content.findByKey(key);
      
      // Save old state
      if (currentContent) {
        await ContentVersion.create({
          contentId: key,
          data: currentContent.data,
          versionNumber: currentContent.versionNumber,
          changedBy: req.user.id,
          changeDescription: 'Auto-saved before bulk update'
        });
      }

      // Update content
      const newVersion = currentContent ? currentContent.versionNumber + 1 : 1;
      let updated;
      if (currentContent) {
        updated = Content.update(currentContent.id, {
          data,
          versionNumber: newVersion,
          updatedBy: req.user.id
        });
      } else {
        updated = Content.create({
          key,
          data,
          versionNumber: newVersion,
          updatedBy: req.user.id
        });
      }

      // Save new state
      await ContentVersion.create({
        contentId: key,
        data: data,
        versionNumber: newVersion,
        changedBy: req.user.id,
        changeDescription: note || 'Bulk update'
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
