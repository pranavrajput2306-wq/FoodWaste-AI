const express = require('express');
const router = express.Router();

const {
  getCurrentOrganization,
  createOrganization,
  updateCurrentOrganization,
} = require('../controllers/organization.controller');
const { authenticate } = require('../middleware/auth.middleware');
const {
  organizationValidationRules,
  handleValidationErrors,
} = require('../utils/validators');

// All organization routes require authentication
router.use(authenticate);

// GET /api/organizations/current
router.get('/current', getCurrentOrganization);

// POST /api/organizations
router.post(
  '/',
  organizationValidationRules,
  handleValidationErrors,
  createOrganization
);

// PUT /api/organizations/current
router.put(
  '/current',
  organizationValidationRules,
  handleValidationErrors,
  updateCurrentOrganization
);

module.exports = router;
