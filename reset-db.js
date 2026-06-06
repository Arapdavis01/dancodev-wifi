const mysql = require('mysql2/promise');

async function resetDB() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: ''
  });
  
  // Drop and recreate database
  await connection.execute('DROP DATABASE IF EXISTS dancodev_wifi');
  await connection.execute('CREATE DATABASE dancodev_wifi');
  console.log('✅ Database recreated successfully!');
  
  await connection.end();
  process.exit(0);
}

resetDB().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
