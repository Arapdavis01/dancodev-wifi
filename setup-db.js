const mysql = require('mysql2/promise');

async function createDB() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: ''
    });
    
    await connection.execute('CREATE DATABASE IF NOT EXISTS dancodev_wifi');
    console.log('✅ Database "dancodev_wifi" created successfully!');
    await connection.end();
  } catch (err) {
    if (err.code === 'ER_DBACCESS_DENIED_ERROR') {
      console.error('❌ MySQL password required! Check your XAMPP MySQL password.');
    } else {
      console.error('❌ Error:', err.message);
    }
  }
  process.exit(0);
}

createDB();
