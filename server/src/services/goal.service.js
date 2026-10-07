/**
 * Actionable Waste Reduction Goals Service
 * 
 * Reuses existing Historical Benchmark, Financial Impact, and Recommendation services
 * to establish data-driven operational improvement targets based strictly on the
 * organization's own historical performance. Never invents arbitrary industry benchmarks.
 */

const { calculateOrganizationBenchmark } = require('./benchmark.service');
const { calculateFinancialImpact } = require('./financial.service');
const { generateRecommendations } = require('./recommendation.service');

/**
 * Calculate organization-scoped waste reduction goals.
 * 
 * @param {number} organizationId 
 * @param {import('mysql2/promise').Pool} pool 
 * @returns {Promise<Object>}
 */
async function calculateWasteReductionGoal(organizationId, pool) {
  // 1. Reuse existing organization-scoped services
  const [benchmark, financialImpact, recsResult] = await Promise.all([
    calculateOrganizationBenchmark(organizationId, pool),
    calculateFinancialImpact(organizationId, pool),
    generateRecommendations(organizationId, pool),
  ]);

  const defaultDisclaimer = 'Reduction target is derived strictly from your organization’s historical peak performance and is not a guaranteed future result.';

  // 2. Handle zero records / no data state
  if (benchmark.status === 'no_data') {
    return {
      status: 'no_data',
      message: 'No historical demand data available to establish reduction goals.',
      current_waste_rate: null,
      target_waste_rate: null,
      historical_best_rate: null,
      remaining_gap: null,
      target_basis: null,
      reduction_opportunity: {
        period_quantity: null,
        total_quantity: null,
        unit_label: 'portions / units',
      },
      financial_impact: {
        potential_savings: null,
        status: financialImpact.totals?.potential_savings_status || 'uncalculable',
        explanation: financialImpact.totals?.potential_savings_explanation || 'No demand records logged yet.',
      },
      suggested_focus_items: [],
      model_benchmark_items: [],
      note: defaultDisclaimer,
    };
  }

  // 3. Handle single record / insufficient historical data state
  if (benchmark.status === 'single_record') {
    return {
      status: 'insufficient_data',
      message: 'Baseline established from 1 recorded day. Additional historical days are needed to measure variance and identify reduction targets.',
      current_waste_rate: benchmark.current_waste_rate,
      target_waste_rate: benchmark.best_observed_waste_rate,
      historical_best_rate: benchmark.best_observed_waste_rate,
      remaining_gap: 0,
      target_basis: `Initial baseline recorded on ${benchmark.current_period?.date || 'N/A'}`,
      reduction_opportunity: {
        period_quantity: null,
        total_quantity: null,
        unit_label: 'portions / units',
      },
      financial_impact: {
        potential_savings: null,
        status: financialImpact.totals?.potential_savings_status || 'insufficient_data',
        explanation: 'Requires multiple recorded days to evaluate financial waste reduction opportunities.',
      },
      suggested_focus_items: [],
      model_benchmark_items: [],
      note: defaultDisclaimer,
    };
  }

  // 4. Established multi-day state: Calculate achievable target & opportunity
  const currentRate = benchmark.current_waste_rate;
  const bestRate = benchmark.best_observed_waste_rate;
  const targetRate = bestRate; // Grounded strictly in organization's demonstrated best performance
  const remainingGap = benchmark.improvement_gap; // max(0, currentRate - bestRate)

  // Quantity opportunity calculation (grounded strictly in observed records)
  const currPrep = benchmark.current_period ? benchmark.current_period.prepared : 0;
  const currWasted = benchmark.current_period ? benchmark.current_period.wasted : 0;
  const periodQuantity = remainingGap > 0 && currPrep > 0
    ? Number(Math.max(0, currWasted - (currPrep * (targetRate / 100))).toFixed(2))
    : 0;

  const totalPrep = benchmark.totals.total_prepared;
  const totalWasted = benchmark.totals.total_wasted;
  const totalQuantity = remainingGap > 0 && totalPrep > 0
    ? Number(Math.max(0, totalWasted - (totalPrep * (targetRate / 100))).toFixed(2))
    : 0;

  // Financial impact reuse (never fabricate percentages or numbers)
  const financialPotentialSavings = financialImpact.totals.total_potential_savings;
  const financialStatus = financialImpact.totals.potential_savings_status;
  const financialExplanation = financialImpact.totals.potential_savings_explanation;

  // Suggested focus food items from recommendations & financial breakdown
  const recsList = recsResult.recommendations || [];
  const recMap = new Map();
  recsList.forEach((r) => {
    if (r.affected_item_id) {
      recMap.set(r.affected_item_id, r);
    }
  });

  const items = (financialImpact.item_breakdown || []).filter(
    (i) => i.records_count > 0 && i.total_wasted > 0
  );

  // Sort candidate items by waste rate descending, prioritizing higher loss items
  items.sort((a, b) => {
    if (b.waste_rate !== a.waste_rate) {
      return b.waste_rate - a.waste_rate;
    }
    return b.total_wasted - a.total_wasted;
  });

  const focusCandidates = items.slice(0, 3);
  const suggestedFocusItems = focusCandidates.map((item) => {
    const matchingRec = recMap.get(item.id);
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      unit: item.unit,
      waste_rate: item.waste_rate,
      total_wasted: item.total_wasted,
      total_waste_cost: item.total_waste_cost,
      potential_savings: item.potential_savings,
      priority: item.waste_rate > 20 ? 'High' : item.waste_rate > 10 ? 'Medium' : 'Low',
      suggested_action: matchingRec ? matchingRec.action : `Align preparation volumes with target waste rate (< ${targetRate}%).`,
    };
  });

  return {
    status: 'established',
    message: remainingGap === 0
      ? 'Organization is currently operating at its best observed historical efficiency.'
      : 'Actionable goal established to recover historical peak efficiency.',
    current_waste_rate: currentRate,
    target_waste_rate: targetRate,
    historical_best_rate: bestRate,
    remaining_gap: remainingGap,
    target_basis: `Demonstrated best performance achieved on ${benchmark.best_observed_period?.date || 'N/A'}`,
    reduction_opportunity: {
      period_quantity: periodQuantity,
      total_quantity: totalQuantity,
      unit_label: 'portions / units',
    },
    financial_impact: {
      potential_savings: financialPotentialSavings,
      status: financialStatus,
      explanation: financialExplanation,
    },
    suggested_focus_items: suggestedFocusItems,
    model_benchmark_items: benchmark.best_performing_items || [],
    note: defaultDisclaimer,
  };
}

module.exports = {
  calculateWasteReductionGoal,
};
