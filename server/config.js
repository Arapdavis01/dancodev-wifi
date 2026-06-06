require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  company: 'DancoDev Net',
  
  db: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'dancodev_wifi',
    port: 3306
  },
  
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'DancoDev@2024'
  },
  
  mikrotik: {
    host: process.env.MIKROTIK_HOST || '192.168.88.1',
    port: parseInt(process.env.MIKROTIK_PORT) || 8728,
    user: process.env.MIKROTIK_USER || 'admin',
    password: process.env.MIKROTIK_PASSWORD || ''
  },
  
  mpesa: {
    consumerKey: process.env.MPESA_CONSUMER_KEY || '',
    consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
    passkey: process.env.MPESA_PASSKEY || '',
    shortcode: process.env.MPESA_SHORTCODE || '174379',
    tillNumber: process.env.MPESA_TILL_NUMBER || '',
    callbackUrl: process.env.MPESA_CALLBACK_URL || ''
  },
  
  sessionSecret: process.env.SESSION_SECRET || 'DancoDevNet2024'
};
