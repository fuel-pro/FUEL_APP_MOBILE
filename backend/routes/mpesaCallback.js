/**
 * M-PESA STK Push Callback Handler
 * Safaricom will POST to this endpoint when a payment is completed
 */
const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

function verifyCallbackSource(req) {
  const expected = process.env.MPESA_CALLBACK_SECRET;
  if (!expected) return true;
  return req.query && req.query.key === expected;
}

// Safaricom M-PESA Callback URL
router.post('/callback', async (req, res) => {
  try {
    console.log('📱 M-PESA Callback received:', JSON.stringify(req.body, null, 2));

    if (!process.env.MPESA_CALLBACK_SECRET) {
      console.warn('WARNING: MPESA_CALLBACK_SECRET is not set - callback endpoint is unauthenticated.');
    }
    if (!verifyCallbackSource(req)) {
      console.log('Rejected M-PESA callback - invalid secret key');
      return res.status(403).json({ ResultCode: 1, ResultDesc: 'Forbidden' });
    }

    const Body = req.body && req.body.Body;
    const stkCallback = Body && Body.stkCallback;

    if (!stkCallback) {
      console.log('❌ Invalid M-PESA callback - no stkCallback');
      return res.json({ ResultCode: 1, ResultDesc: 'Invalid callback' });
    }

    const checkoutRequestID = stkCallback.CheckoutRequestID;
    const resultCode = stkCallback.ResultCode;
    const resultDesc = stkCallback.ResultDesc;

    const transaction = await findPendingTransaction(checkoutRequestID);

    if (!transaction) {
      console.log('❌ Transaction not found:', checkoutRequestID);
      return res.json({ ResultCode: 1, ResultDesc: 'Transaction not found' });
    }

    // FIX: Prevent double-processing (idempotency)
    if (transaction.status === 'PAID' || transaction.status === 'FAILED') {
      console.warn(`Transaction ${checkoutRequestID} already processed with status: ${transaction.status}`);
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

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

      // FIX: Validate amount matches expected amount
      if (transaction.amount && Math.abs(transaction.amount - amount) > 0.01) {
        console.error(`❌ Amount mismatch for ${checkoutRequestID}: expected ${transaction.amount}, got ${amount}`);

        await updateTransaction(transaction.id, {
          status: 'FAILED',
          failureReason: `Amount mismatch: expected ${transaction.amount}, got ${amount}`,
          failedAt: new Date().toISOString()
        });

        await AuditLog.create({
          action: 'MPESA_FRAUD_DETECTED',
          detail: `Amount mismatch detected: expected ${transaction.amount}, got ${amount}`,
          userId: transaction.userId,
          metadata: { checkoutRequestID, expected: transaction.amount, received: amount }
        });

        return res.json({ ResultCode: 1, ResultDesc: 'Amount mismatch' });
      }

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

    res.json({
      ResultCode: 0,
      ResultDesc: 'Accepted'
    });

  } catch (error) {
    console.error('❌ M-PESA Callback Error:', error);
    res.status(500).json({ ResultCode: 1, ResultDesc: 'Error processing callback' });
  }
});

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
      WHERE checkout_request_id = ?
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