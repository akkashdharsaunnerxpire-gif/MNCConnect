const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const connectDB = require('./config/db.js');

const authRoutes = require('./routes/authRoutes');
const mentorRoutes = require('./routes/mentorRoutes');
const verificationRoutes = require('./routes/verificationRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

connectDB();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log('⚡ Client connected to Socket.io:', socket.id);
  
  socket.on('join_company_room', (companyName) => {
    const room = `company_${companyName.toLowerCase().trim()}`;
    socket.join(room);
    console.log(`Socket ${socket.id} joined ${room}`);
  });
  
  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});

app.use('/uploads', express.static(path.join(__dirname, '/uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/mentors', mentorRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/verification', verificationRoutes);

app.get('/', (req, res) => {
  res.json({ message: "Welcome to MNCConnect Backend API" });
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});