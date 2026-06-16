const mongoose = require('mongoose');

const ContentSchema = new mongoose.Schema({
  key: { 
    type: String, 
    required: true, 
    unique: true,
    index: true
  },
  data: { 
    type: mongoose.Schema.Types.Mixed, 
    required: true 
  },
  versionNumber: { 
    type: Number, 
    default: 1 
  },
  updatedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  },
  metadata: {
    category: { type: String, default: 'general' },
    description: { type: String, default: '' },
    tags: [{ type: String }]
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Content', ContentSchema);
