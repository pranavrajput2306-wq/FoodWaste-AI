import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { analyticsApi } from '../api/axios';
import useSEO from '../hooks/useSEO';

export default function AnalyticsPage() {
  useSEO({ title: 'Sustainability Analytics — FoodWaste AI', noindex: true });
  const [data, setData] = useState(null);
  const [benchmark, setBenchmark] = useState(null);
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterQuery, setFilterQuery] = useState('');
  const [hoveredTrendPoint, setHoveredTrendPoint] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError('');
      const [summaryRes, benchmarkRes, goalRes] = await Promise.all([
        analyticsApi.getSummary(),
        analyticsApi.getBenchmark().catch(() => null),
        analyticsApi.getGoal().catch(() => null),
      ]);
      setData(summaryRes.data.data);
      if (benchmarkRes?.data?.data) {
        setBenchmark(benchmarkRes.data.data);
      }
      if (goalRes?.data?.data) {
        setGoal(goalRes.data.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load analytics data.');
    } finally {
      setLoading(false);
    }
  };

  const totals = data?.totals || {
    total_prepared: 0,
    total_sold: 0,
    total_wasted: 0,
    overall_waste_rate: 0,
    overall_sell_through_rate: 0,
    total_records: 0,
    total_items: 0,
  };

  const coverage = data?.coverage || {
    first_record_date: null,
    last_record_date: null,
    total_days_recorded: 0,
    active_items_count: 0,
  };

  const trend = data?.trend || [];
  const itemBreakdown = data?.item_breakdown || [];
  const topWasteItems = data?.top_waste_items || [];

  const filteredItems = itemBreakdown.filter((item) =>
    item.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(filterQuery.toLowerCase())
  );

  // SVG Chart Dimensions
  const chartWidth = 720;
  const chartHeight = 220;
  const padding = { top: 25, right: 30, bottom: 35, left: 45 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  // Compute trend chart coordinates
  const maxTrendRate = Math.max(30, ...trend.map((t) => t.waste_rate));
  const points = trend.map((t, idx) => {
    const x =
      trend.length === 1
        ? padding.left + innerWidth / 2
        : padding.left + (idx / (trend.length - 1)) * innerWidth;
    const y =
      padding.top + innerHeight - (t.waste_rate / maxTrendRate) * innerHeight;
    return { ...t, x, y };
  });

  const pathD = points.length > 0
    ? points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '')
    : '';

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${padding.top + innerHeight} L ${points[0].x} ${padding.top + innerHeight} Z`
    : '';

  return (
    <AppLayout>
      {/* Header */}
      <header
        className="px-4 sm:px-8 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{ borderBottom: '1px solid var(--border-color)' }}
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            📉 Sustainability & Waste Analytics
          </h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Real-time consumption efficiency, waste ratios, and operational loss metrics
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <Link
            to="/financial-impact"
            className="px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold bg-[#C89B3C]/10 border border-[#C89B3C]/30 text-[#8B6B23] hover:bg-[#C89B3C]/20 transition-all flex items-center gap-1.5 shadow-xs"
          >
            <span>💰</span>
            <span>Financial Impact</span>
          </Link>
          <Link
            to="/recommendations"
            className="px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold bg-[#DCEDE4] border border-[#2F7D5A]/30 text-[#2F7D5A] hover:bg-[#2F7D5A] hover:text-white transition-all flex items-center gap-1.5 shadow-xs"
          >
            <span>💡</span>
            <span>View Recommendations</span>
          </Link>
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white text-[#17251F] hover:bg-[#F7F8F4] border border-[#E3E8E4] transition-all shadow-xs"
          >
            {loading ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>
      </header>

      <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 flex-1 min-w-0">
        {error && (
          <div className="p-4 rounded-xl bg-[#C45B52]/10 border border-[#C45B52]/30 text-[#C45B52] text-sm">
            {error}
          </div>
        )}

        {/* ── Summary KPI Cards ─────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="glass rounded-xl p-4 sm:p-5 shadow-xs">
            <span className="text-xs text-[#66736C] font-medium">Overall Waste Rate</span>
            <p
              className="text-2xl font-bold mt-1"
              style={{
                color:
                  totals.overall_waste_rate > 20
                    ? '#C45B52'
                    : totals.overall_waste_rate > 10
                    ? '#C89B3C'
                    : '#2F7D5A',
              }}
            >
              {loading ? '...' : `${totals.overall_waste_rate}%`}
            </p>
            <p className="text-[11px] text-[#66736C] mt-1">
              {totals.overall_waste_rate <= 10
                ? 'Healthy benchmark (< 10%)'
                : totals.overall_waste_rate <= 20
                ? 'Moderate loss (10–20%)'
                : 'Elevated loss (> 20%)'}
            </p>
          </div>

          <div className="glass rounded-xl p-5 shadow-xs">
            <span className="text-xs text-[#66736C] font-medium">Sell-Through Rate</span>
            <p className="text-2xl font-bold mt-1 text-[#2F7D5A]">
              {loading ? '...' : `${totals.overall_sell_through_rate}%`}
            </p>
            <p className="text-[11px] text-[#66736C] mt-1">Prepared volume successfully sold</p>
          </div>

          <div className="glass rounded-xl p-5 shadow-xs">
            <span className="text-xs text-[#66736C] font-medium">Total Prepared</span>
            <p className="text-2xl font-bold mt-1 text-[#17251F]">
              {loading ? '...' : totals.total_prepared.toLocaleString()}
            </p>
            <p className="text-[11px] text-[#66736C] mt-1">Across all catalog items</p>
          </div>

          <div className="glass rounded-xl p-5 shadow-xs">
            <span className="text-xs text-[#66736C] font-medium">Total Surplus Wasted</span>
            <p className="text-2xl font-bold mt-1 text-[#C45B52]">
              {loading ? '...' : totals.total_wasted.toLocaleString()}
            </p>
            <p className="text-[11px] text-[#66736C] mt-1">Unserved food lost</p>
          </div>

          <div className="glass rounded-xl p-5 shadow-xs">
            <span className="text-xs text-[#66736C] font-medium">Data Coverage</span>
            <p className="text-2xl font-bold mt-1 text-[#263B32]">
              {loading ? '...' : `${coverage.total_days_recorded} Days`}
            </p>
            <p className="text-[11px] text-[#66736C] mt-1">
              {totals.total_records} logs • {coverage.active_items_count} items
            </p>
          </div>
        </div>

        {/* ── Empty State ──────────────────────────────────────── */}
        {!loading && totals.total_records === 0 && (
          <div className="glass rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4 shadow-xs">
            <div className="text-5xl">📊</div>
            <h2 className="text-lg font-bold text-[#17251F]">No Historical Consumption Data</h2>
            <p className="text-xs text-[#66736C] leading-relaxed">
              Analytics graphs, item waste ratios, and trend calculations are derived from genuine daily demand records.
              Start by recording your daily preparation, sales, and wasted quantities.
            </p>
            <Link
              to="/demand"
              className="inline-block px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#2F7D5A] hover:bg-[#263B32] text-white transition-all shadow-xs"
            >
              + Log First Demand Record
            </Link>
          </div>
        )}

        {/* ── Organization Performance Baseline & Historical Benchmark ── */}
        {!loading && benchmark && benchmark.status !== 'no_data' && (
          <div className="glass rounded-2xl p-5 sm:p-6 shadow-xs border border-[#E3E8E4] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎯</span>
                  <h2 className="text-base font-bold text-[#17251F]">
                    Organization Performance Baseline
                  </h2>
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-[#DCEDE4] text-[#2F7D5A] border border-[#2F7D5A]/20">
                    Historical Benchmark
                  </span>
                </div>
                <p className="text-xs text-[#66736C] mt-0.5">
                  Internal performance baseline computed strictly from your authorized demand data.
                </p>
              </div>

              {benchmark.status === 'single_record' && (
                <span className="text-xs text-[#C89B3C] bg-[#C89B3C]/10 border border-[#C89B3C]/30 px-2.5 py-1 rounded-lg font-medium self-start sm:self-auto">
                  Initial log baseline
                </span>
              )}
            </div>

            {/* 4 Metric Tiles */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Current Waste Rate */}
              <div className="bg-white/80 rounded-xl p-3.5 sm:p-4 border border-[#E3E8E4]">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#66736C] font-medium block">Current Waste Rate</span>
                  <span className="text-[10px] text-[#66736C] bg-[#F7F8F4] px-1.5 py-0.5 rounded border border-[#E3E8E4]">Latest recorded day</span>
                </div>
                <p
                  className="text-xl sm:text-2xl font-bold mt-1"
                  style={{
                    color:
                      benchmark.current_waste_rate > 20
                        ? '#C45B52'
                        : benchmark.current_waste_rate > 10
                        ? '#C89B3C'
                        : '#2F7D5A',
                  }}
                >
                  {benchmark.current_waste_rate}%
                </p>
                <p className="text-[11px] text-[#66736C] mt-1 truncate">
                  Latest recorded day: {benchmark.current_period?.date || 'N/A'}
                </p>
              </div>

              {/* Historical Average */}
              <div className="bg-white/80 rounded-xl p-3.5 sm:p-4 border border-[#E3E8E4]">
                <span className="text-xs text-[#66736C] font-medium block">Historical Average</span>
                <p className="text-xl sm:text-2xl font-bold mt-1 text-[#17251F]">
                  {benchmark.historical_average_waste_rate}%
                </p>
                <p className="text-[11px] text-[#66736C] mt-1">
                  Volume-weighted ({benchmark.totals.total_days_recorded} {benchmark.totals.total_days_recorded === 1 ? 'day' : 'days'})
                </p>
              </div>

              {/* Best Observed Rate */}
              <div className="bg-white/80 rounded-xl p-3.5 sm:p-4 border border-[#E3E8E4]">
                <span className="text-xs text-[#66736C] font-medium block">Best Observed Rate</span>
                <p className="text-xl sm:text-2xl font-bold mt-1 text-[#2F7D5A]">
                  {benchmark.best_observed_waste_rate}%
                </p>
                <p className="text-[11px] text-[#66736C] mt-1 truncate">
                  Achieved: {benchmark.best_observed_period?.date || 'N/A'}
                </p>
              </div>

              {/* Improvement Gap */}
              <div className="bg-white/80 rounded-xl p-3.5 sm:p-4 border border-[#E3E8E4]">
                <span className="text-xs text-[#66736C] font-medium block">Improvement Gap</span>
                <p
                  className="text-xl sm:text-2xl font-bold mt-1"
                  style={{
                    color:
                      benchmark.improvement_gap === 0
                        ? '#2F7D5A'
                        : benchmark.improvement_gap > 10
                        ? '#C45B52'
                        : '#C89B3C',
                  }}
                >
                  {benchmark.improvement_gap > 0 ? `+${benchmark.improvement_gap}%` : '0.00%'}
                </p>
                <p className="text-[11px] text-[#66736C] mt-1">
                  {benchmark.improvement_gap === 0
                    ? 'At historical peak efficiency'
                    : 'To reach best observed rate'}
                </p>
              </div>
            </div>

            {/* Best performing items & Disclaimer Note */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-[#E3E8E4]/60 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[#66736C] font-medium">
                  Best-performing items (≥3 records):
                </span>
                {benchmark.best_performing_items && benchmark.best_performing_items.length > 0 ? (
                  benchmark.best_performing_items.map((item) => (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#DCEDE4] text-[#2F7D5A] border border-[#2F7D5A]/20 font-medium text-[11px]"
                    >
                      <span>🍲 {item.name}</span>
                      <span className="font-bold">({item.waste_rate}% historical rate)</span>
                    </span>
                  ))
                ) : (
                  <span className="text-[#8B9891] italic text-[11px]">
                    Requires at least 3 logged records per item to establish reliable performance.
                  </span>
                )}
              </div>

              <div className="text-[11px] text-[#8B9891] italic">
                * Best observed rate reflects historical performance, NOT a guaranteed future result.
              </div>
            </div>
          </div>
        )}

        {/* ── Actionable Waste Reduction Goal ──────────────────── */}
        {!loading && goal && goal.status !== 'no_data' && (
          <div className="glass rounded-2xl p-5 sm:p-6 shadow-xs border border-[#E3E8E4] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">🏆</span>
                  <h2 className="text-base font-bold text-[#17251F]">
                    Actionable Waste Reduction Goal
                  </h2>
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-[#C89B3C]/10 text-[#8B6B23] border border-[#C89B3C]/30">
                    Operational Target
                  </span>
                </div>
                <p className="text-xs text-[#66736C] mt-0.5">
                  Achievable efficiency targets derived strictly from your organization's demonstrated historical performance.
                </p>
              </div>

              {goal.status === 'insufficient_data' ? (
                <span className="text-xs text-[#C89B3C] bg-[#C89B3C]/10 border border-[#C89B3C]/30 px-2.5 py-1 rounded-lg font-medium self-start sm:self-auto">
                  Initial baseline established
                </span>
              ) : goal.remaining_gap === 0 ? (
                <span className="text-xs text-[#2F7D5A] bg-[#DCEDE4] border border-[#2F7D5A]/30 px-2.5 py-1 rounded-lg font-medium self-start sm:self-auto">
                  ✓ Operating at peak efficiency
                </span>
              ) : (
                <span className="text-xs text-[#17251F] bg-[#F7F8F4] border border-[#E3E8E4] px-2.5 py-1 rounded-lg font-medium self-start sm:self-auto">
                  Target Gap: {goal.remaining_gap}%
                </span>
              )}
            </div>

            {/* 4 Metric Tiles */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Target Waste Rate */}
              <div className="bg-white/80 rounded-xl p-3.5 sm:p-4 border border-[#E3E8E4]">
                <span className="text-xs text-[#66736C] font-medium block">Target Waste Rate</span>
                <p className="text-xl sm:text-2xl font-bold mt-1 text-[#2F7D5A]">
                  {goal.target_waste_rate}%
                </p>
                <p className="text-[11px] text-[#66736C] mt-1 truncate" title={goal.target_basis}>
                  {goal.target_basis ? goal.target_basis : 'Historical peak efficiency'}
                </p>
              </div>

              {/* Current vs Target */}
              <div className="bg-white/80 rounded-xl p-3.5 sm:p-4 border border-[#E3E8E4]">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#66736C] font-medium block">Current vs Target</span>
                  <span className="text-[10px] text-[#66736C] bg-[#F7F8F4] px-1.5 py-0.5 rounded border border-[#E3E8E4]">Latest day vs Target</span>
                </div>
                <p
                  className="text-xl sm:text-2xl font-bold mt-1"
                  style={{
                    color:
                      goal.remaining_gap === 0
                        ? '#2F7D5A'
                        : goal.remaining_gap > 10
                        ? '#C45B52'
                        : '#C89B3C',
                  }}
                >
                  {goal.remaining_gap === 0 ? '0.00%' : `-${goal.remaining_gap}%`}
                </p>
                <p className="text-[11px] text-[#66736C] mt-1">
                  Latest day: {goal.current_waste_rate}% → Target: {goal.target_waste_rate}%
                </p>
              </div>

              {/* Est. Quantity Reduction Opportunity */}
              <div className="bg-white/80 rounded-xl p-3.5 sm:p-4 border border-[#E3E8E4]">
                <span className="text-xs text-[#66736C] font-medium block">Quantity Opportunity</span>
                <p className="text-xl sm:text-2xl font-bold mt-1 text-[#17251F]">
                  {goal.reduction_opportunity?.period_quantity !== null
                    ? `${goal.reduction_opportunity.period_quantity} units`
                    : '—'}
                </p>
                <p className="text-[11px] text-[#66736C] mt-1 truncate">
                  {goal.reduction_opportunity?.period_quantity !== null
                    ? `Per batch (${goal.reduction_opportunity.total_quantity} units overall)`
                    : 'Requires ≥2 logged dates'}
                </p>
              </div>

              {/* Est. Financial Opportunity */}
              <div className="bg-white/80 rounded-xl p-3.5 sm:p-4 border border-[#E3E8E4]">
                <span className="text-xs text-[#66736C] font-medium block">Financial Opportunity</span>
                <p className="text-xl sm:text-2xl font-bold mt-1 text-[#C89B3C]">
                  {goal.financial_impact?.potential_savings !== null
                    ? `$${Number(goal.financial_impact.potential_savings).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : '—'}
                </p>
                <p className="text-[11px] text-[#66736C] mt-1 truncate">
                  {goal.financial_impact?.potential_savings !== null
                    ? 'Excess cost above peak rate'
                    : goal.financial_impact?.status === 'missing_cost'
                    ? 'Add item unit costs'
                    : 'Requires ≥3 logs / costed item'}
                </p>
              </div>
            </div>

            {/* Suggested Focus Food Items */}
            {goal.suggested_focus_items && goal.suggested_focus_items.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[#E3E8E4]/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#17251F]">
                    Historical Priority Focus Items:
                  </span>
                  <span className="text-[11px] text-[#66736C]">
                    Prioritized by observed historical loss
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {goal.suggested_focus_items.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white/90 rounded-xl p-3 border border-[#E3E8E4] flex flex-col justify-between gap-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-xs text-[#17251F] truncate" title={item.name}>
                          🍲 {item.name}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            item.priority === 'High'
                              ? 'bg-[#C45B52]/10 text-[#C45B52]'
                              : 'bg-[#C89B3C]/10 text-[#8B6B23]'
                          }`}
                        >
                          {item.waste_rate}% historical waste rate
                        </span>
                      </div>
                      <p className="text-[11px] text-[#66736C] leading-snug line-clamp-2">
                        {item.suggested_action}
                      </p>
                      {item.total_waste_cost !== null && (
                        <div className="text-[10px] text-[#8B6B23] font-medium pt-1 border-t border-[#E3E8E4]/40 flex justify-between">
                          <span>Historical Waste Cost:</span>
                          <span className="font-bold">${item.total_waste_cost}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Footer / Disclaimer Note */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-[#E3E8E4]/60 text-xs">
              <div className="text-[11px] text-[#66736C]">
                {goal.remaining_gap === 0
                  ? '🎯 Maintaining your best observed rate preserves maximum operational efficiency.'
                  : `💡 Reducing daily prep waste to ${goal.target_waste_rate}% closes the ${goal.remaining_gap}% efficiency gap.`}
              </div>
              <div className="text-[11px] text-[#8B9891] italic">
                * Target is based on historical performance and is NOT a guaranteed future result.
              </div>
            </div>
          </div>
        )}

        {/* ── Visualizations Section ─────────────────────── */}
        {totals.total_records > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Waste Trend Line Chart */}
            <div className="lg:col-span-2 glass rounded-2xl p-6 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-[#17251F]">Waste Rate Trend Over Time</h2>
                    <p className="text-xs text-[#66736C] mt-0.5">
                      Daily aggregate waste percentage chronologically ordered
                    </p>
                  </div>
                  <span className="text-xs font-mono text-[#66736C] bg-[#F7F8F4] px-2.5 py-1 rounded-lg border border-[#E3E8E4]">
                    Max: {maxTrendRate.toFixed(0)}%
                  </span>
                </div>

                {trend.length === 0 ? (
                  <p className="text-xs text-[#66736C] py-16 text-center">No trend points available</p>
                ) : (
                  <div className="relative overflow-x-auto">
                    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto">
                      <defs>
                        <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#C45B52" stopOpacity="0.2" />
                          <stop offset="100%" stopColor="#C45B52" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Horizontal Grid Lines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                        const yVal = padding.top + innerHeight * (1 - ratio);
                        const labelVal = Math.round(maxTrendRate * ratio);
                        return (
                          <g key={ratio}>
                            <line
                              x1={padding.left}
                              y1={yVal}
                              x2={padding.left + innerWidth}
                              y2={yVal}
                              stroke="#E3E8E4"
                              strokeDasharray="3 3"
                            />
                            <text
                              x={padding.left - 8}
                              y={yVal + 3}
                              fill="#66736C"
                              fontSize="10"
                              textAnchor="end"
                              fontFamily="monospace"
                            >
                              {labelVal}%
                            </text>
                          </g>
                        );
                      })}

                      {/* Area Fill */}
                      <path d={areaD} fill="url(#trendGradient)" />

                      {/* Trend Line */}
                      <path
                        d={pathD}
                        fill="none"
                        stroke="#C45B52"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Data Points */}
                      {points.map((p, idx) => (
                        <circle
                          key={idx}
                          cx={p.x}
                          cy={p.y}
                          r={hoveredTrendPoint?.date === p.date ? '5' : '3.5'}
                          fill={hoveredTrendPoint?.date === p.date ? '#17251F' : '#C45B52'}
                          stroke="#FFFFFF"
                          strokeWidth="2"
                          className="cursor-pointer transition-all"
                          onMouseEnter={() => setHoveredTrendPoint(p)}
                          onMouseLeave={() => setHoveredTrendPoint(null)}
                        />
                      ))}

                      {/* X-axis date labels */}
                      {points.map((p, idx) => {
                        if (points.length > 8 && idx % 2 !== 0 && idx !== points.length - 1) return null;
                        return (
                          <text
                            key={idx}
                            x={p.x}
                            y={chartHeight - 8}
                            fill="#66736C"
                            fontSize="9"
                            textAnchor="middle"
                            fontFamily="monospace"
                          >
                            {p.date.slice(5)}
                          </text>
                        );
                      })}
                    </svg>

                    {/* Tooltip */}
                    {hoveredTrendPoint && (
                      <div className="mt-3 p-3 rounded-xl bg-[#17251F] border border-[#263B32] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-white shadow-md">
                        <span className="font-mono text-white font-semibold">{hoveredTrendPoint.date}</span>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          <span className="text-[#DCEDE4]">Prep: {hoveredTrendPoint.prepared}</span>
                          <span className="text-[#2F7D5A]">Sold: {hoveredTrendPoint.sold}</span>
                          <span className="text-[#C45B52]">Wasted: {hoveredTrendPoint.wasted}</span>
                          <span className="font-bold text-[#C89B3C]">Rate: {hoveredTrendPoint.waste_rate}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-[#E3E8E4] text-[11px] text-[#66736C] flex items-center justify-between">
                <span>Coverage range: {coverage.first_record_date || 'N/A'} → {coverage.last_record_date || 'N/A'}</span>
                <span>{trend.length} recorded daily aggregate(s)</span>
              </div>
            </div>

            {/* Prepared vs Sold vs Wasted Volume Ratio */}
            <div className="glass rounded-2xl p-6 flex flex-col justify-between shadow-xs">
              <div>
                <h2 className="text-base font-bold text-[#17251F] mb-1">Volume Disposition</h2>
                <p className="text-xs text-[#66736C] mb-5">
                  Proportion of total kitchen output accounted for
                </p>

                <div className="space-y-4">
                  {/* Sold bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-[#17251F] font-medium">Sold Volume</span>
                      <span className="font-mono text-[#2F7D5A] font-semibold">
                        {totals.total_sold.toLocaleString()} ({totals.overall_sell_through_rate}%)
                      </span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-[#E3E8E4] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#2F7D5A] transition-all duration-500"
                        style={{ width: `${Math.min(100, totals.overall_sell_through_rate)}%` }}
                      />
                    </div>
                  </div>

                  {/* Wasted bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-[#17251F] font-medium">Wasted Surplus</span>
                      <span className="font-mono text-[#C45B52] font-semibold">
                        {totals.total_wasted.toLocaleString()} ({totals.overall_waste_rate}%)
                      </span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-[#E3E8E4] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#C45B52] transition-all duration-500"
                        style={{ width: `${Math.min(100, totals.overall_waste_rate)}%` }}
                      />
                    </div>
                  </div>

                  {/* Operational Summary */}
                  <div className="p-4 rounded-xl bg-[#F7F8F4] border border-[#E3E8E4] mt-6 space-y-2">
                    <p className="text-xs font-semibold text-[#17251F]">Efficiency Assessment</p>
                    <p className="text-[11px] text-[#66736C] leading-relaxed">
                      {totals.overall_waste_rate > 20
                        ? 'High surplus losses detected. Immediate recipe yield adjustment and inventory reduction are recommended.'
                        : totals.overall_waste_rate > 10
                        ? 'Moderate operational waste. Targeted daily adjustments on top-loss items can yield immediate savings.'
                        : 'Outstanding operational control. Production closely aligns with real consumption demand.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Top Waste Producing Items Preview */}
              <div className="mt-6 pt-4 border-t border-[#E3E8E4]">
                <span className="text-xs font-semibold text-[#17251F] block mb-2">
                  Top Surplus Items:
                </span>
                <div className="space-y-1.5">
                  {topWasteItems.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs">
                      <span className="text-[#17251F] truncate">{item.name}</span>
                      <span className="font-mono text-[#C45B52] font-semibold ml-2">
                        {item.total_wasted} {item.unit} ({item.waste_rate}%)
                      </span>
                    </div>
                  ))}
                  {topWasteItems.length === 0 && (
                    <p className="text-xs text-[#66736C]">No surplus waste recorded yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Food Item Waste Comparison Table ─────────────────────── */}
        {totals.total_records > 0 && (
          <div className="glass rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-[#17251F]">Item-Wise Sustainability Breakdown</h2>
                <p className="text-xs text-[#66736C] mt-0.5">
                  Comparative analysis of prepared volume, sell-through, and waste ratios across catalog items
                </p>
              </div>

              <input
                type="text"
                placeholder="Search food item or category..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="px-3.5 py-1.5 rounded-xl text-xs bg-white border border-[#E3E8E4] text-[#17251F] placeholder-[#66736C] focus:outline-none focus:border-[#2F7D5A] w-full sm:w-64 shadow-xs"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th className="py-3 px-4 text-xs font-semibold">Food Item</th>
                    <th className="py-3 px-4 text-xs font-semibold">Category</th>
                    <th className="py-3 px-4 text-xs font-semibold">Logs</th>
                    <th className="py-3 px-4 text-xs font-semibold">Prepared</th>
                    <th className="py-3 px-4 text-xs font-semibold">Sold</th>
                    <th className="py-3 px-4 text-xs font-semibold">Wasted</th>
                    <th className="py-3 px-4 text-xs font-semibold">Waste Rate</th>
                    <th className="py-3 px-4 text-xs font-semibold">Sell-Through</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E8E4]">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-[#F7F8F4] transition-colors">
                      <td className="py-3 px-4 font-medium text-[#17251F]">{item.name}</td>
                      <td className="py-3 px-4 text-xs text-[#66736C]">{item.category}</td>
                      <td className="py-3 px-4 font-mono text-xs text-[#66736C]">
                        {item.records_count}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-[#17251F]">
                        {item.total_prepared} {item.unit}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-[#2F7D5A] font-semibold">
                        {item.total_sold} {item.unit}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-[#C45B52] font-semibold">
                        {item.total_wasted} {item.unit}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                            item.waste_rate > 20
                              ? 'bg-[#C45B52]/10 text-[#C45B52] border-[#C45B52]/20'
                              : item.waste_rate > 10
                              ? 'bg-[#C89B3C]/10 text-[#C89B3C] border-[#C89B3C]/20'
                              : 'bg-[#DCEDE4] text-[#2F7D5A] border-[#2F7D5A]/20'
                          }`}
                        >
                          {item.waste_rate}%
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-[#17251F]">
                        {item.sell_through_rate}%
                      </td>
                    </tr>
                  ))}
                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-xs text-[#66736C]">
                        No food items match the search query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
