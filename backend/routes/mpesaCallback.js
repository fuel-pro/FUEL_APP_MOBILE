/**
 * M-PESA STK Push Callback Handler
 * Safaricom will POST to this endpoint when a payment is completed
 */

const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

// Safaricom M-PESA Callback URL
router.post('/callback', async (req, res) => {
  try {
    console.log('📱 M-PESA Callback received:', JSON.stringify(req.body, null, 2));

    // Safe destructuring with fallbacks
    const Body = req.body?.Body;
    const stkCallback = Body?.stkCallback;

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

    const { Body } = req.body;
    const { OriginatorConversationID, Conversation, Result } = Body;

    if (Result.ResultCode === 0) {
      const callbackMetadata = Result.CallbackMetadata?.Item || [];
      
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

    const { Body } = req.body;
    const { Result } = Body;

    if (Result.ResultCode === 0) {
      const callbackMetadata = Result.CallbackMetadata?.Item || [];
      
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
  // Query your database for pending transaction
  // This depends on your database implementation
  const { getDb } = require('../database/sqlite');
  const db = getDb();
  
  try {
    const transaction = db.prepare(`
      SELECT * FROM mpesa_transactions 
      WHERE checkoutRequestId = ? AND status = 'PENDING'
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
    UPDATE mpesa_transactions 
    SET ${fields}, updatedAt = ?
    WHERE id = ?
  `).run(...values, new Date().toISOString(), id);
}

async function creditStationSales(stationId, amount) {
  const { getDb } = require('../database/sqlite');
  const db = getDb();
  
  db.prepare(`
    UPDATE stations 
    SET total_sales = total_sales + ?, updatedAt = ?
    WHERE id = ?
  `).run(amount, new Date().toISOString(), stationId);
}

function camelToSnake(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

module.exports = router;
