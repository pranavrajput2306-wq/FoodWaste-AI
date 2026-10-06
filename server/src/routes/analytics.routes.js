const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireOrganization } = require('../middleware/organization.middleware');
const {
  getAnalyticsSummary,
  getRecommendationsHandler,
} = require('../controllers/analytics.controller');

// All analytics routes require authenticated user and linked organization
router.use(authenticate, requireOrganization);

router.get('/summary', getAnalyticsSummary);
router.get('/recommendations', getRecommendationsHandler);

module.exports = router;
