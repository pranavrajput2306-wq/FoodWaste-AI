const rateLimit = require('express-rate-limit');

/**
 * Focused authentication rate limiter.
 * Protects POST /api/auth/login and POST /api/auth/register against brute-force attacks.
 * Allows generous thresholds in development/testing, production-safe limits in production.
 */
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// In production: max 15 attempts per 15 minutes per IP
// In dev/test: max 500 attempts per 15 minutes to allow automated verification suites
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 15 : (isTest ? 1000 : 500),
  standardHeaders: true, // Draft-6 RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  statusCode: 429,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
    retryAfterMinutes: 15,
  },
  skip: (req) => {
    // Optional bypass header for local internal testing when explicitly configured
    if (process.env.RATE_LIMIT_DISABLED === 'true') {
      return true;
    }
    return false;
  },
});

module.exports = { authLimiter };
