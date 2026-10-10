const { body, validationResult } = require('express-validator');

// ---------------------------------------------------------------------------
// Validation rule sets
// ---------------------------------------------------------------------------

const registerValidationRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required.')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters.'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Must be a valid email address.')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required.')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
    .matches(/[0-9]/).withMessage('Password must contain at least one digit.'),

  body('role')
    .optional()
    .isIn(['admin', 'user']).withMessage("Role must be 'admin' or 'user'."),
];

const loginValidationRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Must be a valid email address.')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required.'),
];

const organizationValidationRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Organization name is required.')
    .isLength({ min: 2, max: 150 }).withMessage('Organization name must be 2–150 characters.'),

  body('organization_type')
    .optional()
    .isIn(['restaurant', 'cafeteria', 'canteen', 'institutional', 'other'])
    .withMessage("Invalid organization type. Allowed: 'restaurant', 'cafeteria', 'canteen', 'institutional', 'other'."),
];

const foodItemValidationRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Food item name is required.')
    .isLength({ min: 2, max: 150 }).withMessage('Food item name must be 2–150 characters.'),

  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Category cannot exceed 100 characters.'),

  body('unit')
    .optional()
    .trim()
    .isLength({ max: 30 }).withMessage('Unit cannot exceed 30 characters.'),

  body('unit_cost')
    .optional({ nullable: true })
    .custom((val) => {
      if (val === null || val === undefined || val === '') return true;
      const num = Number(val);
      if (isNaN(num) || num < 0) {
        throw new Error('Unit cost must be a non-negative decimal value.');
      }
      return true;
    }),
];

const demandRecordValidationRules = [
  body('food_item_id')
    .notEmpty().withMessage('Food item is required.')
    .isInt({ min: 1 }).withMessage('Valid food item ID is required.'),

  body('record_date')
    .trim()
    .notEmpty().withMessage('Record date is required.')
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Record date must be a valid date in YYYY-MM-DD format.')
    .custom((val) => {
      const parts = val.split('-').map(Number);
      const m = parts[1];
      const d = parts[2];
      if (m < 1 || m > 12 || d < 1 || d > 31) {
        throw new Error('Record date contains an invalid month or day.');
      }
      return true;
    }),

  body('quantity_prepared')
    .notEmpty().withMessage('Quantity prepared is required.')
    .isFloat().withMessage('Quantity prepared must be a valid number.')
    .custom((val) => {
      const num = parseFloat(val);
      if (isNaN(num)) {
        throw new Error('Quantity prepared must be a valid number.');
      }
      if (num < 0) {
        throw new Error('Quantity prepared cannot be negative.');
      }
      return true;
    }),

  body('quantity_sold')
    .notEmpty().withMessage('Quantity sold is required.')
    .isFloat().withMessage('Quantity sold must be a valid number.')
    .custom((val) => {
      const num = parseFloat(val);
      if (isNaN(num)) {
        throw new Error('Quantity sold must be a valid number.');
      }
      if (num < 0) {
        throw new Error('Quantity sold cannot be negative.');
      }
      return true;
    }),

  body('quantity_wasted')
    .notEmpty().withMessage('Quantity wasted is required.')
    .isFloat().withMessage('Quantity wasted must be a valid number.')
    .custom((quantity_wasted, { req }) => {
      const wasted = parseFloat(quantity_wasted);
      if (isNaN(wasted)) {
        throw new Error('Quantity wasted must be a valid number.');
      }
      if (wasted < 0) {
        throw new Error('Quantity wasted cannot be negative.');
      }

      const prepared = parseFloat(req.body.quantity_prepared);
      const sold = parseFloat(req.body.quantity_sold);

      // Only evaluate logical bounds if prepared is non-negative
      if (!isNaN(prepared) && prepared >= 0) {
        if (wasted > prepared) {
          throw new Error('Quantity wasted cannot exceed quantity prepared.');
        }
        if (!isNaN(sold) && sold >= 0 && (sold + wasted) > prepared) {
          throw new Error('Quantity sold plus quantity wasted cannot exceed quantity prepared.');
        }
      }
      return true;
    }),
];

const predictionValidationRules = [
  body('food_item_id')
    .notEmpty().withMessage('Food item is required.')
    .isInt({ min: 1 }).withMessage('Valid food item ID is required.'),

  body('target_date')
    .notEmpty().withMessage('Target date is required.')
    .isISO8601().withMessage('Target date must be a valid date in YYYY-MM-DD format.'),

  body('planned_quantity_prepared')
    .notEmpty().withMessage('Planned quantity prepared is required.')
    .isFloat({ min: 0 }).withMessage('Planned quantity must be a non-negative number.'),
];

// ---------------------------------------------------------------------------
// Validation result handler middleware
// ---------------------------------------------------------------------------

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed.',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

module.exports = {
  registerValidationRules,
  loginValidationRules,
  organizationValidationRules,
  foodItemValidationRules,
  demandRecordValidationRules,
  predictionValidationRules,
  handleValidationErrors,
};


