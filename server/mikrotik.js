const MikroNode = require('mikronode');
const config = require('./config');

class MikroTikManager {
  constructor() {
    this.conn = null;
    this.connected = false;
  }

  async connect() {
    try {
      const c = new MikroNode(
        config.mikrotik.host,
        config.mikrotik.user,
        config.mikrotik.password,
        { port: config.mikrotik.port || 8728 }
      );
      await c.connect();
      this.conn = c;
      this.connected = true;
      console.log('✅ MikroTik connected');
    } catch (e) {
      console.log('⚠️ MikroTik offline - running without router');
      this.connected = false;
    }
  }

  async addUser(username, password, uptime) {
    if (!this.connected) {
      console.log('   [Simulated] Creating user:', username);
      return;
    }
    try {
      const ch = this.conn.openChannel();
      ch.write('/ip/hotspot/user/add', [
        '=name=' + username,
        '=password=' + password,
        '=limit-uptime=' + uptime,
        '=comment=DancoDev Net User'
      ]);
      return new Promise((resolve) => {
        ch.on('done', (data) => { ch.close(); resolve(data); });
        ch.on('error', () => { ch.close(); resolve(null); });
      });
    } catch (e) {
      console.log('   MikroTik command failed:', e.message);
    }
  }

  async removeUser(username) {
    if (!this.connected) return;
    try {
      const ch = this.conn.openChannel();
      ch.write('/ip/hotspot/user/print', ['?name=' + username]);
      ch.on('done', async (users) => {
        if (users && users.length > 0) {
          const ch2 = this.conn.openChannel();
          ch2.write('/ip/hotspot/user/remove', ['=.id=' + users[0]['.id']]);
          ch2.on('done', () => ch2.close());
        }
        ch.close();
      });
    } catch (e) {
      console.log('   MikroTik remove failed:', e.message);
    }
  }

  formatTime(minutes) {
    const d = Math.floor(minutes / 1440);
    const h = Math.floor((minutes % 1440) / 60);
    const m = minutes % 60;
    let result = '';
    if (d > 0) result += d + 'd ';
    if (h > 0) result += h + 'h ';
    if (m > 0) result += m + 'm';
    return result.trim() || '0m';
  }

  async disconnect() {
    if (this.conn && this.connected) {
      this.conn.close();
      this.connected = false;
    }
  }
}

module.exports = new MikroTikManager();
