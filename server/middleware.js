const jwt = require('jsonwebtoken');
const config = require('./config');

function adminAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }

  try {
    const decoded = jwt.verify(token, config.sessionSecret);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { adminAuth };
