/**
 * M-PESA STK Push Callback Handler
 * Safaricom will POST to this endpoint when a payment is completed
 *
 * IMPORTANT -- ARCHITECTURAL GAP (not fixed in this pass, documented instead
 * of patched blind): this file fixes the callback handler itself (missing
 * `transactions` table, wrong column names, unsafe destructuring -- see
 * comments below). But nothing in this backend ever creates the initial
 * PENDING transaction row that this callback looks up, because STK push
 * initiation currently happens entirely client-side, in
 * app/src/react-app/utils/mpesaStk.ts, which calls Safaricom's Daraja API
 * directly from the browser using a Consumer Key/Secret pulled from
 * localStorage. That means:
 *   1) Real M-PESA API credentials are exposed in the browser/localStorage
 *      to anyone who opens devtools -- these must be server-side secrets.
 *   2) No PENDING row is ever inserted here before Safaricom calls back, so
 *      even with the fixes below, findPendingTransaction() will still
 *      return "Transaction not found" for real payments until STK push
 *      initiation is moved server-side (an endpoint here that: takes
 *      phone/amount/station, calls Safaricom with server-held credentials,
 *      inserts the PENDING row using the returned CheckoutRequestID, then
 *      returns just the customer-facing status to the frontend).
 * This is a genuine feature-level gap, not a quick patch, and needs its own
 * implementation + testing against Safaricom's sandbox rather than being
 * guessed at without the ability to run it end-to-end.
 */

const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

// Optional shared-secret check. Safaricom does not sign STK callbacks, so
// there is no way to cryptographically verify the sender. If
// MPESA_CALLBACK_SECRET is set, require it as a query param on the callback
// URL registered with Safaricom (e.g. .../callback?key=...), which at least
// stops randoms from POSTing fake payment confirmations to a guessed public
// URL. Left optional so existing deployments don't break.
function verifyCallbackSource(req) {
  const expected = process.env.MPESA_CALLBACK_SECRET;
  if (!expected) return true; // not configured -- skip (warning logged separately)
  return req.query && req.query.key === expected;
}

// Safaricom M-PESA Callback URL
router.post('/callback', async (req, res) => {
  try {
    console.log('📱 M-PESA Callback received:', JSON.stringify(req.body, null, 2));

    if (!process.env.MPESA_CALLBACK_SECRET) {
      console.warn('WARNING: MPESA_CALLBACK_SECRET is not set - this callback endpoint is unauthenticated.');
    }
    if (!verifyCallbackSource(req)) {
      console.log('Rejected M-PESA callback - invalid or missing secret key');
      return res.status(403).json({ ResultCode: 1, ResultDesc: 'Forbidden' });
    }

    // FIX: req.body.Body could be missing or malformed (e.g. a health-check
    // ping, malformed request, or body-parser failing) -- destructuring
    // straight off req.body.Body crashed with a TypeError before the
    // payload was ever validated.
    const Body = req.body && req.body.Body;
    const stkCallback = Body && Body.stkCallback;

    if (!stkCallback) {
      console.log('❌ Invalid M-PESA callback - no stkCallback');
      return res.json({ ResultCode: 1, ResultDesc: 'Invalid callback' });
    }

    const checkoutRequestID = stkCallback.CheckoutRequestID;
    const resultCode = stkCallback.ResultCode;
    const resultDesc = stkCallback.ResultDesc;

    // Find the pending transaction in database
    const transaction = await findPendingTransaction(checkoutRequestID);

    if (!transaction) {
      console.log('❌ Transaction not found:', checkoutRequestID);
      return res.json({ ResultCode: 1, ResultDesc: 'Transaction not found' });
    }

    // Success (ResultCode 0)
    if (resultCode === 0) {
      const metadata = stkCallback.CallbackMetadata?.Item || [];
      
      const getValue = (name) => {
        const item = metadata.find(i => i.Name === name);
        return item ? item.Value : null;
      };

      const amount = getValue('Amount');
      const mpesaReceipt = getValue('MpesaReceiptNumber');
      const phoneNumber = getValue('PhoneNumber');
      const transactionDate = getValue('TransactionDate');

      // Update transaction as successful
      await updateTransaction(transaction.id, {
        status: 'PAID',
        mpesaReceipt: mpesaReceipt,
        amount: amount,
        paidAt: new Date().toISOString(),
        paymentPhone: phoneNumber,
        paymentDate: transactionDate
      });

      // Credit station sales
      if (transaction.stationId) {
        await creditStationSales(transaction.stationId, amount);
      }

      // Audit log
      await AuditLog.create({
        action: 'MPESA_PAYMENT_SUCCESS',
        detail: `M-PESA payment received: KES ${amount}`,
        userId: transaction.userId,
        metadata: {
          checkoutRequestID,
          mpesaReceipt,
          amount,
          phoneNumber
        }
      });

      console.log(`✅ Payment Success! Receipt: ${mpesaReceipt}, Amount: KES ${amount}`);

      // Notify connected clients via Socket.io
      const io = req.app.get('io');
      if (io) {
        io.to(`station_${transaction.stationId}`).emit('payment_received', {
          transactionId: transaction.id,
          amount,
          mpesaReceipt,
          status: 'PAID'
        });
      }

    } else {
      // Payment failed or cancelled
      await updateTransaction(transaction.id, {
        status: 'FAILED',
        failureReason: resultDesc,
        failedAt: new Date().toISOString()
      });

      await AuditLog.create({
        action: 'MPESA_PAYMENT_FAILED',
        detail: `M-PESA payment failed: ${resultDesc}`,
        userId: transaction.userId,
        metadata: { checkoutRequestID, resultCode, resultDesc }
      });

      console.log(`❌ Payment Failed: ${resultDesc}`);
    }

    // Safaricom expects this exact response format
    res.json({
      ResultCode: 0,
      ResultDesc: 'Accepted'
    });

  } catch (error) {
    console.error('❌ M-PESA Callback Error:', error);
    res.status(500).json({ ResultCode: 1, ResultDesc: 'Error processing callback' });
  }
});

// Balance Query Callback
router.post('/balance/callback', async (req, res) => {
  try {
    console.log('📱 M-PESA Balance Query Callback:', JSON.stringify(req.body, null, 2));

    const Body = req.body && req.body.Body;
    const Result = Body && Body.Result;
    const OriginatorConversationID = Result && Result.OriginatorConversationID;

    if (!Result) {
      console.log('Invalid balance callback - no Result object');
      return res.json({ ResultCode: 1, ResultDesc: 'Invalid callback' });
    }

    if (Result.ResultCode === 0) {
      const callbackMetadata = (Result.CallbackMetadata && Result.CallbackMetadata.Item) || [];
      
      const balance = callbackMetadata.find(i => i.Name === 'WorkingAccountAvailableFunds')?.Value;
      const currency = callbackMetadata.find(i => i.Name === 'Currency')?.Value;

      await AuditLog.create({
        action: 'MPESA_BALANCE_CHECK',
        detail: `M-PESA Balance: ${currency} ${balance}`,
        metadata: { balance, currency, OriginatorConversationID }
      });

      console.log(`💰 M-PESA Balance: ${currency} ${balance}`);
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('❌ Balance Callback Error:', error);
    res.status(500).json({ ResultCode: 1, ResultDesc: 'Error' });
  }
});

// B2C Payment Callback (receiving payments from M-PESA)
router.post('/b2c/callback', async (req, res) => {
  try {
    console.log('📱 M-PESA B2C Callback:', JSON.stringify(req.body, null, 2));

    const Body = req.body && req.body.Body;
    const Result = Body && Body.Result;

    if (!Result) {
      console.log('Invalid B2C callback - no Result object');
      return res.json({ ResultCode: 1, ResultDesc: 'Invalid callback' });
    }

    if (Result.ResultCode === 0) {
      const callbackMetadata = (Result.CallbackMetadata && Result.CallbackMetadata.Item) || [];
      
      const amount = callbackMetadata.find(i => i.Name === 'TransAmount')?.Value;
      const receipt = callbackMetadata.find(i => i.Name === 'MpesaReceiptNumber')?.Value;
      const phone = callbackMetadata.find(i => i.Name === 'MSISDN')?.Value;

      await AuditLog.create({
        action: 'MPESA_B2C_RECEIVED',
        detail: `Received M-PESA B2C: KES ${amount}`,
        metadata: { amount, receipt, phone }
      });

      console.log(`💵 B2C Received: KES ${amount} from ${phone}`);
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('❌ B2C Callback Error:', error);
    res.status(500).json({ ResultCode: 1, ResultDesc: 'Error' });
  }
});

// Health check for M-PESA integration
router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    service: 'M-PESA Callback Handler',
    endpoints: {
      stk_push_callback: '/api/mpesa/callback',
      balance_callback: '/api/mpesa/balance/callback',
      b2c_callback: '/api/mpesa/b2c/callback'
    }
  });
});

// Helper functions
async function findPendingTransaction(checkoutRequestID) {
  const { getDb } = require('../database/sqlite');
  const db = getDb();
  
  try {
    const transaction = db.prepare(`
      SELECT * FROM transactions 
      WHERE checkout_request_id = ? AND status = 'PENDING'
    `).get(checkoutRequestID);
    
    return transaction;
  } catch (error) {
    console.error('Error finding transaction:', error);
    return null;
  }
}

async function updateTransaction(id, updates) {
  const { getDb } = require('../database/sqlite');
  const db = getDb();
  
  const fields = Object.keys(updates).map(key => `${camelToSnake(key)} = ?`).join(', ');
  const values = Object.values(updates);
  
  db.prepare(`
    UPDATE transactions 
    SET ${fields}, updated_at = ?
    WHERE id = ?
  `).run(...values, new Date().toISOString(), id);
}

async function creditStationSales(stationId, amount) {
  const { getDb } = require('../database/sqlite');
  const db = getDb();

  // FIX: the stations table (backend/database/sqlite.js) uses camelCase
  // columns (`totalSales`, `updatedAt`), not `total_sales` / `updated_at`.
  // The previous query referenced columns that don't exist and would throw
  // "no such column: total_sales" on every successful payment.
  const numericAmount = Number(amount) || 0;
  db.prepare(`
    UPDATE stations
    SET totalSales = COALESCE(totalSales, 0) + ?, updatedAt = ?
    WHERE id = ?
  `).run(numericAmount, new Date().toISOString(), stationId);
}

function camelToSnake(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

module.exports = router;
