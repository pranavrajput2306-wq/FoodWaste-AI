const express = require('express');
const router = express.Router();

const {
  checkMLHealth,
  handlePredictDemand,
  handlePredictWasteRisk,
} = require('../controllers/ml.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireOrganization } = require('../middleware/organization.middleware');
const {
  predictionValidationRules,
  handleValidationErrors,
} = require('../utils/validators');

// Public/semi-protected health check
router.get('/health', checkMLHealth);

// Protected prediction endpoints (require auth and organization scope)
router.post(
  '/predict/demand',
  authenticate,
  requireOrganization,
  predictionValidationRules,
  handleValidationErrors,
  handlePredictDemand
);

router.post(
  '/predict/waste-risk',
  authenticate,
  requireOrganization,
  predictionValidationRules,
  handleValidationErrors,
  handlePredictWasteRisk
);

module.exports = router;
