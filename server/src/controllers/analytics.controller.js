const { pool } = require('../config/database');
const { generateRecommendations } = require('../services/recommendation.service');
const { calculateFinancialImpact } = require('../services/financial.service');
const { calculateOrganizationBenchmark } = require('../services/benchmark.service');
const { calculateWasteReductionGoal } = require('../services/goal.service');

/**
 * GET /api/analytics/summary
 * Full analytics data based strictly on real MySQL records for the organization.
 */
async function getAnalyticsSummary(req, res, next) {
  try {
    const organizationId = req.organization.id;

    // 1. Overall totals & counts
    const [totalsRows] = await pool.execute(
      `SELECT 
         COUNT(id) AS total_records,
         COALESCE(SUM(quantity_prepared), 0) AS total_prepared,
         COALESCE(SUM(quantity_sold), 0)     AS total_sold,
         COALESCE(SUM(quantity_wasted), 0)   AS total_wasted,
         MIN(record_date)                    AS first_record_date,
         MAX(record_date)                    AS last_record_date,
         COUNT(DISTINCT record_date)         AS total_days_recorded,
         COUNT(DISTINCT food_item_id)        AS active_items_count
       FROM demand_records
       WHERE organization_id = ?`,
      [organizationId]
    );

    // 2. Total registered food items
    const [itemsCountRow] = await pool.execute(
      'SELECT COUNT(id) AS total_items FROM food_items WHERE organization_id = ?',
      [organizationId]
    );

    const totalRecords = parseInt(totalsRows[0]?.total_records || 0, 10);
    const totalPrepared = parseFloat(totalsRows[0]?.total_prepared || 0);
    const totalSold = parseFloat(totalsRows[0]?.total_sold || 0);
    const totalWasted = parseFloat(totalsRows[0]?.total_wasted || 0);
    const totalItems = parseInt(itemsCountRow[0]?.total_items || 0, 10);
    const totalDaysRecorded = parseInt(totalsRows[0]?.total_days_recorded || 0, 10);
    const activeItemsCount = parseInt(totalsRows[0]?.active_items_count || 0, 10);

    const overallWasteRate = totalPrepared > 0
      ? Number(((totalWasted / totalPrepared) * 100).toFixed(2))
      : 0;

    const overallSellThrough = totalPrepared > 0
      ? Number(((totalSold / totalPrepared) * 100).toFixed(2))
      : 0;

    // Format calendar dates for coverage
    const firstDateStr = totalsRows[0]?.first_record_date
      ? String(totalsRows[0].first_record_date).match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || null
      : null;
    const lastDateStr = totalsRows[0]?.last_record_date
      ? String(totalsRows[0].last_record_date).match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || null
      : null;

    // 3. Daily trend over time (chronological)
    const [trendRows] = await pool.execute(
      `SELECT 
         DATE_FORMAT(dr.record_date, '%Y-%m-%d') AS date,
         COALESCE(SUM(dr.quantity_prepared), 0)   AS prepared,
         COALESCE(SUM(dr.quantity_sold), 0)       AS sold,
         COALESCE(SUM(dr.quantity_wasted), 0)     AS wasted,
         COUNT(dr.id)                             AS batches_logged
       FROM demand_records dr
       WHERE dr.organization_id = ?
       GROUP BY dr.record_date
       ORDER BY dr.record_date ASC`,
      [organizationId]
    );

    const trend = trendRows.map((t) => {
      const p = parseFloat(t.prepared);
      const s = parseFloat(t.sold);
      const w = parseFloat(t.wasted);
      const rate = p > 0 ? Number(((w / p) * 100).toFixed(2)) : 0;
      const str = p > 0 ? Number(((s / p) * 100).toFixed(2)) : 0;
      return {
        date: t.date,
        prepared: p,
        sold: s,
        wasted: w,
        waste_rate: rate,
        sell_through_rate: str,
        batches_logged: parseInt(t.batches_logged, 10),
      };
    });

    // 4. Item-wise breakdown
    const [itemBreakdownRows] = await pool.execute(
      `SELECT 
         fi.id,
         fi.name,
         fi.category,
         fi.unit,
         COUNT(dr.id)                             AS records_count,
         COALESCE(SUM(dr.quantity_prepared), 0)   AS total_prepared,
         COALESCE(SUM(dr.quantity_sold), 0)       AS total_sold,
         COALESCE(SUM(dr.quantity_wasted), 0)     AS total_wasted
       FROM food_items fi
       LEFT JOIN demand_records dr 
         ON fi.id = dr.food_item_id AND dr.organization_id = ?
       WHERE fi.organization_id = ?
       GROUP BY fi.id, fi.name, fi.category, fi.unit
       ORDER BY total_wasted DESC, fi.name ASC`,
      [organizationId, organizationId]
    );

    const itemBreakdown = itemBreakdownRows.map((ib) => {
      const p = parseFloat(ib.total_prepared);
      const s = parseFloat(ib.total_sold);
      const w = parseFloat(ib.total_wasted);
      const recCount = parseInt(ib.records_count, 10);
      const rate = p > 0 ? Number(((w / p) * 100).toFixed(2)) : 0;
      const str = p > 0 ? Number(((s / p) * 100).toFixed(2)) : 0;

      return {
        id: ib.id,
        name: ib.name,
        category: ib.category || 'General',
        unit: ib.unit,
        records_count: recCount,
        total_prepared: p,
        total_sold: s,
        total_wasted: w,
        waste_rate: rate,
        sell_through_rate: str,
      };
    });

    // Top waste producing items (wasted > 0)
    const topWasteItems = itemBreakdown
      .filter((i) => i.total_wasted > 0)
      .slice(0, 5);

    return res.status(200).json({
      success: true,
      data: {
        totals: {
          total_prepared: totalPrepared,
          total_sold: totalSold,
          total_wasted: totalWasted,
          overall_waste_rate: overallWasteRate,
          overall_sell_through_rate: overallSellThrough,
          total_records: totalRecords,
          total_items: totalItems,
        },
        coverage: {
          first_record_date: firstDateStr,
          last_record_date: lastDateStr,
          total_days_recorded: totalDaysRecorded,
          active_items_count: activeItemsCount,
          inactive_items_count: Math.max(0, totalItems - activeItemsCount),
        },
        trend,
        item_breakdown: itemBreakdown,
        top_waste_items: topWasteItems,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/analytics/recommendations
 * Deterministic actionable recommendations for the organization.
 */
async function getRecommendationsHandler(req, res, next) {
  try {
    const organizationId = req.organization.id;
    const result = await generateRecommendations(organizationId, pool);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/analytics/financial-impact
 * Genuine data-driven financial waste impact and defensible potential savings.
 */
async function getFinancialImpactHandler(req, res, next) {
  try {
    const organizationId = req.organization.id;
    const result = await calculateFinancialImpact(organizationId, pool);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/analytics/benchmark
 * Organization performance baseline and historical benchmark metrics.
 */
async function getBenchmarkHandler(req, res, next) {
  try {
    const organizationId = req.organization.id;
    const result = await calculateOrganizationBenchmark(organizationId, pool);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/analytics/goal
 * Actionable operational waste reduction goals based on historical performance.
 */
async function getGoalHandler(req, res, next) {
  try {
    const organizationId = req.organization.id;
    const result = await calculateWasteReductionGoal(organizationId, pool);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAnalyticsSummary,
  getRecommendationsHandler,
  getFinancialImpactHandler,
  getBenchmarkHandler,
  getGoalHandler,
};

