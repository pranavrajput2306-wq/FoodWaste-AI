const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

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
// Security & parsing middleware
// ---------------------------------------------------------------------------
app.use(helmet());

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Food Waste AI API is running.',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
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
