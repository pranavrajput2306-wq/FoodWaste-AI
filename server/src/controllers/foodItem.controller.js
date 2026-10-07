const { pool } = require('../config/database');

/**
 * GET /api/food-items
 * List all food items belonging to the user's organization.
 */
async function listFoodItems(req, res, next) {
  try {
    const organizationId = req.organization.id;

    const [items] = await pool.execute(
      `SELECT fi.id, fi.organization_id, fi.name, fi.category, fi.unit, fi.unit_cost,
              fi.created_at, fi.updated_at,
              COUNT(dr.id) AS demand_record_count
       FROM food_items fi
       LEFT JOIN demand_records dr ON dr.food_item_id = fi.id
       WHERE fi.organization_id = ?
       GROUP BY fi.id
       ORDER BY fi.name ASC`,
      [organizationId]
    );

    return res.status(200).json({
      success: true,
      data: items,
      total: items.length,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/food-items/:id
 * Retrieve a single food item by ID (scoped to user's organization).
 */
async function getFoodItem(req, res, next) {
  try {
    const { id } = req.params;
    const organizationId = req.organization.id;

    const [rows] = await pool.execute(
      `SELECT id, organization_id, name, category, unit, unit_cost, created_at, updated_at
       FROM food_items
       WHERE id = ? AND organization_id = ?`,
      [id, organizationId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Food item not found or you do not have permission to access it.',
      });
    }

    return res.status(200).json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/food-items
 * Add a new food item to the user's organization.
 */
async function createFoodItem(req, res, next) {
  try {
    const organizationId = req.organization.id;
    const { name, category = 'Uncategorized', unit = 'portions', unit_cost } = req.body;

    const cleanName = name.trim();
    const cleanCategory = (category || 'Uncategorized').trim();
    const cleanUnit = (unit || 'portions').trim();
    const cleanUnitCost = (unit_cost !== undefined && unit_cost !== null && unit_cost !== '')
      ? Number(parseFloat(unit_cost).toFixed(2))
      : null;

    // Check duplicate name within the same organization
    const [existing] = await pool.execute(
      'SELECT id FROM food_items WHERE organization_id = ? AND LOWER(name) = LOWER(?)',
      [organizationId, cleanName]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A food item with this name already exists in your organization.',
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO food_items (organization_id, name, category, unit, unit_cost)
       VALUES (?, ?, ?, ?, ?)`,
      [organizationId, cleanName, cleanCategory, cleanUnit, cleanUnitCost]
    );

    const [created] = await pool.execute(
      'SELECT id, organization_id, name, category, unit, unit_cost, created_at, updated_at FROM food_items WHERE id = ?',
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: 'Food item created successfully.',
      data: created[0],
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/food-items/:id
 * Update an existing food item.
 */
async function updateFoodItem(req, res, next) {
  try {
    const { id } = req.params;
    const organizationId = req.organization.id;
    const { name, category = 'Uncategorized', unit = 'portions', unit_cost } = req.body;

    const cleanName = name.trim();
    const cleanCategory = (category || 'Uncategorized').trim();
    const cleanUnit = (unit || 'portions').trim();

    // Verify item exists and belongs to this organization
    const [existing] = await pool.execute(
      'SELECT id, unit_cost FROM food_items WHERE id = ? AND organization_id = ?',
      [id, organizationId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Food item not found or you do not have permission to modify it.',
      });
    }

    // Check duplicate name on another food item in the same organization
    const [duplicate] = await pool.execute(
      'SELECT id FROM food_items WHERE organization_id = ? AND LOWER(name) = LOWER(?) AND id != ?',
      [organizationId, cleanName, id]
    );

    if (duplicate.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Another food item with this name already exists in your organization.',
      });
    }

    const cleanUnitCost = (unit_cost !== undefined)
      ? (unit_cost !== null && unit_cost !== '' ? Number(parseFloat(unit_cost).toFixed(2)) : null)
      : existing[0].unit_cost;

    await pool.execute(
      `UPDATE food_items
       SET name = ?, category = ?, unit = ?, unit_cost = ?
       WHERE id = ? AND organization_id = ?`,
      [cleanName, cleanCategory, cleanUnit, cleanUnitCost, id, organizationId]
    );

    const [updated] = await pool.execute(
      'SELECT id, organization_id, name, category, unit, unit_cost, created_at, updated_at FROM food_items WHERE id = ?',
      [id]
    );

    return res.status(200).json({
      success: true,
      message: 'Food item updated successfully.',
      data: updated[0],
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/food-items/:id
 * Delete a food item (scoped to organization).
 */
async function deleteFoodItem(req, res, next) {
  try {
    const { id } = req.params;
    const organizationId = req.organization.id;

    const [existing] = await pool.execute(
      'SELECT id, name FROM food_items WHERE id = ? AND organization_id = ?',
      [id, organizationId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Food item not found or you do not have permission to delete it.',
      });
    }

    await pool.execute(
      'DELETE FROM food_items WHERE id = ? AND organization_id = ?',
      [id, organizationId]
    );

    return res.status(200).json({
      success: true,
      message: `Food item "${existing[0].name}" deleted successfully.`,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listFoodItems,
  getFoodItem,
  createFoodItem,
  updateFoodItem,
  deleteFoodItem,
};
