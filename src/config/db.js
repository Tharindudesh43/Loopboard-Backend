const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    return;
  }

  try {
    const db = await mongoose.connect(process.env.MONGODB_URI, {
      bufferCommands: false,
    });
    isConnected = db.connections[0].readyState;
    console.log('MongoDB connected');
  } catch (error) {
    console.error('Database connection failed:', error.message);
    throw error;
  }
};

module.exports = connectDB;