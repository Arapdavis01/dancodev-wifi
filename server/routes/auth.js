const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const config = require('../config');

router.post('/admin-login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const users = await db.query(
      'SELECT * FROM users WHERE username = ? AND phone = ?',
      [username, 'admin']
    );
    
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, users[0].password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: users[0].id, username, role: 'admin' },
      config.sessionSecret,
      { expiresIn: '12h' }
    );

    res.json({ success: true, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
