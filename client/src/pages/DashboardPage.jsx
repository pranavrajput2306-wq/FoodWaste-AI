import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboardApi } from '../api/axios';
import AppLayout from '../components/AppLayout';
import useSEO from '../hooks/useSEO';

export default function DashboardPage() {
  const { user } = useAuth();
  useSEO({ title: 'Dashboard — FoodWaste AI', noindex: true });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await dashboardApi.getStats();
      setData(res.data.data);
    } catch (err) {
      if (err.status === 403) {
        setError('ORGANIZATION_REQUIRED');
      } else {
        setError(err.message || 'Failed to load dashboard metrics.');
      }
    } finally {
      setLoading(false);
    }
  };

  const stats = data?.stats || {
    total_food_items: 0,
    total_prepared: 0,
    total_sold: 0,
    total_wasted: 0,
    waste_rate: 0,
  };

  const insights = data?.insights || {
    current_waste_rate: 0,
    highest_waste_item: null,
    recent_trend: 'insufficient_data',
    top_recommendation: null,
  };

  const statCards = [
    {
      label: 'Food Items Tracked',
      value: stats.total_food_items.toLocaleString(),
      sub: stats.total_food_items === 0 ? 'No items registered' : 'Catalog items',
      icon: '🍽️',
      color: '#17251F',
      bg: '#DCEDE4',
    },
    {
      label: 'Total Prepared',
      value: stats.total_prepared.toLocaleString(),
      sub: 'All logged batches',
      icon: '📦',
      color: '#17251F',
      bg: '#DCEDE4',
    },
    {
      label: 'Total Sold',
      value: stats.total_sold.toLocaleString(),
      sub: 'Successfully served',
      icon: '💰',
      color: '#2F7D5A',
      bg: '#DCEDE4',
    },
    {
      label: 'Total Wasted',
      value: stats.total_wasted.toLocaleString(),
      sub: 'Unsold surplus recorded',
      icon: '🗑️',
      color: '#C45B52',
      bg: 'rgba(196,91,82,0.1)',
    },
    {
      label: 'Overall Waste Rate',
      value: `${stats.waste_rate}%`,
      sub: stats.total_prepared > 0 ? 'Wasted / Prepared' : 'No consumption data',
      icon: '📊',
      color: stats.waste_rate > 20 ? '#C45B52' : stats.waste_rate > 10 ? '#C89B3C' : '#2F7D5A',
      bg: 'rgba(200,155,60,0.1)',
    },
  ];

  return (
    <AppLayout>
      {/* Header */}
      <header
        className="px-4 sm:px-8 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{ borderBottom: '1px solid var(--border-color)' }}
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Welcome, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Real-time demand and waste tracking overview
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <Link
            to="/food-items"
            className="px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold bg-[#2F7D5A] hover:bg-[#263B32] text-white transition-all shadow-xs"
          >
            + Add Food Item
          </Link>
          <Link
            to="/demand"
            className="px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold bg-[#17251F] hover:bg-[#263B32] text-white transition-all shadow-xs"
          >
            + Log Demand Record
          </Link>
        </div>
      </header>

      <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 flex-1 min-w-0">
        {/* Organization Missing Banner */}
        {error === 'ORGANIZATION_REQUIRED' && (
          <div
            className="p-5 sm:p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
            style={{
              background: '#DCEDE4',
              border: '1px solid rgba(47,125,90,0.3)',
            }}
          >
            <div className="flex items-center gap-3.5 sm:gap-4">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl bg-white border border-[#2F7D5A]/30 text-[#2F7D5A] flex-shrink-0">
                🏢
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-[#17251F]">Setup Your Organization</h3>
                <p className="text-xs text-[#66736C] mt-0.5">
                  Link your restaurant, cafeteria, or institutional kitchen to start tracking food items and demand.
                </p>
              </div>
            </div>
            <Link
              to="/organization"
              className="w-full sm:w-auto text-center px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#2F7D5A] hover:bg-[#263B32] text-white shadow-xs transition-all flex-shrink-0"
            >
              Configure Organization →
            </Link>
          </div>
        )}

        {/* Real Database Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="glass rounded-xl p-4 sm:p-5 transition-all duration-200"
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-base sm:text-lg"
                  style={{ background: card.bg }}
                >
                  {card.icon}
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-bold mb-0.5" style={{ color: card.color }}>
                {loading ? '...' : card.value}
              </p>
              <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                {card.label}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {card.sub}
              </p>
            </div>
          ))}
        </div>

        {/* Sustainability Intelligence Snapshot (Phase 2D) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Current Waste Rate & Trend */}
          <div className="glass rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#66736C] font-medium">Current Waste Rate</span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    insights.recent_trend === 'improving'
                      ? 'bg-[#DCEDE4] text-[#2F7D5A] border-[#2F7D5A]/30'
                      : insights.recent_trend === 'worsening'
                      ? 'bg-[#C45B52]/10 text-[#C45B52] border-[#C45B52]/20'
                      : insights.recent_trend === 'stable'
                      ? 'bg-[#F7F8F4] text-[#263B32] border-[#E3E8E4]'
                      : 'bg-[#F7F8F4] text-[#66736C] border-[#E3E8E4]'
                  }`}
                >
                  {insights.recent_trend === 'improving'
                    ? '↘ Improving'
                    : insights.recent_trend === 'worsening'
                    ? '↗ Worsening'
                    : insights.recent_trend === 'stable'
                    ? '→ Stable'
                    : '• Need more data'}
                </span>
              </div>
              <p
                className="text-2xl font-bold mt-2"
                style={{
                  color:
                    insights.current_waste_rate > 20
                      ? '#C45B52'
                      : insights.current_waste_rate > 10
                      ? '#C89B3C'
                      : '#2F7D5A',
                }}
              >
                {loading ? '...' : `${insights.current_waste_rate}%`}
              </p>
            </div>
            <Link
              to="/analytics"
              className="text-xs text-[#2F7D5A] hover:text-[#263B32] transition-colors mt-3 flex items-center gap-1 font-semibold"
            >
              <span>Explore Analytics</span>
              <span>→</span>
            </Link>
          </div>

          {/* Highest-Waste Item */}
          <div className="glass rounded-xl p-5 flex flex-col justify-between">
            <div>
              <span className="text-xs text-[#66736C] font-medium">Highest-Waste Food Item</span>
              {insights.highest_waste_item ? (
                <div className="mt-2">
                  <p className="text-base font-bold text-[#17251F] truncate">
                    {insights.highest_waste_item.name}
                  </p>
                  <p className="text-xs text-[#C45B52] font-mono mt-0.5">
                    {insights.highest_waste_item.total_wasted} {insights.highest_waste_item.unit} lost ({insights.highest_waste_item.waste_rate}%)
                  </p>
                </div>
              ) : (
                <p className="text-sm text-[#66736C] mt-2">No surplus recorded</p>
              )}
            </div>
            <Link
              to="/analytics"
              className="text-xs text-[#2F7D5A] hover:text-[#263B32] transition-colors mt-3 flex items-center gap-1 font-semibold"
            >
              <span>View Breakdown</span>
              <span>→</span>
            </Link>
          </div>

          {/* Top Actionable Recommendation */}
          <div className="glass rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#66736C] font-medium">Top Recommendation</span>
                {insights.top_recommendation && (
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      insights.top_recommendation.priority === 'High'
                        ? 'bg-[#C45B52]/10 text-[#C45B52] border-[#C45B52]/20'
                        : insights.top_recommendation.priority === 'Medium'
                        ? 'bg-[#C89B3C]/10 text-[#C89B3C] border-[#C89B3C]/20'
                        : 'bg-[#DCEDE4] text-[#2F7D5A] border-[#2F7D5A]/20'
                    }`}
                  >
                    {insights.top_recommendation.priority}
                  </span>
                )}
              </div>
              {insights.top_recommendation ? (
                <div className="mt-2">
                  <p className="text-xs font-semibold text-[#17251F] line-clamp-1">
                    {insights.top_recommendation.title}
                  </p>
                  <p className="text-[11px] text-[#66736C] line-clamp-2 mt-0.5">
                    {insights.top_recommendation.action}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[#66736C] mt-2">Log records to generate recommendations</p>
              )}
            </div>
            <Link
              to="/recommendations"
              className="text-xs text-[#2F7D5A] hover:text-[#263B32] transition-colors mt-3 flex items-center gap-1 font-semibold"
            >
              <span>All Recommendations</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        {/* Content Section: Recent Activity & Quick Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Demand Records Table */}
          <div className="lg:col-span-2 glass rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                📋 Recent Consumption Logs
              </h2>
              <Link to="/demand" className="text-xs text-[#2F7D5A] hover:underline font-medium">
                View all logs →
              </Link>
            </div>

            {loading ? (
              <p className="text-sm text-[#66736C] py-6 text-center">Loading real database records...</p>
            ) : data?.recent_records?.length > 0 ? (
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <table className="w-full min-w-[500px] text-left text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                      <th className="pb-3 text-xs font-semibold">Date</th>
                      <th className="pb-3 text-xs font-semibold">Food Item</th>
                      <th className="pb-3 text-xs font-semibold">Prepared</th>
                      <th className="pb-3 text-xs font-semibold">Sold</th>
                      <th className="pb-3 text-xs font-semibold">Wasted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3E8E4]">
                    {data.recent_records.map((rec) => (
                      <tr key={rec.id} className="hover:bg-[#F7F8F4] transition-colors">
                        <td className="py-3 text-[#66736C] font-mono text-xs">{rec.record_date}</td>
                        <td className="py-3 font-medium text-[#17251F]">{rec.food_item_name}</td>
                        <td className="py-3 text-[#17251F] font-mono text-xs">{rec.quantity_prepared} {rec.unit}</td>
                        <td className="py-3 text-[#2F7D5A] font-mono text-xs font-semibold">{rec.quantity_sold} {rec.unit}</td>
                        <td className="py-3 text-[#C45B52] font-mono text-xs font-semibold">{rec.quantity_wasted} {rec.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-[#66736C]">
                <p className="text-2xl mb-2">📊</p>
                <p className="text-sm font-medium text-[#17251F]">No demand records logged yet</p>
                <p className="text-xs text-[#66736C] mt-1">
                  Start logging your daily prepared, sold, and wasted quantities to build the dataset.
                </p>
                <Link
                  to="/demand"
                  className="inline-block mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-[#DCEDE4] text-[#2F7D5A] border border-[#2F7D5A]/30 hover:bg-[#2F7D5A] hover:text-white transition-all"
                >
                  Log First Record
                </Link>
              </div>
            )}
          </div>

          {/* Quick Actions & Status */}
          <div className="glass rounded-xl p-6 flex flex-col justify-between">
            <div>
              <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                ⚡ Quick Operations
              </h2>
              <div className="space-y-3">
                <Link
                  to="/food-items"
                  className="flex items-center justify-between p-3.5 rounded-xl border border-[#E3E8E4] bg-[#F7F8F4] hover:bg-[#DCEDE4]/40 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🍽️</span>
                    <div>
                      <p className="text-sm font-medium text-[#17251F]">Manage Food Items</p>
                      <p className="text-xs text-[#66736C]">Add, edit, or categorize menu items</p>
                    </div>
                  </div>
                  <span className="text-[#66736C]">→</span>
                </Link>

                <Link
                  to="/demand"
                  className="flex items-center justify-between p-3.5 rounded-xl border border-[#E3E8E4] bg-[#F7F8F4] hover:bg-[#DCEDE4]/40 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📈</span>
                    <div>
                      <p className="text-sm font-medium text-[#17251F]">Historical Consumption</p>
                      <p className="text-xs text-[#66736C]">Log and review preparation vs waste</p>
                    </div>
                  </div>
                  <span className="text-[#66736C]">→</span>
                </Link>

                <Link
                  to="/organization"
                  className="flex items-center justify-between p-3.5 rounded-xl border border-[#E3E8E4] bg-[#F7F8F4] hover:bg-[#DCEDE4]/40 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🏢</span>
                    <div>
                      <p className="text-sm font-medium text-[#17251F]">Organization Settings</p>
                      <p className="text-xs text-[#66736C]">Facility profile & team access</p>
                    </div>
                  </div>
                  <span className="text-[#66736C]">→</span>
                </Link>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#E3E8E4] text-xs text-[#66736C] leading-relaxed">
              <p className="font-semibold text-[#17251F] mb-1">Data Quality Guard</p>
              Prepared quantities are strictly verified against consumption and waste records to ensure high data integrity for machine learning.
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
