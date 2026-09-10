require('dotenv').config();

const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');

const SALT_ROUNDS = 10;

async function seedAdmin() {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD must be set in .env before seeding');
  }

  await connectDB();

  const existing = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
  if (existing) {
    console.log(`Admin already exists: ${existing.email} (role: ${existing.role})`);
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);
  const admin = await User.create({
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    passwordHash,
    role: 'ADMIN',
  });

  console.log(`Admin created: ${admin.email}`);
  await mongoose.disconnect();
}

seedAdmin()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seeding failed:', err.message);
    process.exit(1);
  });
