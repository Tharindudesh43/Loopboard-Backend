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


app.set('trust proxy', 1);

//Sets a standard set of protective HTTP headers
app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_URL || '*',
  })
);


//Bounded body size
app.use(express.json({ limit: '10kb' }));


app.use(mongoSanitize());


//General API rate limit
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});


//Tighter limit specifically on auth endpoints
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


//Simple uptime check — also handy for confirming a deploy actually went live.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});


app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);

//Catch all 404 
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

module.exports = app;
