const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '7d';

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_EXPIRY,
  });
}

/**
 * POST /api/auth/register
 * Creates a normal user. Role is NEVER read from the request body —
 * admins can only be created via the seed script.
 */
async function register(req, res) {
  try {
    const { name, email, password } = req.body;

    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !name.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({ error: 'name, email, and password are all required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({
      name,
      email,
      passwordHash,
      role: 'USER', // forced — see comment above
    });

    const token = signToken(user);
    return res.status(201).json({ token, user });
  } catch (err) {
    console.error('register error:', err);
    return res.status(500).json({ error: 'Something went wrong during registration' });
  }
}

/**
 * POST /api/auth/login
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    // passwordHash is on the schema by default; no select:false was set,
    // so this works directly against the model.
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(user);
    return res.json({ token, user });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: 'Something went wrong during login' });
  }
}

/**
 * GET /api/auth/me
 * Requires the `auth` middleware to have already run.
 */
async function me(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ user });
  } catch (err) {
    console.error('me error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

/**
 * PATCH /api/auth/me
 * Lets a user update their own profile. Deliberately does NOT accept
 * `email` or `role` here — email changes would need re-verification and
 * role changes must only ever happen via the seed script, so both are
 * kept out of scope rather than half-supported.
 */
async function updateMe(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { name, phone, dateOfBirth, socialLinks } = req.body;

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Name cannot be empty' });
      }
      user.name = name.trim();
    }
    if (phone !== undefined) {
      user.phone = typeof phone === 'string' ? phone : '';
    }
    if (dateOfBirth !== undefined) {
      user.dateOfBirth = dateOfBirth || null;
    }
    if (socialLinks !== undefined && typeof socialLinks === 'object' && socialLinks !== null) {
      user.socialLinks = {
        github: typeof socialLinks.github === 'string' ? socialLinks.github : '',
        linkedin: typeof socialLinks.linkedin === 'string' ? socialLinks.linkedin : '',
      };
    }

    await user.save();
    return res.json({ user });
  } catch (err) {
    console.error('updateMe error:', err);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
}

module.exports = { register, login, me, updateMe };
