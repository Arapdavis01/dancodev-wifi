const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../database');
const mpesa = require('../mpesa');
const mt = require('../mikrotik');

router.post('/mpesa', async (req, res) => {
  try {
    const { phone, planId } = req.body;
    
    if (!phone || !planId) {
      return res.status(400).json({ error: 'Phone and plan are required' });
    }

    const plans = await db.query('SELECT * FROM plans WHERE id = ?', [planId]);
    if (plans.length === 0) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const plan = plans[0];
    const reference = 'DancoDev_' + crypto.randomBytes(3).toString('hex').toUpperCase();

    // Initiate M-Pesa STK Push
    const result = await mpesa.stkPush(phone, plan.price_ksh, reference);

    if (result.success) {
      // Save transaction
      await db.query(
        'INSERT INTO transactions (phone, plan_id, amount, payment_method, mpesa_receipt, status) VALUES (?,?,?,?,?,?)',
        [phone, planId, plan.price_ksh, 'mpesa', reference, 'pending']
      );

      res.json({
        success: true,
        message: 'STK Push sent. Please enter your M-Pesa PIN.',
        reference: reference,
        checkoutRequestID: result.checkoutRequestID
      });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// M-Pesa Callback
router.post('/mpesa/callback', async (req, res) => {
  try {
    const callback = req.body.Body?.stkCallback;
    
    if (!callback) {
      return res.json({ ResultCode: 1, ResultDesc: 'Invalid callback' });
    }

    const checkoutRequestID = callback.CheckoutRequestID;
    const resultCode = callback.ResultCode;
    const mpesaReceipt = callback.CallbackMetadata?.Item?.find(
      i => i.Name === 'MpesaReceiptNumber'
    )?.Value;

    if (resultCode === 0) {
      // Payment successful
      const transactions = await db.query(
        'SELECT t.*, p.name, p.duration_minutes FROM transactions t JOIN plans p ON t.plan_id = p.id WHERE t.mpesa_receipt = ?',
        [checkoutRequestID]
      );

      if (transactions.length > 0) {
        const t = transactions[0];
        
        // Create user
        const username = 'DancoDev_' + crypto.randomBytes(4).toString('hex');
        const password = crypto.randomBytes(6).toString('hex');
        const expires = new Date(Date.now() + t.duration_minutes * 60000);

        await db.query(
          'INSERT INTO users (phone, username, password) VALUES (?,?,?)',
          [t.phone, username, password]
        );

        await db.query(
          'INSERT INTO sessions (phone, username, plan_name, expires_at) VALUES (?,?,?,?)',
          [t.phone, username, t.name, expires]
        );

        await db.query(
          'UPDATE transactions SET status = ?, mpesa_receipt = ? WHERE id = ?',
          ['completed', mpesaReceipt, t.id]
        );

        // Create MikroTik user
        await mt.addUser(username, password, mt.formatTime(t.duration_minutes));
      }
    }

    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (error) {
    console.error('Callback error:', error);
    res.json({ ResultCode: 1, ResultDesc: 'Error' });
  }
});

// Check payment status
router.get('/status/:reference', async (req, res) => {
  try {
    const transactions = await db.query(
      'SELECT t.*, p.name, p.duration_minutes, s.username, s.password, s.expires_at FROM transactions t JOIN plans p ON t.plan_id = p.id LEFT JOIN sessions s ON t.phone = s.phone WHERE t.mpesa_receipt = ? ORDER BY s.id DESC LIMIT 1',
      [req.params.reference]
    );

    if (transactions.length === 0) {
      return res.json({ success: false, status: 'not_found' });
    }

    const t = transactions[0];
    res.json({
      success: true,
      status: t.status,
      credentials: t.status === 'completed' ? {
        username: t.username,
        password: t.password,
        plan: t.name,
        expires: t.expires_at
      } : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
