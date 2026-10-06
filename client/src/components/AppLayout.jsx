import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { organizationApi } from '../api/axios';

const NAV_ITEMS = [
  { path: '/dashboard',       icon: '📊', label: 'Dashboard' },
  { path: '/food-items',      icon: '🍽️', label: 'Food Items' },
  { path: '/demand',          icon: '📈', label: 'Demand Data' },
  { path: '/analytics',       icon: '📉', label: 'Analytics' },
  { path: '/recommendations', icon: '💡', label: 'Recommendations' },
  { path: '/predictions',     icon: '🤖', label: 'AI Predictions' },
  { path: '/organization',    icon: '🏢', label: 'Organization' },
];

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [org, setOrg] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    organizationApi.getCurrent()
      .then((res) => {
        if (res.data?.organization) {
          setOrg(res.data.organization);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    setMobileMenuOpen(false);
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: 'var(--bg-primary)' }}>
      {/* ── Mobile Top Header (hidden on md and above) ─────────────── */}
      <header
        className="md:hidden sticky top-0 z-40 px-4 py-3 flex items-center justify-between border-b"
        style={{
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-xs"
            style={{ background: 'var(--primary-accent)' }}
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight truncate" style={{ color: 'var(--text-primary)' }}>
              FoodWaste AI
            </p>
            <p className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>
              {org?.name ? org.name : 'AI Intelligence Hub'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          id="btn-mobile-nav-toggle"
          aria-label="Toggle Navigation Menu"
          aria-expanded={mobileMenuOpen}
          className="p-2 rounded-xl text-base flex items-center justify-center border transition-colors"
          style={{
            background: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
          }}
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </header>

      {/* ── Mobile Backdrop Overlay ───────────────────────────── */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar (Off-canvas on mobile, static on desktop) ─── */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 flex-shrink-0 flex flex-col transform transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
        style={{
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-color)',
        }}
      >
        {/* Logo & Close Button Header */}
        <div
          className="p-5 md:p-6 flex items-center justify-between gap-3"
          style={{ borderBottom: '1px solid var(--border-color)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
              style={{ background: 'var(--primary-accent)' }}
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight truncate" style={{ color: 'var(--text-primary)' }}>
                FoodWaste AI
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                {org?.name ? org.name : 'AI Intelligence Hub'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-sm text-[#66736C] hover:text-[#17251F]"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {/* Organization Status Badge */}
        {org && (
          <div className="px-4 py-2 mx-3 mt-3 rounded-xl flex items-center justify-between"
               style={{ background: 'var(--accent-light)', border: '1px solid rgba(47,125,90,0.25)' }}>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--primary-accent)' }}>{org.name}</p>
              <p className="text-[10px] capitalize" style={{ color: 'var(--text-secondary)' }}>{org.organization_type} • {org.role}</p>
            </div>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--primary-accent)' }} />
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'shadow-xs font-semibold text-[#2F7D5A] bg-[#DCEDE4] border border-[#2F7D5A]/25'
                    : 'text-[#66736C] hover:text-[#17251F] hover:bg-[#F7F8F4]'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User panel */}
        <div className="p-4" style={{ borderTop: '1px solid var(--border-color)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 text-white shadow-xs"
              style={{ background: 'var(--primary-dark)' }}
            >
              {user?.name?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {user?.name}
              </p>
              <p className="text-xs truncate capitalize" style={{ color: 'var(--text-secondary)' }}>
                {user?.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            id="btn-logout"
            className="w-full py-2 rounded-xl text-xs font-semibold transition-all duration-150"
            style={{
              background: 'rgba(196,91,82,0.08)',
              border: '1px solid rgba(196,91,82,0.25)',
              color: 'var(--color-danger)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(196,91,82,0.18)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(196,91,82,0.08)';
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content area ─────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
