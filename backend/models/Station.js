const mongoose = require('mongoose');

const StationSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  location: { 
    type: String, 
    required: true,
    trim: true
  },
  ownerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  ownerName: { type: String },
  status: { 
    type: String, 
    enum: ['active', 'inactive', 'suspended', 'pending'],
    default: 'active'
  },
  members: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  settings: {
    currency: { type: String, default: 'USD' },
    timezone: { type: String, default: 'UTC' },
    fuelTypes: [{ name: String, pricePerLiter: Number }]
  },
  stats: {
    totalSales: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    totalTransactions: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Index for efficient queries
StationSchema.index({ ownerId: 1 });
StationSchema.index({ status: 1 });
StationSchema.index({ 'stats.totalRevenue': -1 });

module.exports = mongoose.model('Station', StationSchema);
