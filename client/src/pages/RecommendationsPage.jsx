import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { analyticsApi } from '../api/axios';
import useSEO from '../hooks/useSEO';

export default function RecommendationsPage() {
  useSEO({ title: 'Actionable Recommendations — FoodWaste AI', noindex: true });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await analyticsApi.getRecommendations();
      setData(res.data.data);
    } catch (err) {
      setError(err.message || 'Failed to load recommendations.');
    } finally {
      setLoading(false);
    }
  };

  const recommendations = data?.recommendations || [];
  const counts = data?.counts || { total: 0, high: 0, medium: 0, low: 0 };

  const filteredRecs = recommendations.filter((r) => {
    if (priorityFilter === 'ALL') return true;
    return r.priority.toUpperCase() === priorityFilter;
  });

  return (
    <AppLayout>
      {/* Header */}
      <header
        className="px-4 sm:px-8 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{ borderBottom: '1px solid var(--border-color)' }}
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            💡 Actionable Sustainability Recommendations
          </h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Deterministic, data-backed operational adjustments to prevent food waste and curb surplus
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <Link
            to="/analytics"
            className="px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold bg-[#FFFFFF] text-[#17251F] hover:bg-[#F7F8F4] border border-[#E3E8E4] shadow-xs transition-all flex items-center gap-1.5"
          >
            <span>📉</span>
            <span>Analytics Dashboard</span>
          </Link>
          <button
            onClick={fetchRecommendations}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#FFFFFF] text-[#17251F] hover:bg-[#F7F8F4] border border-[#E3E8E4] shadow-xs transition-all"
          >
            {loading ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>
      </header>

      <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 flex-1 min-w-0">
        {error && (
          <div className="p-4 rounded-xl bg-[#C45B52]/10 border border-[#C45B52]/20 text-[#C45B52] text-sm">
            {error}
          </div>
        )}

        {/* ── Governance & Distinction Banner ───────────────────── */}
        <div
          className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#E3E8E4] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <span className="text-2xl mt-0.5">⚖️</span>
            <div>
              <p className="text-sm font-semibold text-[#17251F]">
                Data-Driven Rules vs. ML Predictive Insights
              </p>
              <p className="text-xs text-[#66736C] mt-0.5 leading-relaxed">
                Recommendations here are deterministically generated from your real historical logs and threshold rules.
                Items with 7+ days of sequence history are eligible for trained machine learning regression and classification via AI Predictions.
              </p>
            </div>
          </div>

          <Link
            to="/predictions"
            className="w-full sm:w-auto text-center px-4 py-2 rounded-xl text-xs font-semibold bg-[#DCEDE4] text-[#2F7D5A] border border-[#2F7D5A]/30 hover:bg-[#2F7D5A] hover:text-white transition-all flex-shrink-0"
          >
            Go to AI Predictions →
          </Link>
        </div>

        {/* ── Filter & Priority Counters ─────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((p) => {
              const count =
                p === 'ALL'
                  ? counts.total
                  : p === 'HIGH'
                  ? counts.high
                  : p === 'MEDIUM'
                  ? counts.medium
                  : counts.low;

              const active = priorityFilter === p;
              return (
                <button
                  key={p}
                  onClick={() => setPriorityFilter(p)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    active
                      ? 'bg-[#2F7D5A] text-white shadow-xs'
                      : 'bg-[#FFFFFF] text-[#66736C] hover:text-[#17251F] border border-[#E3E8E4]'
                  }`}
                >
                  <span>{p}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      active ? 'bg-[#263B32] text-white' : 'bg-[#F7F8F4] text-[#66736C]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <span className="text-xs text-[#66736C]">
            Showing {filteredRecs.length} of {recommendations.length} action item(s)
          </span>
        </div>

        {/* ── Recommendations List ──────────────────────────────── */}
        {loading ? (
          <div className="p-16 text-center text-[#66736C]">
            <p className="text-sm">Evaluating historical data & generating recommendations...</p>
          </div>
        ) : filteredRecs.length === 0 ? (
          <div className="bg-[#FFFFFF] rounded-2xl border border-[#E3E8E4] shadow-xs p-12 text-center max-w-md mx-auto space-y-3">
            <p className="text-3xl">✓</p>
            <h3 className="text-base font-bold text-[#17251F]">No Recommendations in this Filter</h3>
            <p className="text-xs text-[#66736C]">
              There are no {priorityFilter.toLowerCase()} priority recommendations based on current historical consumption.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredRecs.map((rec) => {
              const isHigh = rec.priority === 'High';
              const isMedium = rec.priority === 'Medium';

              const badgeColor = isHigh
                ? 'bg-[#C45B52]/10 text-[#C45B52] border-[#C45B52]/30'
                : isMedium
                ? 'bg-[#C89B3C]/10 text-[#C89B3C] border-[#C89B3C]/30'
                : 'bg-[#2F7D5A]/10 text-[#2F7D5A] border-[#2F7D5A]/30';

              return (
                <div
                  key={rec.id}
                  className="bg-[#FFFFFF] rounded-2xl border border-[#E3E8E4] shadow-xs p-6 flex flex-col justify-between space-y-4 hover:border-[#2F7D5A]/40 transition-all duration-200"
                >
                  <div className="space-y-3">
                    {/* Header: Item & Priority */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-xs text-[#66736C] font-medium">
                          {rec.category} • {rec.affected_item}
                        </span>
                        <h3 className="text-base font-bold text-[#17251F] mt-0.5">
                          {rec.title}
                        </h3>
                      </div>
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${badgeColor}`}
                      >
                        {rec.priority} Priority
                      </span>
                    </div>

                    {/* Prescriptive Action */}
                    <div className="p-3.5 rounded-xl bg-[#DCEDE4]/60 border border-[#2F7D5A]/25 text-[#17251F] text-xs leading-relaxed">
                      <span className="font-semibold text-[#2F7D5A]">Action Plan: </span>
                      {rec.action}
                    </div>

                    {/* Evidence & Historical Context */}
                    <div className="p-3.5 rounded-xl bg-[#F7F8F4] border border-[#E3E8E4] text-xs text-[#17251F] space-y-1.5">
                      <span className="font-semibold text-[#66736C] block text-[11px] uppercase tracking-wider">
                        Empirical Evidence
                      </span>
                      <p className="leading-relaxed text-[#17251F]">{rec.evidence}</p>
                    </div>
                  </div>

                  {/* Footer metadata */}
                  <div className="pt-3 border-t border-[#E3E8E4] flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="text-[#66736C]">{rec.metric_label}:</span>
                      <span className="font-mono font-semibold text-[#17251F]">
                        {rec.metric_value}
                      </span>
                    </div>

                    {rec.is_ml_derived ? (
                      <span className="text-[#2F7D5A] font-medium flex items-center gap-1">
                        <span>🤖</span> ML Sequence Ready
                      </span>
                    ) : (
                      <span className="text-[#66736C] font-medium">
                        📊 Data-Driven Rule
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
