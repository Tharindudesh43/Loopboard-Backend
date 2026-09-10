const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    // Never accept this from client input on registration — only the seed
    // script should ever create a user with role ADMIN.
    role: {
      type: String,
      enum: ['USER', 'ADMIN'],
      default: 'USER',
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    socialLinks: {
      github: { type: String, default: '', trim: true },
      linkedin: { type: String, default: '', trim: true },
    },
  },
  { timestamps: true }
);

// Never let a serialized user leak the password hash to the client.
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
