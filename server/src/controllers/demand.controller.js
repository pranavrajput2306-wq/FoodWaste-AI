const { pool } = require('../config/database');

/**
 * Extract calendar date YYYY-MM-DD safely without timezone shifts.
 */
function extractCalendarDate(val) {
  if (!val) return '';
  if (typeof val === 'string') {
    const match = val.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  if (val instanceof Date) {
    const year = val.getFullYear();
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const day = String(val.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(val);
}

/**
 * GET /api/demand
 * List historical demand records with filtering, organization-scoped.
 * Query params: food_item_id, start_date, end_date, limit
 */
async function listDemandRecords(req, res, next) {
  try {
    const organizationId = req.organization.id;
    const { food_item_id, start_date, end_date, limit = 200 } = req.query;

    let query = `
      SELECT dr.id, dr.organization_id, dr.food_item_id,
             DATE_FORMAT(dr.record_date, '%Y-%m-%d') AS record_date,
             dr.quantity_prepared, dr.quantity_sold, dr.quantity_wasted,
             dr.created_at,
             fi.name AS food_item_name, fi.category AS food_item_category, fi.unit,
             ROUND(
               CASE 
                 WHEN dr.quantity_prepared > 0 THEN (dr.quantity_wasted / dr.quantity_prepared) * 100 
                 ELSE 0 
               END, 2
             ) AS waste_percentage
      FROM demand_records dr
      JOIN food_items fi ON dr.food_item_id = fi.id
      WHERE dr.organization_id = ?
    `;

    const params = [organizationId];

    if (food_item_id) {
      query += ' AND dr.food_item_id = ?';
      params.push(Number(food_item_id));
    }

    if (start_date) {
      query += ' AND dr.record_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND dr.record_date <= ?';
      params.push(end_date);
    }

    query += ' ORDER BY dr.record_date DESC, dr.id DESC LIMIT ?';
    params.push(Math.min(parseInt(limit, 10) || 200, 1000));

    const [records] = await pool.execute(query, params);

    // Format record_date to pure YYYY-MM-DD
    const formatted = records.map((r) => ({
      ...r,
      record_date: extractCalendarDate(r.record_date),
      quantity_prepared: parseFloat(r.quantity_prepared),
      quantity_sold: parseFloat(r.quantity_sold),
      quantity_wasted: parseFloat(r.quantity_wasted),
      waste_percentage: parseFloat(r.waste_percentage),
    }));

    return res.status(200).json({
      success: true,
      data: formatted,
      total: formatted.length,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/demand/:id
 * Retrieve a single demand record by ID.
 */
async function getDemandRecord(req, res, next) {
  try {
    const { id } = req.params;
    const organizationId = req.organization.id;

    const [rows] = await pool.execute(
      `SELECT dr.id, dr.organization_id, dr.food_item_id,
              DATE_FORMAT(dr.record_date, '%Y-%m-%d') AS record_date,
              dr.quantity_prepared, dr.quantity_sold, dr.quantity_wasted,
              dr.created_at,
              fi.name AS food_item_name, fi.category AS food_item_category, fi.unit,
              ROUND(
                CASE 
                  WHEN dr.quantity_prepared > 0 THEN (dr.quantity_wasted / dr.quantity_prepared) * 100 
                  ELSE 0 
                END, 2
              ) AS waste_percentage
       FROM demand_records dr
       JOIN food_items fi ON dr.food_item_id = fi.id
       WHERE dr.id = ? AND dr.organization_id = ?`,
      [id, organizationId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Demand record not found or you do not have permission to view it.',
      });
    }

    const record = rows[0];
    const formatted = {
      ...record,
      record_date: extractCalendarDate(record.record_date),
      quantity_prepared: parseFloat(record.quantity_prepared),
      quantity_sold: parseFloat(record.quantity_sold),
      quantity_wasted: parseFloat(record.quantity_wasted),
      waste_percentage: parseFloat(record.waste_percentage),
    };

    return res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/demand
 * Create a new demand record.
 * Validates logical bounds: sold + wasted <= prepared.
 */
async function createDemandRecord(req, res, next) {
  try {
    const organizationId = req.organization.id;
    const { food_item_id, record_date, quantity_prepared, quantity_sold, quantity_wasted } = req.body;

    const prepared = parseFloat(quantity_prepared);
    const sold = parseFloat(quantity_sold);
    const wasted = parseFloat(quantity_wasted);

    // Non-negative validation safeguard
    if (isNaN(prepared) || prepared < 0) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed.',
        errors: [{ field: 'quantity_prepared', message: 'Quantity prepared cannot be negative.' }],
      });
    }

    if (isNaN(sold) || sold < 0) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed.',
        errors: [{ field: 'quantity_sold', message: 'Quantity sold cannot be negative.' }],
      });
    }

    if (isNaN(wasted) || wasted < 0) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed.',
        errors: [{ field: 'quantity_wasted', message: 'Quantity wasted cannot be negative.' }],
      });
    }

    // Logical validation safeguard
    if (wasted > prepared) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed.',
        errors: [{ field: 'quantity_wasted', message: 'Quantity wasted cannot exceed quantity prepared.' }],
      });
    }

    if ((sold + wasted) > prepared) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed.',
        errors: [{ field: 'quantity_sold', message: 'Quantity sold plus quantity wasted cannot exceed quantity prepared.' }],
      });
    }

    // Verify the food item exists and belongs to this organization
    const [itemRows] = await pool.execute(
      'SELECT id, name, unit, category FROM food_items WHERE id = ? AND organization_id = ?',
      [food_item_id, organizationId]
    );

    if (itemRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'The selected food item does not exist or does not belong to your organization.',
      });
    }

    // Pure calendar date validation (YYYY-MM-DD)
    const calendarDate = String(record_date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(calendarDate)) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed.',
        errors: [{ field: 'record_date', message: 'Record date must be a valid date in YYYY-MM-DD format.' }],
      });
    }

    // Check duplicate (organization_id, food_item_id, record_date)
    const [existing] = await pool.execute(
      'SELECT id FROM demand_records WHERE organization_id = ? AND food_item_id = ? AND record_date = ?',
      [organizationId, food_item_id, calendarDate]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A demand record for this food item and date already exists. Please update the existing record.',
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO demand_records
         (organization_id, food_item_id, record_date, quantity_prepared, quantity_sold, quantity_wasted)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [organizationId, food_item_id, calendarDate, prepared, sold, wasted]
    );

    const recordId = result.insertId;
    const foodItem = itemRows[0];
    const wastePercentage = prepared > 0 ? Number(((wasted / prepared) * 100).toFixed(2)) : 0;

    return res.status(201).json({
      success: true,
      message: 'Demand record recorded successfully.',
      data: {
        id: recordId,
        organization_id: organizationId,
        food_item_id: Number(food_item_id),
        food_item_name: foodItem.name,
        food_item_category: foodItem.category,
        unit: foodItem.unit,
        record_date: calendarDate,
        quantity_prepared: prepared,
        quantity_sold: sold,
        quantity_wasted: wasted,
        waste_percentage: wastePercentage,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/demand/:id
 * Update an existing demand record.
 */
async function updateDemandRecord(req, res, next) {
  try {
    const { id } = req.params;
    const organizationId = req.organization.id;
    const { food_item_id, record_date, quantity_prepared, quantity_sold, quantity_wasted } = req.body;

    const prepared = parseFloat(quantity_prepared);
    const sold = parseFloat(quantity_sold);
    const wasted = parseFloat(quantity_wasted);

    // Non-negative validation safeguard
    if (isNaN(prepared) || prepared < 0) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed.',
        errors: [{ field: 'quantity_prepared', message: 'Quantity prepared cannot be negative.' }],
      });
    }

    if (isNaN(sold) || sold < 0) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed.',
        errors: [{ field: 'quantity_sold', message: 'Quantity sold cannot be negative.' }],
      });
    }

    if (isNaN(wasted) || wasted < 0) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed.',
        errors: [{ field: 'quantity_wasted', message: 'Quantity wasted cannot be negative.' }],
      });
    }

    // Logical validation safeguard
    if (wasted > prepared) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed.',
        errors: [{ field: 'quantity_wasted', message: 'Quantity wasted cannot exceed quantity prepared.' }],
      });
    }

    if ((sold + wasted) > prepared) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed.',
        errors: [{ field: 'quantity_sold', message: 'Quantity sold plus quantity wasted cannot exceed quantity prepared.' }],
      });
    }

    // Verify record exists and belongs to this organization
    const [existing] = await pool.execute(
      'SELECT id FROM demand_records WHERE id = ? AND organization_id = ?',
      [id, organizationId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Demand record not found or you do not have permission to modify it.',
      });
    }

    // Verify the target food item belongs to this organization
    const [itemRows] = await pool.execute(
      'SELECT id, name, unit, category FROM food_items WHERE id = ? AND organization_id = ?',
      [food_item_id, organizationId]
    );

    if (itemRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'The selected food item does not exist or does not belong to your organization.',
      });
    }

    // Pure calendar date validation (YYYY-MM-DD)
    const calendarDate = String(record_date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(calendarDate)) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed.',
        errors: [{ field: 'record_date', message: 'Record date must be a valid date in YYYY-MM-DD format.' }],
      });
    }

    // Check duplicate date on another record for the same food item in this organization
    const [duplicate] = await pool.execute(
      'SELECT id FROM demand_records WHERE organization_id = ? AND food_item_id = ? AND record_date = ? AND id != ?',
      [organizationId, food_item_id, calendarDate, id]
    );

    if (duplicate.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Another demand record for this food item and date already exists.',
      });
    }

    await pool.execute(
      `UPDATE demand_records
       SET food_item_id = ?, record_date = ?, quantity_prepared = ?, quantity_sold = ?, quantity_wasted = ?
       WHERE id = ? AND organization_id = ?`,
      [food_item_id, calendarDate, prepared, sold, wasted, id, organizationId]
    );

    const foodItem = itemRows[0];
    const wastePercentage = prepared > 0 ? Number(((wasted / prepared) * 100).toFixed(2)) : 0;

    return res.status(200).json({
      success: true,
      message: 'Demand record updated successfully.',
      data: {
        id: Number(id),
        organization_id: organizationId,
        food_item_id: Number(food_item_id),
        food_item_name: foodItem.name,
        food_item_category: foodItem.category,
        unit: foodItem.unit,
        record_date: calendarDate,
        quantity_prepared: prepared,
        quantity_sold: sold,
        quantity_wasted: wasted,
        waste_percentage: wastePercentage,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/demand/:id
 * Delete a demand record (scoped to organization).
 */
async function deleteDemandRecord(req, res, next) {
  try {
    const { id } = req.params;
    const organizationId = req.organization.id;

    const [existing] = await pool.execute(
      'SELECT id FROM demand_records WHERE id = ? AND organization_id = ?',
      [id, organizationId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Demand record not found or you do not have permission to delete it.',
      });
    }

    await pool.execute(
      'DELETE FROM demand_records WHERE id = ? AND organization_id = ?',
      [id, organizationId]
    );

    return res.status(200).json({
      success: true,
      message: 'Demand record deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listDemandRecords,
  getDemandRecord,
  createDemandRecord,
  updateDemandRecord,
  deleteDemandRecord,
};
