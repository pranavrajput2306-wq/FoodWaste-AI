const { pool } = require('../config/database');
const { generateRecommendations } = require('../services/recommendation.service');

/**
 * GET /api/dashboard/stats
 * Aggregate real statistics from the database for the user's organization,
 * enhanced with sustainability insights and top recommendation.
 */
async function getDashboardStats(req, res, next) {
  try {
    const organizationId = req.organization.id;

    // 1. Food items count
    const [itemRows] = await pool.execute(
      'SELECT COUNT(id) AS total_items, COUNT(DISTINCT category) AS total_categories FROM food_items WHERE organization_id = ?',
      [organizationId]
    );

    // 2. Demand records totals (prepared, sold, wasted)
    const [demandRows] = await pool.execute(
      `SELECT 
         COUNT(id) AS total_records,
         COALESCE(SUM(quantity_prepared), 0) AS total_prepared,
         COALESCE(SUM(quantity_sold), 0)     AS total_sold,
         COALESCE(SUM(quantity_wasted), 0)   AS total_wasted
       FROM demand_records
       WHERE organization_id = ?`,
      [organizationId]
    );

    // 3. Recent 5 demand records
    const [recentRecords] = await pool.execute(
      `SELECT dr.id, DATE_FORMAT(dr.record_date, '%Y-%m-%d') AS record_date,
              dr.quantity_prepared, dr.quantity_sold, dr.quantity_wasted,
              fi.name AS food_item_name, fi.unit
       FROM demand_records dr
       JOIN food_items fi ON dr.food_item_id = fi.id
       WHERE dr.organization_id = ?
       ORDER BY dr.record_date DESC, dr.id DESC
       LIMIT 5`,
      [organizationId]
    );

    // 4. Highest-waste food item (real database calculation)
    const [highestWasteRows] = await pool.execute(
      `SELECT fi.id, fi.name, fi.unit,
              COALESCE(SUM(dr.quantity_wasted), 0) AS total_wasted,
              COALESCE(SUM(dr.quantity_prepared), 0) AS total_prepared,
              ROUND(
                CASE 
                  WHEN SUM(dr.quantity_prepared) > 0 THEN (SUM(dr.quantity_wasted) / SUM(dr.quantity_prepared)) * 100 
                  ELSE 0 
                END, 2
              ) AS waste_rate
       FROM food_items fi
       JOIN demand_records dr ON fi.id = dr.food_item_id AND dr.organization_id = ?
       WHERE fi.organization_id = ?
       GROUP BY fi.id, fi.name, fi.unit
       ORDER BY total_wasted DESC
       LIMIT 1`,
      [organizationId, organizationId]
    );

    const totalItems = parseInt(itemRows[0]?.total_items || 0, 10);
    const totalCategories = parseInt(itemRows[0]?.total_categories || 0, 10);

    const totalRecords = parseInt(demandRows[0]?.total_records || 0, 10);
    const totalPrepared = parseFloat(demandRows[0]?.total_prepared || 0);
    const totalSold = parseFloat(demandRows[0]?.total_sold || 0);
    const totalWasted = parseFloat(demandRows[0]?.total_wasted || 0);

    const wasteRate = totalPrepared > 0
      ? Number(((totalWasted / totalPrepared) * 100).toFixed(2))
      : 0;

    // 5. Recent trend calculation
    let recentTrend = 'insufficient_data';
    if (totalRecords >= 4) {
      const [trendSplitRows] = await pool.execute(
        `SELECT dr.id, dr.quantity_prepared, dr.quantity_wasted
         FROM demand_records dr
         WHERE dr.organization_id = ?
         ORDER BY dr.record_date DESC, dr.id DESC
         LIMIT 6`,
        [organizationId]
      );
      if (trendSplitRows.length >= 4) {
        const recent2 = trendSplitRows.slice(0, 2);
        const older = trendSplitRows.slice(2);
        const rPrep = recent2.reduce((s, r) => s + parseFloat(r.quantity_prepared), 0);
        const rWaste = recent2.reduce((s, r) => s + parseFloat(r.quantity_wasted), 0);
        const oPrep = older.reduce((s, r) => s + parseFloat(r.quantity_prepared), 0);
        const oWaste = older.reduce((s, r) => s + parseFloat(r.quantity_wasted), 0);
        const rRate = rPrep > 0 ? (rWaste / rPrep) * 100 : 0;
        const oRate = oPrep > 0 ? (oWaste / oPrep) * 100 : 0;
        if (rRate < oRate - 2) recentTrend = 'improving';
        else if (rRate > oRate + 2) recentTrend = 'worsening';
        else recentTrend = 'stable';
      }
    }

    // 6. Actionable recommendations
    const recResult = await generateRecommendations(organizationId, pool);

    const formattedRecent = recentRecords.map((r) => {
      let dateStr = '';
      if (typeof r.record_date === 'string') {
        const match = r.record_date.match(/^(\d{4}-\d{2}-\d{2})/);
        dateStr = match ? match[1] : r.record_date;
      } else if (r.record_date instanceof Date) {
        const y = r.record_date.getFullYear();
        const m = String(r.record_date.getMonth() + 1).padStart(2, '0');
        const d = String(r.record_date.getDate()).padStart(2, '0');
        dateStr = `${y}-${m}-${d}`;
      } else {
        dateStr = String(r.record_date || '');
      }

      return {
        ...r,
        record_date: dateStr,
        quantity_prepared: parseFloat(r.quantity_prepared),
        quantity_sold: parseFloat(r.quantity_sold),
        quantity_wasted: parseFloat(r.quantity_wasted),
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        organization: {
          id: req.organization.id,
          name: req.organization.name,
          organization_type: req.organization.organization_type,
          role: req.organization.role,
        },
        stats: {
          total_food_items: totalItems,
          total_categories: totalCategories,
          total_records: totalRecords,
          total_prepared: totalPrepared,
          total_sold: totalSold,
          total_wasted: totalWasted,
          waste_rate: wasteRate,
        },
        insights: {
          current_waste_rate: wasteRate,
          highest_waste_item: highestWasteRows[0] ? {
            id: highestWasteRows[0].id,
            name: highestWasteRows[0].name,
            unit: highestWasteRows[0].unit,
            total_wasted: parseFloat(highestWasteRows[0].total_wasted),
            waste_rate: parseFloat(highestWasteRows[0].waste_rate),
          } : null,
          recent_trend: recentTrend,
          top_recommendation: recResult.recommendations[0] || null,
        },
        recent_records: formattedRecent,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getDashboardStats };
