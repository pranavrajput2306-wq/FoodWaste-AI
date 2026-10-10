const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const { validateEnv } = require('./config/env');

// Validate environment on app load
const envConfig = validateEnv();

const authRoutes = require('./routes/auth.routes');
const organizationRoutes = require('./routes/organization.routes');
const foodItemRoutes = require('./routes/foodItem.routes');
const demandRoutes = require('./routes/demand.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const mlRoutes = require('./routes/ml.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const { errorHandler, notFound } = require('./middleware/error.middleware');

const app = express();

// ---------------------------------------------------------------------------
// Reverse proxy configuration (trust first proxy when behind ingress/load balancer)
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
} else {
  app.set('trust proxy', 'loopback');
}

// ---------------------------------------------------------------------------
// Security & parsing middleware
// ---------------------------------------------------------------------------
app.use(helmet());

// Production CORS: enforces strict origin matching without wildcard
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server or test scripts)
    if (!origin) return callback(null, true);

    const allowedOrigins = (envConfig.clientOrigin || 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim());

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    if (process.env.NODE_ENV === 'production') {
      const err = new Error('CORS request blocked: Origin not allowed by production policy.');
      err.statusCode = 403;
      return callback(err);
    }

    // In development, permit localhost origins
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }

    const err = new Error(`CORS request blocked for origin: ${origin}`);
    err.statusCode = 403;
    return callback(err);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Service-Key'],
};

app.use(cors(corsOptions));

// Hardened body parser limits (1mb is plenty for json records; prevents memory exhaustion)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Food Waste AI API is running.',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/food-items', foodItemRoutes);
app.use('/api/demand', demandRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ml', mlRoutes);
app.use('/api/analytics', analyticsRoutes);

// ---------------------------------------------------------------------------
// Error handling (must be last)
// ---------------------------------------------------------------------------
app.use(notFound);
app.use(errorHandler);

module.exports = app;
