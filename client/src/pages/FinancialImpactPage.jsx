import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { analyticsApi } from '../api/axios';
import useSEO from '../hooks/useSEO';

export default function FinancialImpactPage() {
  useSEO({ title: 'Financial Impact — FoodWaste AI', noindex: true });

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchFinancialData();
  }, []);

  const fetchFinancialData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await analyticsApi.getFinancialImpact();
      setData(res.data?.data || null);
    } catch (err) {
      setError(err?.message || 'Failed to load financial impact data.');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = (data?.item_breakdown || []).filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      {/* ── Top Header Section (Aligned with Dashboard & Analytics rhythm) ── */}
      <header
        className="px-4 sm:px-8 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{ borderBottom: '1px solid var(--border-color)' }}
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            💰 Financial Impact & Cost Analysis
          </h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Real-time quantification of surplus food costs derived strictly from logged kitchen demand and unit costs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <Link
            to="/food-items"
            className="px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold bg-[#DCEDE4] text-[#2F7D5A] border border-[#2F7D5A]/25 hover:bg-[#2F7D5A] hover:text-white transition-all shadow-xs flex items-center gap-1.5"
          >
            <span>⚙️</span>
            <span>Manage Item Costs</span>
          </Link>
          <button
            onClick={fetchFinancialData}
            disabled={loading}
            className="px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-[#E3E8E4] text-[#17251F] hover:bg-[#F7F8F4] transition-all shadow-xs flex items-center gap-1.5"
          >
            <span>↻</span>
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </header>

      {/* ── Main Content Container ── */}
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 flex-1 min-w-0 max-w-7xl">
        {/* Error State */}
        {error && (
          <div className="p-4 sm:p-5 rounded-2xl text-sm bg-[#C45B52]/10 border border-[#C45B52]/30 text-[#C45B52] flex items-center justify-between shadow-xs">
            <span>{error}</span>
            <button onClick={fetchFinancialData} className="underline text-xs ml-4 font-semibold hover:opacity-80">
              Try again
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="glass rounded-2xl p-12 sm:p-16 text-center text-[#66736C]">
            <div className="w-9 h-9 border-2 border-[#2F7D5A] border-t-transparent rounded-full animate-spin mx-auto mb-3.5" />
            <p className="text-sm font-medium">Calculating financial waste impact...</p>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* Missing Cost Notice Banner */}
            {data.cost_coverage?.items_without_cost_count > 0 && (
              <div className="p-5 sm:p-6 rounded-2xl bg-[#C89B3C]/10 border border-[#C89B3C]/30 text-[#17251F] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-white border border-[#C89B3C]/30 flex items-center justify-center text-lg flex-shrink-0">
                    ⚠️
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#17251F]">
                      {data.cost_coverage.items_without_cost_count} of {data.cost_coverage.total_items} food items are missing unit costs
                    </p>
                    <p className="text-xs text-[#66736C] mt-0.5 leading-relaxed">
                      Uncosted items are excluded from monetary calculations to prevent misleading estimates. Add unit costs in your catalog.
                    </p>
                  </div>
                </div>
                <Link
                  to="/food-items"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-[#C89B3C]/40 text-[#8B6B23] hover:bg-[#C89B3C]/20 transition-all flex-shrink-0 shadow-xs"
                >
                  Add Unit Costs →
                </Link>
              </div>
            )}

            {/* Zero Cost Data Empty State */}
            {data.status === 'no_cost_data' ? (
              <div className="glass rounded-2xl p-12 sm:p-16 text-center text-[#66736C] space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-[#DCEDE4] text-[#2F7D5A] flex items-center justify-center text-3xl mx-auto shadow-xs">
                  💰
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-[#17251F]">Add Unit Costs to Unlock Financial Analysis</h3>
                <p className="text-xs sm:text-sm text-[#66736C] max-w-lg mx-auto leading-relaxed">
                  None of your food items currently have unit costs configured. Add decimal unit costs in your food catalog to begin tracking exact waste loss and savings opportunities.
                </p>
                <div className="pt-2">
                  <Link
                    to="/food-items"
                    className="inline-block px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-[#2F7D5A] hover:bg-[#263B32] transition-all shadow-xs"
                  >
                    Configure Unit Costs Now
                  </Link>
                </div>
              </div>
            ) : data.status === 'no_demand_records' ? (
              <div className="glass rounded-2xl p-12 sm:p-16 text-center text-[#66736C] space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-[#DCEDE4] text-[#2F7D5A] flex items-center justify-center text-3xl mx-auto shadow-xs">
                  📈
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-[#17251F]">No Demand Records Logged Yet</h3>
                <p className="text-xs sm:text-sm text-[#66736C] max-w-lg mx-auto leading-relaxed">
                  Log your daily prepared, sold, and wasted quantities in Demand Data to evaluate real monetary loss.
                </p>
                <div className="pt-2">
                  <Link
                    to="/demand"
                    className="inline-block px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-[#2F7D5A] hover:bg-[#263B32] transition-all shadow-xs"
                  >
                    Go to Demand Data
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {/* ── 4 KPI Metric Cards (Generous padding, consistent min-height) ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                  {/* 1. Actual Waste Cost */}
                  <div className="glass rounded-2xl p-5 sm:p-6 border border-[#E3E8E4] shadow-xs flex flex-col justify-between min-h-[160px] transition-all">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#66736C]">
                          Calculated Waste Cost
                        </span>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#C45B52]/10 text-[#C45B52] border border-[#C45B52]/20 whitespace-nowrap">
                          Actual Expense
                        </span>
                      </div>
                      <p className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-[#C45B52] mt-1">
                        {data.totals.total_waste_cost !== null
                          ? `₹${Number(data.totals.total_waste_cost).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '—'}
                      </p>
                    </div>
                    <p className="text-xs text-[#66736C] mt-3 pt-2 border-t border-[#E3E8E4]/60 leading-normal">
                      Direct loss on costed items (wasted qty × unit cost)
                    </p>
                  </div>

                  {/* 2. Potential Savings */}
                  <div className="glass rounded-2xl p-5 sm:p-6 border border-[#E3E8E4] shadow-xs flex flex-col justify-between min-h-[160px] transition-all">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#66736C]">
                          Potential Savings
                        </span>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border whitespace-nowrap ${
                          data.totals.potential_savings_status === 'calculated'
                            ? 'bg-[#DCEDE4] text-[#2F7D5A] border-[#2F7D5A]/20'
                            : 'bg-[#F7F8F4] text-[#66736C] border-[#E3E8E4]'
                        }`}>
                          {data.totals.potential_savings_status === 'calculated' ? 'Data Projection' : 'Uncalculable'}
                        </span>
                      </div>
                      <p className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-[#2F7D5A] mt-1">
                        {data.totals.total_potential_savings !== null
                          ? `₹${Number(data.totals.total_potential_savings).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '—'}
                      </p>
                    </div>
                    <p className="text-xs text-[#66736C] mt-3 pt-2 border-t border-[#E3E8E4]/60 leading-normal">
                      {data.totals.potential_savings_status === 'calculated'
                        ? 'Excess loss above best demonstrated historical rate'
                        : 'Requires ≥ 3 records/item for baseline efficiency'}
                    </p>
                  </div>

                  {/* 3. Top Waste Cost Item */}
                  <div className="glass rounded-2xl p-5 sm:p-6 border border-[#E3E8E4] shadow-xs flex flex-col justify-between min-h-[160px] transition-all">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#66736C]">
                          Top Waste Cost Item
                        </span>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#C89B3C]/10 text-[#8B6B23] border border-[#C89B3C]/20 whitespace-nowrap">
                          Priority Focus
                        </span>
                      </div>
                      <p className="text-lg sm:text-xl font-bold text-[#17251F] truncate mt-1">
                        {data.highest_waste_cost_item ? data.highest_waste_cost_item.name : 'Zero Waste'}
                      </p>
                      <p className="text-sm font-mono text-[#C45B52] font-semibold mt-0.5">
                        {data.highest_waste_cost_item
                          ? `₹${Number(data.highest_waste_cost_item.total_waste_cost).toFixed(2)} lost`
                          : 'No loss recorded'}
                      </p>
                    </div>
                    <p className="text-xs text-[#66736C] mt-3 pt-2 border-t border-[#E3E8E4]/60 leading-normal truncate">
                      {data.highest_waste_cost_item
                        ? `${data.highest_waste_cost_item.total_wasted} ${data.highest_waste_cost_item.unit} wasted @ ₹${Number(data.highest_waste_cost_item.unit_cost).toFixed(2)}`
                        : 'No items with positive waste'}
                    </p>
                  </div>

                  {/* 4. Cost Data Coverage */}
                  <div className="glass rounded-2xl p-5 sm:p-6 border border-[#E3E8E4] shadow-xs flex flex-col justify-between min-h-[160px] transition-all">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#66736C]">
                          Cost Data Coverage
                        </span>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#F7F8F4] text-[#17251F] border border-[#E3E8E4] whitespace-nowrap">
                          {data.cost_coverage.cost_coverage_percentage}% Catalog
                        </span>
                      </div>
                      <p className="text-2xl sm:text-3xl font-bold text-[#17251F] tracking-tight mt-1">
                        {data.cost_coverage.items_with_cost_count}{' '}
                        <span className="text-sm font-normal text-[#66736C]">/ {data.cost_coverage.total_items} items</span>
                      </p>
                    </div>
                    <p className="text-xs text-[#66736C] mt-3 pt-2 border-t border-[#E3E8E4]/60 leading-normal">
                      {data.cost_coverage.items_without_cost_count > 0
                        ? `${data.cost_coverage.items_without_cost_count} items still missing unit cost`
                        : '100% of catalog has unit costs configured'}
                    </p>
                  </div>
                </div>

                {/* ── Periods Comparison & Methodology Panels (Distinct, well-padded grid) ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
                  {/* Period Comparison Card */}
                  <div className="glass rounded-2xl p-5 sm:p-6 border border-[#E3E8E4] shadow-xs lg:col-span-1 flex flex-col justify-between">
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-[#66736C] mb-4">
                        Period Cost Comparison
                      </h2>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm py-2.5 border-b border-[#E3E8E4]/60">
                          <span className="text-[#66736C]">Current Period:</span>
                          <span className="font-mono font-semibold text-[#17251F]">
                            {data.totals.current_period_waste_cost !== null
                              ? `₹${Number(data.totals.current_period_waste_cost).toFixed(2)}`
                              : '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm py-2.5 border-b border-[#E3E8E4]/60">
                          <span className="text-[#66736C]">Previous Period:</span>
                          <span className="font-mono font-semibold text-[#17251F]">
                            {data.totals.previous_period_waste_cost !== null
                              ? `₹${Number(data.totals.previous_period_waste_cost).toFixed(2)}`
                              : <span className="text-xs text-[#66736C] italic font-sans font-normal">Insufficient historical periods</span>}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-[#66736C] mt-4 pt-3 border-t border-[#E3E8E4]/60 leading-relaxed">
                      Derived from chronological halving of unique recorded dates for your organization.
                    </p>
                  </div>

                  {/* Methodology Transparency Panel */}
                  <div className="glass rounded-2xl p-5 sm:p-6 border border-[#E3E8E4] shadow-xs lg:col-span-2 flex flex-col justify-between">
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-[#66736C] mb-3">
                        Mathematical Transparency & Calculation Principles
                      </h2>
                      <div className="space-y-3 text-xs text-[#66736C] leading-relaxed">
                        <div className="flex items-start gap-2.5">
                          <span className="text-[#2F7D5A] font-bold text-sm leading-none mt-0.5">•</span>
                          <p>
                            <strong className="text-[#17251F]">Actual Waste Cost:</strong> Computed as <code className="bg-[#F7F8F4] px-1.5 py-0.5 rounded border border-[#E3E8E4] text-[#17251F] font-mono">Quantity Wasted × Unit Cost</code> per item. Items without cost are strictly excluded rather than guessing default values.
                          </p>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <span className="text-[#2F7D5A] font-bold text-sm leading-none mt-0.5">•</span>
                          <p>
                            <strong className="text-[#17251F]">Potential Savings:</strong> Defensibly calculated from your organization’s own best observed waste rate per item across days with ≥ 3 recorded demand logs. No arbitrary benchmark percentages (e.g. "assume 20% reduction") are used.
                          </p>
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-[#66736C]/80 italic mt-4 pt-3 border-t border-[#E3E8E4]/60">
                      * Projections reflect historical efficiency variance and do not represent guaranteed commercial savings.
                    </p>
                  </div>
                </div>

                {/* ── Item-Level Financial Breakdown (Distinct card section with generous padding) ── */}
                <div className="glass rounded-2xl border border-[#E3E8E4] shadow-xs overflow-hidden">
                  {/* Table Header & Search Bar */}
                  <div className="p-5 sm:p-6 border-b border-[#E3E8E4] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-[#17251F]">Item-Level Financial Breakdown</h2>
                      <p className="text-xs text-[#66736C] mt-0.5">
                        Detailed monetary performance and excess waste evaluation per catalog item
                      </p>
                    </div>
                    <div className="w-full sm:w-72">
                      <input
                        type="text"
                        placeholder="Filter by item or category..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full px-4 py-2 rounded-xl text-xs sm:text-sm text-[#17251F] bg-white border border-[#E3E8E4] focus:outline-none focus:border-[#2F7D5A] shadow-xs"
                      />
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px] text-left text-sm">
                      <thead>
                        <tr className="bg-[#F7F8F4]/60 border-b border-[#E3E8E4] text-[#66736C]">
                          <th className="py-3.5 px-6 text-xs font-semibold uppercase tracking-wider">Food Item</th>
                          <th className="py-3.5 px-6 text-xs font-semibold uppercase tracking-wider">Category</th>
                          <th className="py-3.5 px-6 text-xs font-semibold uppercase tracking-wider">Unit Cost</th>
                          <th className="py-3.5 px-6 text-xs font-semibold uppercase tracking-wider">Wasted Qty</th>
                          <th className="py-3.5 px-6 text-xs font-semibold uppercase tracking-wider">Waste Rate</th>
                          <th className="py-3.5 px-6 text-xs font-semibold uppercase tracking-wider text-right">Calculated Waste Cost</th>
                          <th className="py-3.5 px-6 text-xs font-semibold uppercase tracking-wider text-right">Potential Savings</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E3E8E4]">
                        {filteredItems.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-10 text-center text-[#66736C] text-sm">
                              No items match "{search}".
                            </td>
                          </tr>
                        ) : (
                          filteredItems.map((item) => (
                            <tr key={item.id} className="hover:bg-[#F7F8F4] transition-colors">
                              <td className="py-4 px-6 font-medium text-[#17251F]">
                                <span>{item.name}</span>
                                <span className="block text-xs text-[#66736C] font-normal font-mono mt-0.5">
                                  {item.records_count} records logged
                                </span>
                              </td>
                              <td className="py-4 px-6">
                                <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-[#F7F8F4] border border-[#E3E8E4] text-[#263B32]">
                                  {item.category}
                                </span>
                              </td>
                              <td className="py-4 px-6 text-xs font-mono">
                                {item.has_cost ? (
                                  <span className="text-[#17251F] font-semibold text-sm">₹{Number(item.unit_cost).toFixed(2)}</span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[11px] bg-[#C89B3C]/10 text-[#8B6B23] border border-[#C89B3C]/20 font-sans font-medium">
                                    Missing Cost
                                  </span>
                                )}
                              </td>
                              <td className="py-4 px-6 text-xs text-[#17251F] font-medium">
                                {item.total_wasted} <span className="text-[#66736C] font-mono text-[11px] font-normal">{item.unit}</span>
                              </td>
                              <td className="py-4 px-6 text-xs">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                  item.waste_rate > 20
                                    ? 'bg-[#C45B52]/10 text-[#C45B52] border-[#C45B52]/20'
                                    : item.waste_rate > 10
                                    ? 'bg-[#C89B3C]/10 text-[#8B6B23] border-[#C89B3C]/20'
                                    : 'bg-[#DCEDE4] text-[#2F7D5A] border-[#2F7D5A]/20'
                                }`}>
                                  {item.waste_rate}%
                                </span>
                              </td>
                              <td className="py-4 px-6 text-right text-xs font-mono font-semibold">
                                {item.total_waste_cost !== null ? (
                                  <span className={`text-sm ${item.total_waste_cost > 0 ? 'text-[#C45B52]' : 'text-[#66736C]'}`}>
                                    ₹{Number(item.total_waste_cost).toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-[#66736C]/60 italic font-sans font-normal text-xs">
                                    Excluded (No Cost)
                                  </span>
                                )}
                              </td>
                              <td className="py-4 px-6 text-right text-xs font-mono">
                                {item.potential_savings !== null ? (
                                  <span className="text-[#2F7D5A] font-semibold text-sm">
                                    ₹{Number(item.potential_savings).toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-[#66736C]/50 italic font-sans font-normal text-xs">
                                    {item.has_cost ? '< 3 records' : '—'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
