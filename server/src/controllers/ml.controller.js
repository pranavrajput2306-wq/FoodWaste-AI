const { pool } = require('../config/database');
const mlService = require('../services/ml.service');

/**
 * Helper to fetch food item and verify organization ownership.
 */
async function getVerifiedFoodItem(foodItemId, organizationId) {
  const [items] = await pool.execute(
    'SELECT id, name, category, unit FROM food_items WHERE id = ? AND organization_id = ?',
    [foodItemId, organizationId]
  );
  return items.length > 0 ? items[0] : null;
}

/**
 * Helper to fetch historical demand records strictly prior to target_date.
 */
async function getPriorHistoricalRecords(foodItemId, organizationId, targetDate) {
  const [rows] = await pool.execute(
    `SELECT DATE_FORMAT(record_date, '%Y-%m-%d') AS record_date,
            CAST(quantity_prepared AS DOUBLE) AS quantity_prepared,
            CAST(quantity_sold AS DOUBLE) AS quantity_sold,
            CAST(quantity_wasted AS DOUBLE) AS quantity_wasted
     FROM demand_records
     WHERE food_item_id = ? AND organization_id = ? AND record_date < ?
     ORDER BY record_date ASC`,
    [foodItemId, organizationId, targetDate]
  );
  return rows;
}

/**
 * GET /api/ml/health
 * Check ML service connectivity.
 */
async function checkMLHealth(req, res) {
  try {
    const health = await mlService.getHealth();
    return res.status(200).json({
      success: true,
      service: 'express-ml-gateway',
      ml_service: health,
    });
  } catch (err) {
    return res.status(err.statusCode || 503).json({
      success: false,
      service: 'express-ml-gateway',
      message: err.message || 'ML service unreachable.',
      ml_service_available: false,
    });
  }
}

/**
 * POST /api/ml/predict/demand
 * Body: { food_item_id, target_date, planned_quantity_prepared }
 */
async function handlePredictDemand(req, res, next) {
  try {
    const organizationId = req.organization.id;
    const { food_item_id, target_date, planned_quantity_prepared } = req.body;

    // 1. Verify food item ownership
    const foodItem = await getVerifiedFoodItem(food_item_id, organizationId);
    if (!foodItem) {
      return res.status(404).json({
        success: false,
        message: 'Food item not found or you do not have permission to access it.',
      });
    }

    // 2. Fetch prior historical records
    const history = await getPriorHistoricalRecords(food_item_id, organizationId, target_date);

    // 3. Build payload for ML service
    const payload = {
      food_item_id: Number(food_item_id),
      target_date,
      planned_quantity_prepared: parseFloat(planned_quantity_prepared),
      historical_records: history,
    };

    // 4. Call ML service
    const mlResponse = await mlService.predictDemand(payload);

    return res.status(200).json({
      ...mlResponse,
      food_item_name: foodItem.name,
      food_item_category: foodItem.category,
      unit: foodItem.unit,
      prior_records_available: history.length,
    });
  } catch (err) {
    if (err.name === 'MLServiceError') {
      return res.status(err.statusCode || 503).json({
        success: false,
        status: 'ml_service_error',
        message: err.message,
      });
    }
    next(err);
  }
}

/**
 * POST /api/ml/predict/waste-risk
 * Body: { food_item_id, target_date, planned_quantity_prepared }
 */
async function handlePredictWasteRisk(req, res, next) {
  try {
    const organizationId = req.organization.id;
    const { food_item_id, target_date, planned_quantity_prepared } = req.body;

    // 1. Verify food item ownership
    const foodItem = await getVerifiedFoodItem(food_item_id, organizationId);
    if (!foodItem) {
      return res.status(404).json({
        success: false,
        message: 'Food item not found or you do not have permission to access it.',
      });
    }

    // 2. Fetch prior historical records
    const history = await getPriorHistoricalRecords(food_item_id, organizationId, target_date);

    // 3. Build payload for ML service
    const payload = {
      food_item_id: Number(food_item_id),
      target_date,
      planned_quantity_prepared: parseFloat(planned_quantity_prepared),
      historical_records: history,
    };

    // 4. Call ML service
    const mlResponse = await mlService.predictWasteRisk(payload);

    return res.status(200).json({
      ...mlResponse,
      food_item_name: foodItem.name,
      food_item_category: foodItem.category,
      unit: foodItem.unit,
      prior_records_available: history.length,
    });
  } catch (err) {
    if (err.name === 'MLServiceError') {
      return res.status(err.statusCode || 503).json({
        success: false,
        status: 'ml_service_error',
        message: err.message,
      });
    }
    next(err);
  }
}

module.exports = {
  checkMLHealth,
  handlePredictDemand,
  handlePredictWasteRisk,
};
