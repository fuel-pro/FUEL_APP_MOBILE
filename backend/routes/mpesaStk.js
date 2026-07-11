/**
 * M-PESA STK Push Server-Side Implementation
 * 
 * SECURITY FIX: This file addresses the critical vulnerability where M-PESA
 * API credentials (Consumer Key, Consumer Secret, Passkey) were stored in
 * localStorage and used client-side. This exposed financial API credentials
 * to anyone with browser devtools access.
 * 
 * Now STK Push is initiated server-side using environment variables:
 *   - MPESA_CONSUMER_KEY
 *   - MPESA_CONSUMER_SECRET
 *   - MPESA_PASSKEY
 *   - MPESA_SHORTCODE
 *   - MPESA_CALLBACK_URL (your callback URL registered with Safaricom)
 *   - MPESA_ENV (sandbox | live)
 * 
 * The server also creates a PENDING transaction row so when Safaricom
 * calls back, the transaction can be found and updated.
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../database/sqlite');
const { protect } = require('../middleware/auth');
const AuditLog = require('../models/AuditLog');

const MPESA_ENV = process.env.MPESA_ENV || 'production';
const BASE_URL = MPESA_ENV === 'production' 
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

/**
 * Get OAuth token from Safaricom
 */
async function getMpesaToken() {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  
  if (!consumerKey || !consumerSecret) {
    throw new Error('MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET must be set');
  }
  
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  
  const response = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get M-PESA token: ${error}`);
  }
  
  const data = await response.json();
  return data.access_token;
}

/**
 * Format phone number to 254 format
 */
function formatPhone254(phone) {
  if (!phone) return null;
  
  // Remove all non-digits
  const clean = phone.replace(/\D/g, '');
  
  // Handle various formats
  if (clean.startsWith('254') && clean.length === 12) {
    return clean;
  }
  if (clean.startsWith('0') && clean.length === 9) {
    return '254' + clean.slice(1);
  }
  if (clean.startsWith('7') && clean.length === 9) {
    return '254' + clean;
  }
  if (clean.startsWith('+254') && clean.length === 13) {
    return clean.slice(1);
  }
  
  // Return as-is if already in correct format
  if (clean.length === 12) return clean;
  
  return null; // Invalid format
}

/**
 * POST /api/mpesa/stkpush
 * Initiate STK Push payment request
 */
router.post('/stkpush', protect, async (req, res) => {
  try {
    const { phoneNumber, amount, accountReference, description } = req.body;
    
    // Validate required fields
    if (!phoneNumber || !amount || !accountReference) {
      return res.status(400).json({ 
        success: false, 
        error: 'phoneNumber, amount, and accountReference are required' 
      });
    }
    
    // Validate amount
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount < 1) {
      return res.status(400).json({ 
        success: false, 
        error: 'Amount must be a positive number' 
      });
    }
    
    // Format phone number
    const formattedPhone = formatPhone254(phoneNumber);
    if (!formattedPhone) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid phone number format. Use 07xx xxx xxx or +254xx xxx xxx' 
      });
    }
    
    // Get environment variables
    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    const callbackUrl = process.env.MPESA_CALLBACK_URL;
    
    if (!shortcode || !passkey || !callbackUrl) {
      console.error('M-PESA environment not fully configured');
      return res.status(500).json({ 
        success: false, 
        error: 'M-PESA is not configured on this server' 
      });
    }
    
    // Get OAuth token
    const token = await getMpesaToken();
    
    // Generate timestamp and password
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
    
    // Prepare STK Push request
    const stkRequest = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(numericAmount), // Safaricom requires integer
      PartyA: formattedPhone,
      PartyB: shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: String(accountReference).substring(0, 20), // Max 20 chars
      TransactionDesc: String(description || 'Payment').substring(0, 100)
    };
    
    // Send STK Push request
    const response = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(stkRequest)
    });
    
    const data = await response.json();
    
    // Check for successful response
    if (data.ResponseCode === '0') {
      // Create PENDING transaction record so callback can find it
      const db = getDb();
      const checkoutRequestId = data.CheckoutRequestID;
      
      db.prepare(`
        INSERT INTO transactions (
          checkout_request_id, phone, amount, account_ref, 
          status, user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'PENDING', ?, datetime('now'), datetime('now'))
      `).run(
        checkoutRequestId,
        formattedPhone,
        numericAmount,
        accountReference,
        req.user.id
      );
      
      // Log the initiation
      await AuditLog.create({
        action: 'MPESA_STK_INITIATED',
        detail: `STK Push initiated: KES ${numericAmount} to ${accountReference}`,
        userId: req.user.id,
        metadata: {
          checkoutRequestId,
          amount: numericAmount,
          phone: formattedPhone,
          accountReference
        }
      });
      
      console.log(`✅ STK Push initiated: ${checkoutRequestId}`);
      
      return res.json({
        success: true,
        checkoutRequestId: checkoutRequestId,
        responseDescription: data.ResponseDescription
      });
    } else {
      // STK Push failed
      console.error(`❌ STK Push failed: ${data.ResponseCode} - ${data.ResponseDescription}`);
      
      return res.json({
        success: false,
        error: data.ResponseDescription || 'STK Push request failed',
        responseCode: data.ResponseCode
      });
    }
    
  } catch (error) {
    console.error('❌ M-PESA STK Push Error:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to initiate payment'
    });
  }
});

/**
 * POST /api/mpesa/stkstatus
 * Check STK Push transaction status
 */
router.post('/stkstatus', protect, async (req, res) => {
  try {
    const { checkoutRequestId } = req.body;
    
    if (!checkoutRequestId) {
      return res.status(400).json({ 
        success: false, 
        error: 'checkoutRequestId is required' 
      });
    }
    
    // Get environment variables
    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    
    if (!shortcode || !passkey) {
      return res.status(500).json({ 
        success: false, 
        error: 'M-PESA is not configured' 
      });
    }
    
    // Get OAuth token
    const token = await getMpesaToken();
    
    // Generate timestamp and password
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
    
    // Query transaction status
    const response = await fetch(`${BASE_URL}/mpesa/stkpushquery/v1/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId
      })
    });
    
    const data = await response.json();
    
    // Find local transaction record
    const db = getDb();
    const transaction = db.prepare(`
      SELECT * FROM transactions WHERE checkout_request_id = ?
    `).get(checkoutRequestId);
    
    return res.json({
      success: true,
      mpesaResponse: data,
      localTransaction: transaction
    });
    
  } catch (error) {
    console.error('❌ M-PESA STK Status Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to check transaction status'
    });
  }
});

/**
 * GET /api/mpesa/config
 * Check M-PESA configuration status
 */
router.get('/config', (req, res) => {
  const hasEnvVars = !!(
    process.env.MPESA_CONSUMER_KEY &&
    process.env.MPESA_CONSUMER_SECRET &&
    process.env.MPESA_PASSKEY &&
    process.env.MPESA_SHORTCODE &&
    process.env.MPESA_CALLBACK_URL
  );
  
  res.json({
    configured: hasEnvVars,
    env: MPESA_ENV,
    message: hasEnvVars 
      ? 'M-PESA is properly configured' 
      : 'M-PESA credentials are missing. Set MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_PASSKEY, MPESA_SHORTCODE, and MPESA_CALLBACK_URL'
  });
});

module.exports = router;