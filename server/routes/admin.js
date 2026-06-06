const express = require('express');
const router = express.Router();
const db = require('../database');
const { adminAuth } = require('../middleware');

// Helper function to emit real-time updates
function emitUpdate(req, event, data = {}) {
  try {
    const io = req.app.get('io');
    if (io) {
      io.emit(event, data);
      console.log(`📡 Emitted: ${event}`);
    }
  } catch (e) {
    // Ignore socket errors
  }
}

// Get dashboard stats
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const totalTransactions = await db.query('SELECT COUNT(*) as count FROM transactions WHERE status = "completed"');
    const activeSessions = await db.query('SELECT COUNT(*) as count FROM sessions WHERE active = TRUE AND expires_at > NOW()');
    const totalRevenue = await db.query('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE status = "completed"');
    const recentTransactions = await db.query('SELECT t.*, p.name as plan_name FROM transactions t JOIN plans p ON t.plan_id = p.id ORDER BY t.created_at DESC LIMIT 10');
    const todayRevenue = await db.query('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE status = "completed" AND DATE(created_at) = CURDATE()');

    res.json({
      success: true,
      stats: {
        totalTransactions: totalTransactions[0]?.count || 0,
        activeSessions: activeSessions[0]?.count || 0,
        totalRevenue: totalRevenue[0]?.total || 0,
        todayRevenue: todayRevenue[0]?.total || 0,
        recentTransactions: recentTransactions || []
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all plans
router.get('/plans', adminAuth, async (req, res) => {
  try {
    const plans = await db.query('SELECT * FROM plans ORDER BY price_ksh ASC');
    res.json({ success: true, plans: plans || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add plan
router.post('/plans', adminAuth, async (req, res) => {
  try {
    const { name, description, duration_minutes, price_ksh, speed_limit } = req.body;
    if (!name || !price_ksh) {
      return res.status(400).json({ error: 'Name and price are required' });
    }
    await db.query(
      'INSERT INTO plans (name, description, duration_minutes, price_ksh, speed_limit) VALUES (?,?,?,?,?)',
      [name, description || '', duration_minutes || 60, price_ksh, speed_limit || '5M/5M']
    );
    emitUpdate(req, 'plansUpdated', { action: 'add', name });
    res.json({ success: true, message: 'Plan added' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update plan
router.put('/plans/:id', adminAuth, async (req, res) => {
  try {
    const { name, description, duration_minutes, price_ksh, speed_limit, is_active } = req.body;
    const plans = await db.query('SELECT * FROM plans WHERE id = ?', [req.params.id]);
    if (!plans || plans.length === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    const plan = plans[0];
    await db.query(
      'UPDATE plans SET name=?, description=?, duration_minutes=?, price_ksh=?, speed_limit=?, is_active=? WHERE id=?',
      [
        name || plan.name,
        description !== undefined ? description : plan.description,
        duration_minutes || plan.duration_minutes,
        price_ksh || plan.price_ksh,
        speed_limit || plan.speed_limit,
        is_active !== undefined ? is_active : plan.is_active,
        req.params.id
      ]
    );
    emitUpdate(req, 'plansUpdated', { action: 'update', id: req.params.id });
    res.json({ success: true, message: 'Plan updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE PLAN
router.delete('/plans/:id', adminAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM plans WHERE id = ?', [req.params.id]);
    emitUpdate(req, 'plansUpdated', { action: 'delete', id: req.params.id });
    res.json({ success: true, message: 'Plan deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get settings
router.get('/settings', adminAuth, async (req, res) => {
  try {
    const settings = await db.query('SELECT * FROM settings');
    res.json({ success: true, settings: settings || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update settings
router.post('/settings', adminAuth, async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'Key required' });
    await db.query(
      'INSERT INTO settings (setting_key, setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value=?',
      [key, value || '', value || '']
    );
    emitUpdate(req, 'settingsUpdated', { key });
    res.json({ success: true, message: 'Setting saved' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all transactions
router.get('/transactions', adminAuth, async (req, res) => {
  try {
    const transactions = await db.query(
      'SELECT t.*, p.name as plan_name FROM transactions t JOIN plans p ON t.plan_id = p.id ORDER BY t.created_at DESC LIMIT 100'
    );
    res.json({ success: true, transactions: transactions || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active sessions
router.get('/sessions', adminAuth, async (req, res) => {
  try {
    const sessions = await db.query(
      'SELECT * FROM sessions WHERE active = TRUE AND expires_at > NOW() ORDER BY created_at DESC'
    );
    res.json({ success: true, sessions: sessions || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;