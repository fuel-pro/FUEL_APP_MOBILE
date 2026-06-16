const mongoose = require('mongoose');

const ContentVersionSchema = new mongoose.Schema({
  contentKey: { 
    type: String, 
    required: true,
    index: true
  },
  data: { 
    type: mongoose.Schema.Types.Mixed, 
    required: true 
  },
  versionNumber: { 
    type: Number, 
    required: true 
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  createdByName: { type: String, default: 'System' },
  note: { 
    type: String, 
    default: 'Manual update' 
  },
  action: { 
    type: String, 
    enum: ['create', 'update', 'rollback', 'delete', 'initial'],
    default: 'update'
  },
  snapshot: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Compound index for efficient version lookups
ContentVersionSchema.index({ contentKey: 1, versionNumber: -1 });

module.exports = mongoose.model('ContentVersion', ContentVersionSchema);
