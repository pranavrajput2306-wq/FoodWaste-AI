const express = require('express');
const router = express.Router();

const { getDashboardStats } = require('../controllers/dashboard.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireOrganization } = require('../middleware/organization.middleware');

// Protected & organization-scoped
router.get('/stats', authenticate, requireOrganization, getDashboardStats);

module.exports = router;
