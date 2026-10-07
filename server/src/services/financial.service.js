/**
 * Financial Impact & Cost Analysis Service
 * 
 * Computes genuine, data-driven monetary waste cost and potential savings
 * strictly from real MySQL demand records and user-defined food item unit costs.
 * 
 * Rules:
 * - Waste Cost = quantity_wasted * unit_cost
 * - Items without unit_cost are excluded from monetary calculations (never invented).
 * - Potential savings are derived strictly from historical waste variance (excess waste
 *   above the organization's own best observed historical rate). If insufficient history
 *   (< 3 records per item), returns null without fabricating percentages.
 * - All queries and calculations are strictly organization-scoped.
 */

/**
 * Calculate organization-scoped financial impact.
 * 
 * @param {number} organizationId 
 * @param {import('mysql2/promise').Pool} pool 
 * @returns {Promise<Object>}
 */
async function calculateFinancialImpact(organizationId, pool) {
  // 1. Fetch all food items for the organization
  const [itemsRows] = await pool.execute(
    `SELECT id, organization_id, name, category, unit, unit_cost
     FROM food_items
     WHERE organization_id = ?
     ORDER BY name ASC`,
    [organizationId]
  );

  const totalItemsCount = itemsRows.length;

  if (totalItemsCount === 0) {
    return {
      status: 'no_food_items',
      message: 'No food items registered in organization.',
      totals: {
        total_waste_cost: null,
        total_potential_savings: null,
        current_period_waste_cost: null,
        previous_period_waste_cost: null,
      },
      highest_waste_cost_item: null,
      cost_coverage: {
        total_items: 0,
        items_with_cost_count: 0,
        items_without_cost_count: 0,
        cost_coverage_percentage: 0,
      },
      items_without_cost: [],
      item_breakdown: [],
    };
  }

  // 2. Fetch all demand records for the organization
  const [recordsRows] = await pool.execute(
    `SELECT dr.id, dr.food_item_id, 
            DATE_FORMAT(dr.record_date, '%Y-%m-%d') AS record_date,
            dr.quantity_prepared, dr.quantity_sold, dr.quantity_wasted
     FROM demand_records dr
     WHERE dr.organization_id = ?
     ORDER BY dr.record_date ASC`,
    [organizationId]
  );

  const totalRecordsCount = recordsRows.length;

  // Separate food items by cost availability
  const itemsWithCost = itemsRows.filter((i) => i.unit_cost !== null && i.unit_cost !== undefined);
  const itemsWithoutCost = itemsRows.filter((i) => i.unit_cost === null || i.unit_cost === undefined);
  const costMap = new Map();
  itemsRows.forEach((i) => {
    costMap.set(i.id, i.unit_cost !== null ? parseFloat(i.unit_cost) : null);
  });

  // Group demand records by item
  const recordsByItem = new Map();
  recordsRows.forEach((r) => {
    if (!recordsByItem.has(r.food_item_id)) {
      recordsByItem.set(r.food_item_id, []);
    }
    recordsByItem.get(r.food_item_id).push({
      date: r.record_date,
      prepared: parseFloat(r.quantity_prepared),
      sold: parseFloat(r.quantity_sold),
      wasted: parseFloat(r.quantity_wasted),
    });
  });

  // 3. Item-level financial breakdown
  let totalWasteCostSum = 0;
  let hasAnyCostedItem = itemsWithCost.length > 0;
  let calculableSavingsSum = 0;
  let itemsEligibleForSavings = 0;

  const itemBreakdown = itemsRows.map((item) => {
    const unitCost = costMap.get(item.id);
    const itemRecords = recordsByItem.get(item.id) || [];
    const recordsCount = itemRecords.length;

    let prepSum = 0;
    let soldSum = 0;
    let wasteSum = 0;
    const dailyRates = [];

    itemRecords.forEach((rec) => {
      prepSum += rec.prepared;
      soldSum += rec.sold;
      wasteSum += rec.wasted;
      const rate = rec.prepared > 0 ? rec.wasted / rec.prepared : 0;
      dailyRates.push(rate);
    });

    const wasteRate = prepSum > 0 ? Number(((wasteSum / prepSum) * 100).toFixed(2)) : 0;

    let itemWasteCost = null;
    let itemPotentialSavings = null;

    if (unitCost !== null) {
      itemWasteCost = Number((wasteSum * unitCost).toFixed(2));
      totalWasteCostSum += itemWasteCost;

      // Defensible potential savings calculation:
      // Requires >= 3 records to establish baseline variance
      if (recordsCount >= 3 && wasteSum > 0) {
        const minObservedRate = Math.min(...dailyRates);
        const excessWaste = Math.max(0, wasteSum - (prepSum * minObservedRate));
        itemPotentialSavings = Number((excessWaste * unitCost).toFixed(2));
        calculableSavingsSum += itemPotentialSavings;
        itemsEligibleForSavings++;
      }
    }

    return {
      id: item.id,
      name: item.name,
      category: item.category || 'Uncategorized',
      unit: item.unit,
      unit_cost: unitCost !== null ? unitCost : null,
      has_cost: unitCost !== null,
      records_count: recordsCount,
      total_prepared: prepSum,
      total_sold: soldSum,
      total_wasted: wasteSum,
      waste_rate: wasteRate,
      total_waste_cost: itemWasteCost,
      potential_savings: itemPotentialSavings,
    };
  });

  // Sort item breakdown by highest waste cost first, then by wasted quantity
  itemBreakdown.sort((a, b) => {
    if (a.total_waste_cost !== null && b.total_waste_cost !== null) {
      return b.total_waste_cost - a.total_waste_cost;
    }
    if (a.total_waste_cost !== null) return -1;
    if (b.total_waste_cost !== null) return 1;
    return b.total_wasted - a.total_wasted;
  });

  // 4. Period comparisons (Current Period vs Previous Period)
  const uniqueDates = Array.from(new Set(recordsRows.map((r) => r.record_date))).sort();
  let currentPeriodWasteCost = null;
  let previousPeriodWasteCost = null;

  if (hasAnyCostedItem && uniqueDates.length >= 2) {
    const mid = Math.floor(uniqueDates.length / 2);
    const prevDates = new Set(uniqueDates.slice(0, mid));
    const currDates = new Set(uniqueDates.slice(mid));

    let prevCost = 0;
    let currCost = 0;

    recordsRows.forEach((r) => {
      const uCost = costMap.get(r.food_item_id);
      if (uCost !== null && uCost !== undefined) {
        const cost = parseFloat(r.quantity_wasted) * uCost;
        if (prevDates.has(r.record_date)) {
          prevCost += cost;
        } else if (currDates.has(r.record_date)) {
          currCost += cost;
        }
      }
    });

    currentPeriodWasteCost = Number(currCost.toFixed(2));
    previousPeriodWasteCost = Number(prevCost.toFixed(2));
  } else if (hasAnyCostedItem && uniqueDates.length === 1) {
    currentPeriodWasteCost = Number(totalWasteCostSum.toFixed(2));
    previousPeriodWasteCost = null;
  }

  // 5. Total Potential Savings determination
  let totalPotentialSavings = null;
  let potentialSavingsStatus = 'uncalculable';
  let potentialSavingsExplanation = null;

  if (!hasAnyCostedItem) {
    potentialSavingsStatus = 'missing_cost';
    potentialSavingsExplanation = 'Add unit costs to food items to unlock financial impact analysis.';
  } else if (recordsRows.length === 0 || totalWasteCostSum === 0) {
    totalPotentialSavings = 0;
    potentialSavingsStatus = 'zero_waste';
    potentialSavingsExplanation = 'Zero waste recorded across all demand logs.';
  } else if (itemsEligibleForSavings > 0) {
    totalPotentialSavings = Number(calculableSavingsSum.toFixed(2));
    potentialSavingsStatus = 'calculated';
    potentialSavingsExplanation = 'Derived from historical waste variance: excess cost above your organization’s best observed waste rate per item.';
  } else {
    potentialSavingsStatus = 'insufficient_data';
    potentialSavingsExplanation = 'Requires at least 3 historical demand records per costed item to establish defensible baseline efficiency without fabricating percentages.';
  }

  // 6. Highest waste cost item
  const costedItemsWithWaste = itemBreakdown.filter(
    (i) => i.total_waste_cost !== null && i.total_waste_cost > 0
  );
  const highestWasteCostItem = costedItemsWithWaste.length > 0 ? costedItemsWithWaste[0] : null;

  // 7. Cost coverage stats
  const itemsWithCostCount = itemsWithCost.length;
  const itemsWithoutCostCount = itemsWithoutCost.length;
  const coveragePercentage = totalItemsCount > 0
    ? Number(((itemsWithCostCount / totalItemsCount) * 100).toFixed(1))
    : 0;

  // Items missing cost list
  const missingCostList = itemBreakdown
    .filter((i) => !i.has_cost)
    .map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      unit: i.unit,
      records_count: i.records_count,
      total_wasted: i.total_wasted,
    }));

  return {
    status: !hasAnyCostedItem
      ? 'no_cost_data'
      : totalRecordsCount === 0
      ? 'no_demand_records'
      : 'success',
    message: !hasAnyCostedItem
      ? 'Add unit costs to food items to unlock financial impact analysis.'
      : totalRecordsCount === 0
      ? 'No demand records logged yet.'
      : 'Financial impact calculated successfully.',
    totals: {
      total_waste_cost: hasAnyCostedItem ? Number(totalWasteCostSum.toFixed(2)) : null,
      total_potential_savings: totalPotentialSavings,
      potential_savings_status: potentialSavingsStatus,
      potential_savings_explanation: potentialSavingsExplanation,
      current_period_waste_cost: currentPeriodWasteCost,
      previous_period_waste_cost: previousPeriodWasteCost,
    },
    highest_waste_cost_item: highestWasteCostItem,
    cost_coverage: {
      total_items: totalItemsCount,
      items_with_cost_count: itemsWithCostCount,
      items_without_cost_count: itemsWithoutCostCount,
      cost_coverage_percentage: coveragePercentage,
    },
    items_without_cost: missingCostList,
    item_breakdown: itemBreakdown,
  };
}

module.exports = {
  calculateFinancialImpact,
};
