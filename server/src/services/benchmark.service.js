/**
 * Organization Performance Baseline & Historical Benchmark Service
 * 
 * Computes organization-specific waste baselines strictly from authorized historical
 * demand records. Never compares cross-tenant data or fabricates synthetic numbers.
 * 
 * Rules:
 * - Current waste rate is derived from the latest recorded day.
 * - Historical average is the volume-weighted overall waste rate.
 * - Best observed rate is the minimum waste rate achieved on any recorded day.
 * - Improvement gap = max(0, current - best observed).
 * - Best performing food items require sufficient records (>= 3).
 * - "Best observed" is clearly framed as historical peak performance, not a guarantee.
 */

/**
 * Calculate organization-scoped benchmark.
 * 
 * @param {number} organizationId 
 * @param {import('mysql2/promise').Pool} pool 
 * @returns {Promise<Object>}
 */
async function calculateOrganizationBenchmark(organizationId, pool) {
  // Query all demand records joined with food items for the organization
  const [recordsRows] = await pool.execute(
    `SELECT 
       dr.id,
       dr.food_item_id,
       DATE_FORMAT(dr.record_date, '%Y-%m-%d') AS record_date,
       dr.quantity_prepared,
       dr.quantity_sold,
       dr.quantity_wasted,
       fi.name AS food_item_name,
       fi.category AS food_item_category,
       fi.unit AS food_item_unit
     FROM demand_records dr
     JOIN food_items fi ON fi.id = dr.food_item_id
     WHERE dr.organization_id = ?
     ORDER BY dr.record_date ASC`,
    [organizationId]
  );

  const totalRecordsCount = recordsRows.length;

  if (totalRecordsCount === 0) {
    return {
      status: 'no_data',
      message: 'No historical demand records logged yet. Log demand data to generate performance benchmarks.',
      current_waste_rate: null,
      historical_average_waste_rate: null,
      best_observed_waste_rate: null,
      improvement_gap: null,
      totals: {
        total_prepared: 0,
        total_sold: 0,
        total_wasted: 0,
        total_records: 0,
        total_days_recorded: 0,
      },
      current_period: null,
      best_observed_period: null,
      best_performing_items: [],
      note: 'Best observed rate reflects historical performance, not a guaranteed future result.',
    };
  }

  // 1. Calculate overall volume totals
  let totalPrepared = 0;
  let totalSold = 0;
  let totalWasted = 0;

  const dailyMap = new Map();
  const itemMap = new Map();

  recordsRows.forEach((r) => {
    const prep = parseFloat(r.quantity_prepared);
    const sold = parseFloat(r.quantity_sold);
    const wasted = parseFloat(r.quantity_wasted);

    totalPrepared += prep;
    totalSold += sold;
    totalWasted += wasted;

    // Aggregate by date
    const dateStr = r.record_date;
    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, {
        date: dateStr,
        prepared: 0,
        sold: 0,
        wasted: 0,
        batches_count: 0,
      });
    }
    const dayEntry = dailyMap.get(dateStr);
    dayEntry.prepared += prep;
    dayEntry.sold += sold;
    dayEntry.wasted += wasted;
    dayEntry.batches_count += 1;

    // Aggregate by food item
    if (!itemMap.has(r.food_item_id)) {
      itemMap.set(r.food_item_id, {
        id: r.food_item_id,
        name: r.food_item_name,
        category: r.food_item_category || 'Uncategorized',
        unit: r.food_item_unit,
        prepared: 0,
        sold: 0,
        wasted: 0,
        records_count: 0,
      });
    }
    const itemEntry = itemMap.get(r.food_item_id);
    itemEntry.prepared += prep;
    itemEntry.sold += sold;
    itemEntry.wasted += wasted;
    itemEntry.records_count += 1;
  });

  // Volume-weighted historical average waste rate
  const historicalAverageWasteRate = totalPrepared > 0
    ? Number(((totalWasted / totalPrepared) * 100).toFixed(2))
    : 0;

  // 2. Daily calculations & chronologically sorted dates
  const sortedDates = Array.from(dailyMap.keys()).sort();
  const totalDaysRecorded = sortedDates.length;

  let bestDayEntry = null;
  let lowestDailyRate = Infinity;

  sortedDates.forEach((dateStr) => {
    const day = dailyMap.get(dateStr);
    const dayRate = day.prepared > 0
      ? Number(((day.wasted / day.prepared) * 100).toFixed(2))
      : 0;
    day.waste_rate = dayRate;

    if (dayRate < lowestDailyRate) {
      lowestDailyRate = dayRate;
      bestDayEntry = day;
    }
  });

  // Current waste rate (latest recorded date)
  const latestDateStr = sortedDates[sortedDates.length - 1];
  const currentDayEntry = dailyMap.get(latestDateStr);
  const currentWasteRate = currentDayEntry.waste_rate;

  const bestObservedWasteRate = bestDayEntry ? bestDayEntry.waste_rate : 0;
  const rawGap = currentWasteRate - bestObservedWasteRate;
  const improvementGap = Number(Math.max(0, rawGap).toFixed(2));

  // 3. Best-performing food items (minimum 3 records required)
  const eligibleItems = [];
  itemMap.forEach((item) => {
    if (item.records_count >= 3 && item.prepared > 0) {
      const rate = Number(((item.wasted / item.prepared) * 100).toFixed(2));
      eligibleItems.push({
        id: item.id,
        name: item.name,
        category: item.category,
        unit: item.unit,
        waste_rate: rate,
        records_count: item.records_count,
        total_prepared: item.prepared,
        total_wasted: item.wasted,
      });
    }
  });

  // Sort by lowest waste rate first, then by highest records count
  eligibleItems.sort((a, b) => {
    if (a.waste_rate !== b.waste_rate) {
      return a.waste_rate - b.waste_rate;
    }
    return b.records_count - a.records_count;
  });

  const bestPerformingItems = eligibleItems.slice(0, 3);

  return {
    status: totalDaysRecorded === 1 ? 'single_record' : 'established',
    message: totalDaysRecorded === 1
      ? 'Baseline established from initial log. Log additional dates to track performance trends and variance.'
      : 'Organization performance baseline computed from real historical demand data.',
    current_waste_rate: currentWasteRate,
    historical_average_waste_rate: historicalAverageWasteRate,
    best_observed_waste_rate: bestObservedWasteRate,
    improvement_gap: improvementGap,
    totals: {
      total_prepared: Number(totalPrepared.toFixed(2)),
      total_sold: Number(totalSold.toFixed(2)),
      total_wasted: Number(totalWasted.toFixed(2)),
      total_records: totalRecordsCount,
      total_days_recorded: totalDaysRecorded,
    },
    current_period: {
      date: currentDayEntry.date,
      prepared: Number(currentDayEntry.prepared.toFixed(2)),
      sold: Number(currentDayEntry.sold.toFixed(2)),
      wasted: Number(currentDayEntry.wasted.toFixed(2)),
    },
    best_observed_period: bestDayEntry ? {
      date: bestDayEntry.date,
      prepared: Number(bestDayEntry.prepared.toFixed(2)),
      sold: Number(bestDayEntry.sold.toFixed(2)),
      wasted: Number(bestDayEntry.wasted.toFixed(2)),
    } : null,
    best_performing_items: bestPerformingItems,
    note: 'Best observed rate reflects historical peak operational efficiency and is not a guaranteed future result.',
  };
}

module.exports = {
  calculateOrganizationBenchmark,
};
