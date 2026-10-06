const express = require('express');
const router = express.Router();

const {
  listFoodItems,
  getFoodItem,
  createFoodItem,
  updateFoodItem,
  deleteFoodItem,
} = require('../controllers/foodItem.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireOrganization } = require('../middleware/organization.middleware');
const {
  foodItemValidationRules,
  handleValidationErrors,
} = require('../utils/validators');

// All food-item routes require authentication and organization scope
router.use(authenticate, requireOrganization);

// GET /api/food-items
router.get('/', listFoodItems);

// GET /api/food-items/:id
router.get('/:id', getFoodItem);

// POST /api/food-items
router.post(
  '/',
  foodItemValidationRules,
  handleValidationErrors,
  createFoodItem
);

// PUT /api/food-items/:id
router.put(
  '/:id',
  foodItemValidationRules,
  handleValidationErrors,
  updateFoodItem
);

// DELETE /api/food-items/:id
router.delete('/:id', deleteFoodItem);

module.exports = router;
