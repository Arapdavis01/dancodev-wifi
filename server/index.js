const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
const config = require('./config');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, { 
  cors: { 
    origin: '*',
    methods: ['GET', 'POST']
  } 
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/admin', express.static(path.join(__dirname, '../admin')));
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: true
}));

// Make io and db available to routes
app.set('io', io);
app.set('db', db);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('🔌 Device connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('🔌 Device disconnected:', socket.id);
  });
});

// Import routes
const authRoutes = require('./routes/auth');
const plansRoutes = require('./routes/plans');
const paymentsRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/admin', adminRoutes);

// Serve main portal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
async function start() {
  await db.init();
  server.listen(config.port, () => {
    console.log(`\n🚀 DancoDev Net WiFi - Port ${config.port}`);
    console.log(`📍 User Portal: http://localhost:${config.port}`);
    console.log(`🔐 Admin Panel: http://localhost:${config.port}/admin`);
    console.log(`🔌 Real-time updates ENABLED\n`);
  });
}

start();