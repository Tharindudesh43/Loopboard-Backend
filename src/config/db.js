// const mongoose = require('mongoose');

// async function connectDB() {
//   const uri = process.env.MONGODB_URI;

//   if (!uri) {
//     throw new Error('MONGODB_URI is not set. Copy .env.example to .env and fill it in.');
//   }

//   mongoose.set('strictQuery', true);

//   await mongoose.connect(uri);
//   console.log('MongoDB connected:', mongoose.connection.name);
// }

// module.exports = connectDB;

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