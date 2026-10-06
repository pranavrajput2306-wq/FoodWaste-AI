const express = require('express');
const router = express.Router();

const { register, login, getMe } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const {
  registerValidationRules,
  loginValidationRules,
  handleValidationErrors,
} = require('../utils/validators');

// POST /api/auth/register
router.post(
  '/register',
  registerValidationRules,
  handleValidationErrors,
  register
);

// POST /api/auth/login
router.post(
  '/login',
  loginValidationRules,
  handleValidationErrors,
  login
);

// GET /api/auth/me  (protected)
router.get('/me', authenticate, getMe);

module.exports = router;
