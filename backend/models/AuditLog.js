const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  event: { 
    type: String, 
    required: true,
    index: true
  },
  detail: { 
    type: String, 
    required: true 
  },
  user: { 
    type: String, 
    required: true,
    index: true
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  severity: { 
    type: String, 
    enum: ['success', 'warning', 'danger', 'info'],
    default: 'info'
  },
  metadata: {
    ip: String,
    userAgent: String,
    resourceType: String,
    resourceId: String,
    previousValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed
  },
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true
  }
}, {
  timestamps: false // We use our own timestamp field
});

// Compound indexes for efficient queries
AuditLogSchema.index({ user: 1, timestamp: -1 });
AuditLogSchema.index({ severity: 1, timestamp: -1 });
AuditLogSchema.index({ event: 1, timestamp: -1 });
AuditLogSchema.index({ timestamp: -1 }); // For time-based queries

module.exports = mongoose.model('AuditLog', AuditLogSchema);
