const express = require('express');
const router = express.Router();

const { register, login, getMe } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authLimiter } = require('../middleware/rateLimit.middleware');
const {
  registerValidationRules,
  loginValidationRules,
  handleValidationErrors,
} = require('../utils/validators');

// POST /api/auth/register (Rate-limited)
router.post(
  '/register',
  authLimiter,
  registerValidationRules,
  handleValidationErrors,
  register
);

// POST /api/auth/login (Rate-limited)
router.post(
  '/login',
  authLimiter,
  loginValidationRules,
  handleValidationErrors,
  login
);

// GET /api/auth/me  (protected)
router.get('/me', authenticate, getMe);

module.exports = router;
