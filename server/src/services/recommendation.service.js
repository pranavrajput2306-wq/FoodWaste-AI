/**
 * Recommendation Service
 * Generates deterministic, data-driven sustainability recommendations
 * based on real historical consumption and waste data.
 */

async function generateRecommendations(organizationId, pool) {
  // 1. Fetch food items for this organization
  const [items] = await pool.execute(
    'SELECT id, name, category, unit FROM food_items WHERE organization_id = ? ORDER BY name ASC',
    [organizationId]
  );

  if (items.length === 0) {
    return {
      recommendations: [
        {
          id: 'rec_no_items',
          title: 'Catalog Food Items to Begin Tracking',
          action: 'Register menu and pantry items in the Food Items section.',
          affected_item: 'All Items',
          affected_item_id: null,
          category: 'System Setup',
          priority: 'Medium',
          type: 'data_notice',
          evidence: '0 food items currently registered in your organization.',
          metric_label: 'Catalog Status',
          metric_value: '0 items',
          is_ml_derived: false,
        },
      ],
      counts: { total: 1, high: 0, medium: 1, low: 0 },
    };
  }

  // 2. Fetch all demand records for this organization
  const [records] = await pool.execute(
    `SELECT dr.id, dr.food_item_id, DATE_FORMAT(dr.record_date, '%Y-%m-%d') AS record_date,
            dr.quantity_prepared, dr.quantity_sold, dr.quantity_wasted
     FROM demand_records dr
     WHERE dr.organization_id = ?
     ORDER BY dr.record_date ASC, dr.id ASC`,
    [organizationId]
  );

  if (records.length === 0) {
    return {
      recommendations: [
        {
          id: 'rec_no_records',
          title: 'Log Daily Demand Records to Establish Baselines',
          action: 'Record daily preparation, sold quantities, and waste in Demand Data.',
          affected_item: 'All Catalog Items',
          affected_item_id: null,
          category: 'Data Foundation',
          priority: 'High',
          type: 'data_notice',
          evidence: 'No consumption logs exist yet. Machine learning and trend analysis require historical data.',
          metric_label: 'Total Logs',
          metric_value: '0 records',
          is_ml_derived: false,
        },
      ],
      counts: { total: 1, high: 1, medium: 0, low: 0 },
    };
  }

  // Group records by food_item_id
  const itemMap = new Map();
  items.forEach((item) => {
    itemMap.set(item.id, { ...item, records: [] });
  });

  records.forEach((r) => {
    const item = itemMap.get(r.food_item_id);
    if (item) {
      item.records.push({
        id: r.id,
        record_date: r.record_date,
        quantity_prepared: parseFloat(r.quantity_prepared),
        quantity_sold: parseFloat(r.quantity_sold),
        quantity_wasted: parseFloat(r.quantity_wasted),
      });
    }
  });

  const recommendations = [];

  for (const [itemId, item] of itemMap.entries()) {
    const recs = item.records;
    const count = recs.length;

    // Case 1: Item has 0 logs
    if (count === 0) {
      recommendations.push({
        id: `rec_item_${itemId}_zero`,
        title: `Begin Logging Data for ${item.name}`,
        action: `Add initial preparation and sales logs for ${item.name} (${item.unit}).`,
        affected_item: item.name,
        affected_item_id: itemId,
        category: item.category || 'General',
        priority: 'Low',
        type: 'data_notice',
        evidence: `No demand records logged for ${item.name} yet.`,
        metric_label: 'Records Count',
        metric_value: '0 records',
        is_ml_derived: false,
      });
      continue;
    }

    // Compute aggregates
    const totalPrepared = recs.reduce((sum, r) => sum + r.quantity_prepared, 0);
    const totalSold = recs.reduce((sum, r) => sum + r.quantity_sold, 0);
    const totalWasted = recs.reduce((sum, r) => sum + r.quantity_wasted, 0);

    const avgPrepared = totalPrepared / count;
    const avgSold = totalSold / count;
    const avgWasted = totalWasted / count;

    const overallWasteRate = totalPrepared > 0 ? (totalWasted / totalPrepared) * 100 : 0;
    const overallSellThrough = totalPrepared > 0 ? (totalSold / totalPrepared) * 100 : 0;

    // Case 2: Insufficient sample size (< 5 records)
    if (count < 5) {
      recommendations.push({
        id: `rec_item_${itemId}_insufficient`,
        title: `Collect More History for ${item.name}`,
        action: `Continue daily recording. ${5 - count} more log(s) required to establish stable baseline metrics.`,
        affected_item: item.name,
        affected_item_id: itemId,
        category: item.category || 'General',
        priority: 'Low',
        type: 'data_notice',
        evidence: `Currently ${count} record(s) available. Preliminary waste rate is ${overallWasteRate.toFixed(1)}%. Minimum 5 records required for robust pattern matching.`,
        metric_label: 'Data Sufficiency',
        metric_value: `${count}/5 records`,
        is_ml_derived: false,
      });
      continue;
    }

    // Analyze recent trend (last 3 vs prior)
    let recentTrend = 'stable';
    if (count >= 6) {
      const recent3 = recs.slice(-3);
      const prior = recs.slice(0, -3);

      const recentPrep = recent3.reduce((s, r) => s + r.quantity_prepared, 0);
      const recentWaste = recent3.reduce((s, r) => s + r.quantity_wasted, 0);
      const priorPrep = prior.reduce((s, r) => s + r.quantity_prepared, 0);
      const priorWaste = prior.reduce((s, r) => s + r.quantity_wasted, 0);

      const recentRate = recentPrep > 0 ? (recentWaste / recentPrep) * 100 : 0;
      const priorRate = priorPrep > 0 ? (priorWaste / priorPrep) * 100 : 0;

      if (recentRate > priorRate + 4) {
        recentTrend = 'worsening';
      } else if (recentRate < priorRate - 4) {
        recentTrend = 'improving';
      }
    }

    // Determine ML threshold status
    const mlReady = count >= 7;

    // Rule 1: High Waste + Low Sales (Critical)
    if (overallWasteRate >= 25 && overallSellThrough <= 65) {
      const suggestedCut = Math.max(1, Math.round((avgPrepared - avgSold) * 0.7));
      recommendations.push({
        id: `rec_item_${itemId}_critical_waste`,
        title: `Urgent: Downscale Preparation for ${item.name}`,
        action: `Reduce daily batch size by approximately ${suggestedCut} ${item.unit} to curb acute surplus.`,
        affected_item: item.name,
        affected_item_id: itemId,
        category: item.category || 'General',
        priority: 'High',
        type: 'data_driven',
        evidence: `Severe surplus detected: average waste rate is ${overallWasteRate.toFixed(1)}% with only ${overallSellThrough.toFixed(1)}% sell-through. Daily losses average ${avgWasted.toFixed(1)} ${item.unit}.`,
        metric_label: 'Waste Rate',
        metric_value: `${overallWasteRate.toFixed(1)}%`,
        is_ml_derived: mlReady,
        ml_status: mlReady ? 'ML sequence criteria met (>= 7 days available)' : 'Data-driven rule (< 7 days for ML inference)',
      });
      continue;
    }

    // Rule 2: Consistently High Waste Ratio (>= 20%)
    if (overallWasteRate >= 20) {
      const suggestedReduction = Math.max(1, Math.round(avgWasted * 0.5));
      recommendations.push({
        id: `rec_item_${itemId}_high_waste`,
        title: `High Waste Rate Detected on ${item.name}`,
        action: `Trim prep volume by ~${suggestedReduction} ${item.unit} or adjust portion sizes.`,
        affected_item: item.name,
        affected_item_id: itemId,
        category: item.category || 'General',
        priority: 'High',
        type: 'data_driven',
        evidence: `Consistent surplus: ${overallWasteRate.toFixed(1)}% of prepared volume is lost as waste (averaging ${avgWasted.toFixed(1)} ${item.unit} wasted vs ${avgPrepared.toFixed(1)} ${item.unit} prepared).`,
        metric_label: 'Waste Rate',
        metric_value: `${overallWasteRate.toFixed(1)}%`,
        is_ml_derived: mlReady,
        ml_status: mlReady ? 'ML sequence criteria met' : 'Data-driven rule',
      });
      continue;
    }

    // Rule 3: Upward Waste Trend (Worsening)
    if (recentTrend === 'worsening' && overallWasteRate >= 10) {
      recommendations.push({
        id: `rec_item_${itemId}_trend_worsening`,
        title: `Rising Waste Trend on ${item.name}`,
        action: `Inspect storage shelf-life and align preparation closer to mid-week consumption patterns.`,
        affected_item: item.name,
        affected_item_id: itemId,
        category: item.category || 'General',
        priority: 'Medium',
        type: 'data_driven',
        evidence: `Waste percentage on ${item.name} has risen notably across recent logs compared to the historical baseline.`,
        metric_label: 'Trend Status',
        metric_value: 'Rising Waste',
        is_ml_derived: false,
      });
      continue;
    }

    // Rule 4: Moderate Waste with Suboptimal Sell-Through
    if (overallSellThrough < 75 && overallWasteRate >= 12) {
      recommendations.push({
        id: `rec_item_${itemId}_suboptimal_sellthrough`,
        title: `Calibrate Batch Sizing for ${item.name}`,
        action: `Align production closer to actual consumption (${avgSold.toFixed(1)} ${item.unit} sold vs ${avgPrepared.toFixed(1)} prepared).`,
        affected_item: item.name,
        affected_item_id: itemId,
        category: item.category || 'General',
        priority: 'Medium',
        type: 'data_driven',
        evidence: `Sell-through is ${overallSellThrough.toFixed(1)}% with an average waste rate of ${overallWasteRate.toFixed(1)}%.`,
        metric_label: 'Sell-Through',
        metric_value: `${overallSellThrough.toFixed(1)}%`,
        is_ml_derived: mlReady,
        ml_status: mlReady ? 'ML sequence criteria met' : 'Data-driven rule',
      });
      continue;
    }

    // Rule 5: High Demand & Minimal Waste (Stockout Risk / Expansion Opportunity)
    if (overallSellThrough >= 90 && overallWasteRate <= 5) {
      const suggestedExpansion = Math.max(1, Math.round(avgPrepared * 0.08));
      recommendations.push({
        id: `rec_item_${itemId}_high_demand`,
        title: `Strong Demand: Consider Increasing Prep for ${item.name}`,
        action: `Test an incremental increase of ~${suggestedExpansion} ${item.unit} to meet potential unfulfilled demand.`,
        affected_item: item.name,
        affected_item_id: itemId,
        category: item.category || 'General',
        priority: 'Low',
        type: 'data_driven',
        evidence: `Excellent operational efficiency: sell-through is ${overallSellThrough.toFixed(1)}% with negligible waste (${overallWasteRate.toFixed(1)}%). Current volume may be underserving demand.`,
        metric_label: 'Sell-Through',
        metric_value: `${overallSellThrough.toFixed(1)}%`,
        is_ml_derived: false,
      });
      continue;
    }

    // Rule 6: Stable & Balanced Consumption
    recommendations.push({
      id: `rec_item_${itemId}_stable`,
      title: `Balanced Production Maintained on ${item.name}`,
      action: 'Maintain current preparation schedule. Monitor weekly consumption for seasonal fluctuations.',
      affected_item: item.name,
      affected_item_id: itemId,
      category: item.category || 'General',
      priority: 'Low',
      type: 'data_driven',
      evidence: `Healthy equilibrium: ${overallWasteRate.toFixed(1)}% waste rate and ${overallSellThrough.toFixed(1)}% sell-through across ${count} logged days.`,
      metric_label: 'Waste Rate',
      metric_value: `${overallWasteRate.toFixed(1)}%`,
      is_ml_derived: false,
    });
  }

  // Priority sorting: High > Medium > Low
  const priorityOrder = { High: 1, Medium: 2, Low: 3 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  const counts = {
    total: recommendations.length,
    high: recommendations.filter((r) => r.priority === 'High').length,
    medium: recommendations.filter((r) => r.priority === 'Medium').length,
    low: recommendations.filter((r) => r.priority === 'Low').length,
  };

  return { recommendations, counts };
}

module.exports = { generateRecommendations };
