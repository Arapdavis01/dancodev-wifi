const express = require('express');
const router = express.Router();
const db = require('../database');
const config = require('../config');

router.get('/', async (req, res) => {
  try {
    const plans = await db.query(
      'SELECT * FROM plans WHERE is_active = TRUE ORDER BY price_ksh ASC'
    );
    res.json({ success: true, company: config.company, plans });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
