const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const userRoutes = require('./routes/userRoutes');
const projectRoutes = require('./routes/projectRoutes');

const app = express();

// Render/Railway sit in front of this app behind a reverse proxy. Without
// this, express-rate-limit either can't see the real client IP (so every
// request looks like it comes from the proxy, and one heavy user's traffic
// gets bucketed with everyone else's) or throws a validation error outright
// on newer versions. `1` trusts exactly one hop — the platform's own proxy.
app.set('trust proxy', 1);

// Sets a standard set of protective HTTP headers (no X-Powered-By, sane
// Content-Security-Policy defaults, etc.). Cheap, broadly-recommended baseline.
app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_URL || '*',
  })
);

// Bounded body size — an unbounded JSON body is an easy DoS vector
// (one client sending a huge payload to chew up memory/CPU).
app.use(express.json({ limit: '10kb' }));

// Strips any request key starting with '$' or containing '.', which is
// how a NoSQL/Mongo query-operator injection attempt would be shaped
// (e.g. { "email": { "$gt": "" } } to bypass a login check).
app.use(mongoSanitize());

// General API rate limit — blunt protection against scripted abuse.
// This is NOT DDoS protection (that's an infrastructure/CDN-layer concern,
// not something Express code can meaningfully provide) — it's protection
// against a single client hammering the API or brute-forcing endpoints.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

// Tighter limit specifically on auth endpoints — the realistic threat
// here is password brute-forcing / credential stuffing, not general traffic.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Simple uptime check — also handy for confirming a deploy actually went live.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);

// Catch-all 404 for anything not matched above.
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

module.exports = app;
