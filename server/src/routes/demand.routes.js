const express = require('express');
const router = express.Router();

const {
  listDemandRecords,
  getDemandRecord,
  createDemandRecord,
  updateDemandRecord,
  deleteDemandRecord,
} = require('../controllers/demand.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireOrganization } = require('../middleware/organization.middleware');
const {
  demandRecordValidationRules,
  handleValidationErrors,
} = require('../utils/validators');

// All demand routes require authentication and organization scope
router.use(authenticate, requireOrganization);

// GET /api/demand
router.get('/', listDemandRecords);

// GET /api/demand/:id
router.get('/:id', getDemandRecord);

// POST /api/demand
router.post(
  '/',
  demandRecordValidationRules,
  handleValidationErrors,
  createDemandRecord
);

// PUT /api/demand/:id
router.put(
  '/:id',
  demandRecordValidationRules,
  handleValidationErrors,
  updateDemandRecord
);

// DELETE /api/demand/:id
router.delete('/:id', deleteDemandRecord);

module.exports = router;
