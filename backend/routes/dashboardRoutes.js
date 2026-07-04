/**
 * Dashboard Analytics API Routes
 * 
 * Provides dashboard statistics and analytics data for the frontend Dashboard component.
 * This bridges the gap between localStorage-based frontend data and the backend database.
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../database/sqlite');
const { protect } = require('../middleware/auth');

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics for the authenticated user
 */
router.get('/dashboard/stats', protect, (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    
    // Get today's date range
    const today = new Date().toISOString().split('T')[0];
    
    // Get total revenue from transactions
    const revenueResult = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE user_id = ? AND DATE(created_at) = ? AND status = 'PAID'
    `).get(userId, today);
    
    // Get fuel sold from content/sales data
    const salesData = db.prepare(`
      SELECT data FROM cloud_records 
      WHERE collection = 'sales' AND id LIKE ?
      ORDER BY updatedAt DESC LIMIT 30
    `).all(`${userId}%`);
    
    let totalFuelSold = 0;
    let totalRevenue = Number(revenueResult?.total) || 0;
    
    // Parse sales data to calculate fuel sold
    salesData.forEach(row => {
      try {
        const data = JSON.parse(row.data);
        // Calculate fuel from pumps
        if (data.pmsPumps) {
          data.pmsPumps.forEach(pump => {
            totalFuelSold += Number(pump.salesL) || 0;
          });
        }
        if (data.agoPumps) {
          data.agoPumps.forEach(pump => {
            totalFuelSold += Number(pump.salesL) || 0;
          });
        }
      } catch (e) {
        // Skip invalid data
      }
    });
    
    // Get balance due from credit/debt records
    const balanceResult = db.prepare(`
      SELECT COALESCE(SUM(CAST(data AS REAL) - COALESCE(paid, 0)), 0) as total
      FROM cloud_records 
      WHERE collection = 'debt' AND id LIKE ? AND data != ''
    `).get(`${userId}%`);
    
    // Get total expenses
    const expenseResult = db.prepare(`
      SELECT COALESCE(SUM(CAST(data AS REAL)), 0) as total
      FROM cloud_records 
      WHERE collection = 'expenses' AND id LIKE ? AND data != ''
    `).get(`${userId}%`);
    
    const netProfit = totalRevenue - (Number(expenseResult?.total) || 0);
    
    res.json({
      success: true,
      data: {
        totalRevenue,
        netProfit: Math.max(0, netProfit),
        fuelSold: Math.round(totalFuelSold * 100) / 100,
        balanceDue: Number(balanceResult?.total) || 0,
        todaySales: totalRevenue > 0 ? 1 : 0,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard stats' });
  }
});

/**
 * GET /api/dashboard/sales-trend
 * Get sales trend for the last 7 days
 */
router.get('/dashboard/sales-trend', protect, (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    
    // Get last 7 days sales data
    const salesData = db.prepare(`
      SELECT data, updatedAt FROM cloud_records 
      WHERE collection = 'sales' AND id LIKE ?
      AND updatedAt >= datetime('now', '-7 days')
      ORDER BY updatedAt ASC
    `).all(`${userId}%`);
    
    // Group by date
    const trendMap = {};
    const today = new Date();
    
    // Initialize last 7 days with 0
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      trendMap[dateStr] = { date: dateStr, revenue: 0, fuelSold: 0 };
    }
    
    // Aggregate sales data
    salesData.forEach(row => {
      try {
        const data = JSON.parse(row.data);
        const dateStr = (row.updatedAt || '').split('T')[0];
        
        if (trendMap[dateStr]) {
          // Calculate revenue from pumps
          let dayRevenue = 0;
          let dayFuel = 0;
          
          if (data.pmsPumps) {
            data.pmsPumps.forEach(pump => {
              dayRevenue += Number(pump.salesKsh) || 0;
              dayFuel += Number(pump.salesL) || 0;
            });
          }
          if (data.agoPumps) {
            data.agoPumps.forEach(pump => {
              dayRevenue += Number(pump.salesKsh) || 0;
              dayFuel += Number(pump.salesL) || 0;
            });
          }
          
          trendMap[dateStr].revenue += dayRevenue;
          trendMap[dateStr].fuelSold += dayFuel;
        }
      } catch (e) {
        // Skip invalid data
      }
    });
    
    const trend = Object.values(trendMap).map(item => ({
      ...item,
      revenue: Math.round(item.revenue * 100) / 100,
      fuelSold: Math.round(item.fuelSold * 100) / 100
    }));
    
    res.json({
      success: true,
      data: trend
    });
  } catch (error) {
    console.error('Sales trend error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sales trend' });
  }
});

/**
 * GET /api/dashboard/fuel-distribution
 * Get fuel type distribution for the last 30 days
 */
router.get('/dashboard/fuel-distribution', protect, (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    
    const salesData = db.prepare(`
      SELECT data FROM cloud_records 
      WHERE collection = 'sales' AND id LIKE ?
      AND updatedAt >= datetime('now', '-30 days')
    `).all(`${userId}%`);
    
    let petrol = 0;
    let diesel = 0;
    let kerosene = 0;
    
    salesData.forEach(row => {
      try {
        const data = JSON.parse(row.data);
        
        if (data.pmsPumps) {
          data.pmsPumps.forEach(pump => {
            petrol += Number(pump.salesL) || 0;
          });
        }
        if (data.agoPumps) {
          data.agoPumps.forEach(pump => {
            diesel += Number(pump.salesL) || 0;
          });
        }
        if (data.keroPumps) {
          data.keroPumps.forEach(pump => {
            kerosene += Number(pump.salesL) || 0;
          });
        }
      } catch (e) {
        // Skip invalid data
      }
    });
    
    res.json({
      success: true,
      data: {
        petrol: Math.round(petrol * 100) / 100,
        diesel: Math.round(diesel * 100) / 100,
        kerosene: Math.round(kerosene * 100) / 100
      }
    });
  } catch (error) {
    console.error('Fuel distribution error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch fuel distribution' });
  }
});

/**
 * GET /api/dashboard/current-prices
 * Get current fuel prices
 */
router.get('/dashboard/current-prices', protect, (req, res) => {
  try {
    const db = getDb();
    
    // Try to get prices from content/settings
    const priceRecord = db.prepare(`
      SELECT data FROM cloud_records 
      WHERE collection = 'config' AND id = 'fuel_prices'
    `).get();
    
    if (priceRecord) {
      const prices = JSON.parse(priceRecord.data);
      return res.json({
        success: true,
        data: {
          petrol: prices.petrol || 193.43,
          diesel: prices.diesel || 178.56,
          kerosene: prices.kerosene || 170.22
        }
      });
    }
    
    // Default Kenya prices
    res.json({
      success: true,
      data: {
        petrol: 193.43,
        diesel: 178.56,
        kerosene: 170.22
      }
    });
  } catch (error) {
    console.error('Current prices error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch current prices' });
  }
});

module.exports = router;