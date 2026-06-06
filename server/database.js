const mysql = require('mysql2/promise');
const config = require('./config');
const bcrypt = require('bcryptjs');

class Database {
  constructor() { this.pool = null; }

  async init() {
    this.pool = mysql.createPool(config.db);
    const conn = await this.pool.getConnection();

    // Users table
    await conn.execute(`CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      phone VARCHAR(15) UNIQUE,
      username VARCHAR(50) UNIQUE,
      password VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Plans table
    await conn.execute(`CREATE TABLE IF NOT EXISTS plans (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100),
      description TEXT,
      duration_minutes INT,
      price_ksh INT,
      speed_limit VARCHAR(20),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Transactions table
    await conn.execute(`CREATE TABLE IF NOT EXISTS transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      phone VARCHAR(15),
      plan_id INT,
      amount INT,
      payment_method VARCHAR(20),
      mpesa_receipt VARCHAR(50),
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Active sessions
    await conn.execute(`CREATE TABLE IF NOT EXISTS sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      phone VARCHAR(15),
      username VARCHAR(50),
      plan_name VARCHAR(100),
      expires_at DATETIME,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Admin settings
    await conn.execute(`CREATE TABLE IF NOT EXISTS settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      setting_key VARCHAR(50) UNIQUE,
      setting_value TEXT
    )`);

    // Insert default plans
    const plans = [
      ['1 Hour Quick', '1 Hour High-Speed Access', 60, 10, '5M/5M'],
      ['3 Hours', '3 Hours Browsing', 180, 25, '5M/5M'],
      ['Daily Pass', '24 Hours Unlimited', 1440, 50, '10M/10M'],
      ['Weekly Premium', '7 Days Full Access', 10080, 200, '20M/20M'],
      ['Monthly Unlimited', '30 Days Premium', 43200, 500, '50M/50M']
    ];

    for (const p of plans) {
      await conn.execute(
        'INSERT IGNORE INTO plans (name, description, duration_minutes, price_ksh, speed_limit) VALUES (?,?,?,?,?)',
        p
      );
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash(config.admin.password, 10);
    await conn.execute(
      'INSERT IGNORE INTO users (phone, username, password) VALUES (?,?,?)',
      ['admin', config.admin.username, hashedPassword]
    );

    conn.release();
    console.log('✅ Database ready with default plans');
  }

  async query(sql, params = []) {
    const [rows] = await this.pool.execute(sql, params);
    return rows;
  }
}

module.exports = new Database();
