/**
 * M-PESA STK Push Server-Side Handler
 * SECURITY: All credential handling done server-side
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { protect, requireRole } = require('../middleware/auth');

// M-PESA Configuration from Environment
const MPESA_CONFIG = {
  shortcode: process.env.MPESA_SHORTCODE,
  passkey: process.env.MPESA_PASSKEY,
  consumerKey: process.env.MPESA_CONSUMER_KEY,
  consumerSecret: process.env.MPESA_CONSUMER_SECRET,
  env: process.env.MPESA_ENV || 'sandbox',
  callbackUrl: process.env.MPESA_CALLBACK_URL
};

// SECURITY: Verify configuration at startup
if (MPESA_CONFIG.shortcode && !MPESA_CONFIG.passkey) {
  console.warn('⚠️ WARNING: MPESA_SHORTCODE set but MPESA_PASSKEY missing');
}

/**
 * Validate and format Kenyan phone number to M-PESA format (254XXXXXXXXX)
 * SECURITY: Strict validation to prevent invalid requests
 */
function formatPhone254(phone) {
  if (!phone || typeof phone !== 'string') {
    return null;
  }
  
  // Remove spaces, dashes, and leading +
  let clean = phone.replace(/[\s+-]/g, '');
  
  // Validate: only digits
  if (!/^[0-9]+$/.test(clean)) {
    return null;
  }
  
  // Convert formats
  if (clean.startsWith('254')) {
    // Already in correct format, validate length
    if (clean.length === 12) return clean;
  } else if (clean.startsWith('07') || clean.startsWith('01')) {
    // Convert 07xxxxxxxx or 01xxxxxxxx to 254XXXXXXXXX
    if (clean.length === 10) {
      return '254' + clean.substring(1);
    }
  }
  
  return null;
}

/**
 * Validate M-PESA amount
 * SECURITY: Prevent abuse with min/max limits
 */
function validateAmount(amount) {
  const numericAmount = Number(amount);
  
  if (isNaN(numericAmount)) {
    return { valid: false, error: 'Invalid amount format' };
  }
  
  // M-PESA limits
  const MIN_AMOUNT = 10; // KES 10 minimum
  const MAX_AMOUNT = 150000; // KES 150,000 per transaction (M-PESA limit)
  
  if (numericAmount < MIN_AMOUNT) {
    return { valid: false, error: `Minimum amount is KES ${MIN_AMOUNT}` };
  }
  
  if (numericAmount > MAX_AMOUNT) {
    return { valid: false, error: `Maximum amount is KES ${MAX_AMOUNT}` };
  }
  
  // Check for too many decimal places (max 2)
  if (!/^\d+(\.\d{1,2})?$/.test(amount.toString())) {
    return { valid: false, error: 'Amount can have at most 2 decimal places' };
  }
  
  return { valid: true, amount: numericAmount };
}

/**
 * Generate M-PESA Access Token
 */
async function getMpesaAccessToken() {
  const auth = Buffer.from(
    `${MPESA_CONFIG.consumerKey}:${MPESA_CONFIG.consumerSecret}`
  ).toString('base64');

  const baseUrl = MPESA_CONFIG.env === 'production' 
    ? 'https://api.safaricom.co.ke' 
    : 'https://sandbox.safaricom.co.ke';

  try {
    const response = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    const data = await response.json();
    
    if (data.access_token) {
      return { success: true, token: data.access_token };
    }
    
    return { success: false, error: data.error_description || 'Failed to get token' };
  } catch (error) {
    console.error('M-PESA Token Error:', error.message);
    return { success: false, error: 'Failed to connect to M-PESA' };
  }
}

/**
 * Initiate STK Push
 * POST /api/mpesa/stkpush
 */
router.post('/stkpush', protect, async (req, res) => {
  try {
    const { phone, amount, accountReference, transactionDesc } = req.body;

    // Validate phone number
    const formattedPhone = formatPhone254(phone);
    if (!formattedPhone) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid phone number format. Use 254XXXXXXXXX, 07XXXXXXXX, or 01XXXXXXXX' 
      });
    }

    // Validate amount
    const amountValidation = validateAmount(amount);
    if (!amountValidation.valid) {
      return res.status(400).json({ 
        success: false, 
        error: amountValidation.error 
      });
    }

    // Check M-PESA configuration
    if (!MPESA_CONFIG.shortcode || !MPESA_CONFIG.passkey) {
      console.error('M-PESA not configured');
      return res.status(500).json({ 
        success: false, 
        error: 'Payment service not configured' 
      });
    }

    // Get access token
    const tokenResult = await getMpesaAccessToken();
    if (!tokenResult.success) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to authenticate with payment service' 
      });
    }

    // Generate timestamp and password
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14);
    const password = Buffer.from(
      `${MPESA_CONFIG.shortcode}${MPESA_CONFIG.passkey}${timestamp}`
    ).toString('base64');

    const baseUrl = MPESA_CONFIG.env === 'production' 
      ? 'https://api.safaricom.co.ke' 
      : 'https://sandbox.safaricom.co.ke';

    const stkPushPayload = {
      BusinessShortCode: MPESA_CONFIG.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amountValidation.amount,
      PartyA: formattedPhone,
      PartyB: MPESA_CONFIG.shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: MPESA_CONFIG.callbackUrl,
      AccountReference: (accountReference || 'FuelPro').substring(0, 12), // Max 12 chars
      TransactionDesc: (transactionDesc || 'Fuel Purchase').substring(0, 13) // Max 13 chars
    };

    const response = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenResult.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(stkPushPayload)
    });

    const data = await response.json();

    if (data.ResponseCode === '0') {
      res.json({
        success: true,
        message: 'STK Push initiated. Check your phone.',
        CheckoutRequestID: data.CheckoutRequestID,
        MerchantRequestID: data.MerchantRequestID
      });
    } else {
      console.error('STK Push Failed:', data);
      res.status(400).json({
        success: false,
        error: data.errorMessage || 'Failed to initiate payment',
        errorCode: data.errorCode
      });
    }
  } catch (error) {
    console.error('STK Push Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process payment request' 
    });
  }
});

/**
 * Check STK Push Status
 * POST /api/mpesa/stkpush/query
 */
router.post('/stkpush/query', protect, async (req, res) => {
  try {
    const { checkoutRequestId } = req.body;

    if (!checkoutRequestId) {
      return res.status(400).json({ 
        success: false, 
        error: 'CheckoutRequestID is required' 
      });
    }

    // Get access token
    const tokenResult = await getMpesaAccessToken();
    if (!tokenResult.success) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to authenticate with payment service' 
      });
    }

    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14);
    const password = Buffer.from(
      `${MPESA_CONFIG.shortcode}${MPESA_CONFIG.passkey}${timestamp}`
    ).toString('base64');

    const baseUrl = MPESA_CONFIG.env === 'production' 
      ? 'https://api.safaricom.co.ke' 
      : 'https://sandbox.safaricom.co.ke';

    const response = await fetch(`${baseUrl}/mpesa/stkpushquery/v1/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenResult.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        BusinessShortCode: MPESA_CONFIG.shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId
      })
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('STK Query Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to check payment status' 
    });
  }
});

module.exports = router;