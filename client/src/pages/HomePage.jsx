import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSEO } from '../hooks/useSEO';

const CURRENT_YEAR = new Date().getFullYear();

export default function HomePage() {
  const { isAuthenticated, user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useSEO({
    title: 'FoodWaste AI — AI-Driven Food Demand Forecasting & Waste Prevention',
    description: 'Harness real machine learning models to forecast daily food consumption, detect batch waste risk before cooking begins, and receive deterministic batch adjustment guidance.',
    noindex: false,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Respect user's motion preferences
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const elements = document.querySelectorAll('.reveal-on-scroll');

    if (prefersReduced || !('IntersectionObserver' in window)) {
      elements.forEach((el) => el.classList.add('is-revealed'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8F4] text-[#17251F] selection:bg-[#2F7D5A] selection:text-white">
      {/* ── Top Navigation ────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-[#E3E8E4] bg-[#FFFFFF]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 sm:gap-3 group">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-[#2F7D5A] shadow-xs group-hover:scale-105 transition-transform flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <span className="font-bold text-sm sm:text-base tracking-tight text-[#17251F] flex items-center gap-1.5 sm:gap-2">
                FoodWaste AI
                <span className="text-[9px] sm:text-[10px] font-semibold tracking-wider uppercase px-1.5 sm:px-2 py-0.5 rounded-full bg-[#DCEDE4] border border-[#2F7D5A]/30 text-[#2F7D5A]">
                  Enterprise ML
                </span>
              </span>
              <p className="text-[10px] sm:text-[11px] text-[#66736C]">Predictive Sustainability Engine</p>
            </div>
          </Link>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-8 text-xs font-medium text-[#66736C]">
            <a href="#capabilities" className="hover:text-[#2F7D5A] transition-colors">Capabilities</a>
            <a href="#how-it-works" className="hover:text-[#2F7D5A] transition-colors">How It Works</a>
            <a href="#sdg12" className="hover:text-[#2F7D5A] transition-colors">SDG 12 Impact</a>
            <a href="#use-cases" className="hover:text-[#2F7D5A] transition-colors">Use Cases</a>
            <a href="#benefits" className="hover:text-[#2F7D5A] transition-colors">Benefits</a>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2 sm:gap-3">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold bg-[#17251F] hover:bg-[#263B32] text-white shadow-xs transition-all flex items-center gap-2"
              >
                <span>Dashboard ({user?.name?.split(' ')[0]})</span>
                <span>→</span>
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold text-[#17251F] hover:bg-[#F7F8F4] bg-white border border-[#E3E8E4] transition-all"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold bg-[#2F7D5A] hover:bg-[#263B32] text-white shadow-xs transition-all"
                >
                  Get Started
                </Link>
              </>
            )}

            {/* Mobile menu hamburger button */}
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle Navigation Menu"
              aria-expanded={mobileMenuOpen}
              className="md:hidden p-2 rounded-xl text-sm border border-[#E3E8E4] bg-[#F7F8F4] text-[#17251F]"
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#E3E8E4] bg-white px-4 py-4 space-y-3 shadow-lg">
            <div className="flex flex-col space-y-2 text-xs font-medium text-[#17251F]">
              <a
                href="#capabilities"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg hover:bg-[#F7F8F4] text-[#17251F]"
              >
                Capabilities
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg hover:bg-[#F7F8F4] text-[#17251F]"
              >
                How It Works
              </a>
              <a
                href="#sdg12"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg hover:bg-[#F7F8F4] text-[#17251F]"
              >
                SDG 12 Impact
              </a>
              <a
                href="#use-cases"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg hover:bg-[#F7F8F4] text-[#17251F]"
              >
                Use Cases
              </a>
              <a
                href="#benefits"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg hover:bg-[#F7F8F4] text-[#17251F]"
              >
                Benefits
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero Section ──────────────────────────────────────── */}
      <section className="relative pt-12 sm:pt-20 pb-16 sm:pb-28 px-4 sm:px-6 overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[320px] bg-[#DCEDE4]/50 blur-[130px] rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-full bg-[#DCEDE4] border border-[#2F7D5A]/30 text-[#2F7D5A] text-xs font-semibold tracking-wide">
            <span className="w-2 h-2 rounded-full bg-[#2F7D5A] animate-pulse" />
            <span>AI-Driven Food Demand Forecasting & Waste Prevention</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.15] text-[#17251F]">
            Predict Kitchen Demand. <br />
            <span className="gradient-text">Eliminate Food Waste.</span>
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-[#66736C] leading-relaxed font-normal">
            Harness real machine learning models to forecast daily food consumption, detect batch waste risk before cooking begins, and receive deterministic batch adjustment guidance tailored to your culinary operations.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              to="/register"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl text-sm font-semibold bg-[#2F7D5A] hover:bg-[#263B32] text-white shadow-md shadow-[#2F7D5A]/20 transition-all flex items-center justify-center gap-2"
            >
              <span>Start Free Trial</span>
              <span>→</span>
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl text-sm font-semibold text-[#17251F] hover:bg-[#F7F8F4] bg-white border border-[#E3E8E4] transition-all flex items-center justify-center"
            >
              Sign In to Workspace
            </Link>
          </div>

          {/* Hero Architecture Graphic */}
          <div className="pt-8 sm:pt-12">
            <div className="feature-card-hover bg-white rounded-2xl p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto shadow-md border border-[#E3E8E4] text-left space-y-5 sm:space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 sm:pb-5 border-b border-[#E3E8E4] gap-2.5 sm:gap-3">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#C45B52]" />
                  <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#C89B3C]" />
                  <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#2F7D5A]" />
                  <span className="text-xs font-mono text-[#66736C] ml-1 sm:ml-2">foodwaste-ai.live/dashboard</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-mono">
                  <span className="px-2 py-0.5 rounded bg-[#DCEDE4] border border-[#2F7D5A]/25 text-[#2F7D5A]">
                    Model: Time-Aware Regressor
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#F7F8F4] border border-[#E3E8E4] text-[#263B32]">
                    Target Leakage Guard: Active
                  </span>
                </div>
              </div>

              {/* Sample Operational Preview Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="p-3.5 sm:p-4 rounded-xl bg-[#F7F8F4] border border-[#E3E8E4] hover:border-[#2F7D5A]/40 transition-colors">
                  <p className="text-[11px] text-[#66736C] uppercase font-semibold">Predicted Demand</p>
                  <p className="text-xl sm:text-2xl font-bold text-[#2F7D5A] mt-1">74.4 Portions</p>
                  <p className="text-[11px] text-[#66736C] mt-1">LinearRegression (R²: 0.965)</p>
                </div>
                <div className="p-3.5 sm:p-4 rounded-xl bg-[#F7F8F4] border border-[#E3E8E4] hover:border-[#C89B3C]/40 transition-colors">
                  <p className="text-[11px] text-[#66736C] uppercase font-semibold">Waste Risk Level</p>
                  <p className="text-xl sm:text-2xl font-bold text-[#C89B3C] mt-1">Medium Risk</p>
                  <p className="text-[11px] text-[#66736C] mt-1">Logistic Classifier (Acc: 100%)</p>
                </div>
                <div className="p-3.5 sm:p-4 rounded-xl bg-[#F7F8F4] border border-[#E3E8E4] hover:border-[#2F7D5A]/40 transition-colors">
                  <p className="text-[11px] text-[#66736C] uppercase font-semibold">Prescriptive Action</p>
                  <p className="text-sm font-semibold text-[#17251F] mt-1">Align Prep Volume</p>
                  <p className="text-[11px] text-[#66736C] mt-1">Prevents ~12.5% projected surplus</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Capabilities Section ──────────────────────────────── */}
      <section id="capabilities" className="py-14 sm:py-20 px-4 sm:px-6 border-t border-[#E3E8E4] bg-white">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="reveal-on-scroll text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-xs font-bold text-[#2F7D5A] uppercase tracking-widest">Core Capabilities</h2>
            <p className="text-2xl sm:text-3xl font-bold text-[#17251F]">Engineered for Culinary Accuracy</p>
            <p className="text-xs sm:text-sm text-[#66736C]">
              Transforming raw historical consumption into reliable forecasting and automated sustainability intelligence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="reveal-on-scroll stagger-1 feature-card-hover group bg-white border border-[#E3E8E4] hover:border-[#2F7D5A]/50 rounded-2xl p-6 space-y-3.5 shadow-xs cursor-default">
              <div className="w-10 h-10 rounded-xl bg-[#DCEDE4] border border-[#2F7D5A]/20 flex items-center justify-center text-lg group-hover:bg-[#2F7D5A] group-hover:text-white group-hover:scale-105 transition-all duration-300">
                📈
              </div>
              <h3 className="text-base font-bold text-[#17251F] group-hover:text-[#2F7D5A] transition-colors duration-200">AI Demand Forecasting</h3>
              <p className="text-xs text-[#66736C] leading-relaxed">
                Supervised regression models trained on genuine chronological records with rolling window statistics and calendar lag features to predict exact consumption.
              </p>
            </div>

            <div className="reveal-on-scroll stagger-2 feature-card-hover group bg-white border border-[#E3E8E4] hover:border-[#2F7D5A]/50 rounded-2xl p-6 space-y-3.5 shadow-xs cursor-default">
              <div className="w-10 h-10 rounded-xl bg-[#DCEDE4] border border-[#2F7D5A]/20 flex items-center justify-center text-lg group-hover:bg-[#2F7D5A] group-hover:text-white group-hover:scale-105 transition-all duration-300">
                ⚠️
              </div>
              <h3 className="text-base font-bold text-[#17251F] group-hover:text-[#2F7D5A] transition-colors duration-200">Waste Risk Detection</h3>
              <p className="text-xs text-[#66736C] leading-relaxed">
                Evaluates planned batch quantities against consumption momentum to classify risk as Low, Medium, or High before kitchen staff begin meal preparation.
              </p>
            </div>

            <div className="reveal-on-scroll stagger-3 feature-card-hover group bg-white border border-[#E3E8E4] hover:border-[#2F7D5A]/50 rounded-2xl p-6 space-y-3.5 shadow-xs cursor-default">
              <div className="w-10 h-10 rounded-xl bg-[#DCEDE4] border border-[#2F7D5A]/20 flex items-center justify-center text-lg group-hover:bg-[#2F7D5A] group-hover:text-white group-hover:scale-105 transition-all duration-300">
                📉
              </div>
              <h3 className="text-base font-bold text-[#17251F] group-hover:text-[#2F7D5A] transition-colors duration-200">Sustainability Analytics</h3>
              <p className="text-xs text-[#66736C] leading-relaxed">
                Real-time operational dashboards showing prepared vs. sold vs. wasted volume disposition, daily waste trends, and item-level sustainability performance.
              </p>
            </div>

            <div className="reveal-on-scroll stagger-4 feature-card-hover group bg-white border border-[#E3E8E4] hover:border-[#2F7D5A]/50 rounded-2xl p-6 space-y-3.5 shadow-xs cursor-default">
              <div className="w-10 h-10 rounded-xl bg-[#DCEDE4] border border-[#2F7D5A]/20 flex items-center justify-center text-lg group-hover:bg-[#2F7D5A] group-hover:text-white group-hover:scale-105 transition-all duration-300">
                💡
              </div>
              <h3 className="text-base font-bold text-[#17251F] group-hover:text-[#2F7D5A] transition-colors duration-200">Actionable Guidance</h3>
              <p className="text-xs text-[#66736C] leading-relaxed">
                Deterministic, empirical recommendation engine providing prioritized batch reductions, prep scaling, and portion adjustments based on proven metrics.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────── */}
      <section id="how-it-works" className="py-14 sm:py-20 px-4 sm:px-6 border-t border-[#E3E8E4] bg-[#F7F8F4]">
        <div className="max-w-6xl mx-auto space-y-14">
          <div className="reveal-on-scroll text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-xs font-bold text-[#2F7D5A] uppercase tracking-widest">End-to-End Pipeline</h2>
            <p className="text-2xl sm:text-3xl font-bold text-[#17251F]">How FoodWaste AI Operates</p>
            <p className="text-xs sm:text-sm text-[#66736C]">
              A transparent, leakage-free machine learning architecture designed specifically for food service realities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
            <div className="reveal-on-scroll stagger-1 feature-card-hover group p-5 rounded-2xl bg-white border border-[#E3E8E4] hover:border-[#2F7D5A]/50 shadow-xs space-y-2 cursor-default">
              <span className="text-xs font-mono font-bold text-[#2F7D5A] group-hover:scale-110 transition-transform duration-200 inline-block">01</span>
              <h3 className="text-sm font-bold text-[#17251F] group-hover:text-[#2F7D5A] transition-colors duration-200">Demand Logging</h3>
              <p className="text-xs text-[#66736C] leading-relaxed">
                Kitchens record daily prepared, sold, and wasted quantities with pure calendar-date integrity.
              </p>
            </div>

            <div className="reveal-on-scroll stagger-2 feature-card-hover group p-5 rounded-2xl bg-white border border-[#E3E8E4] hover:border-[#2F7D5A]/50 shadow-xs space-y-2 cursor-default">
              <span className="text-xs font-mono font-bold text-[#2F7D5A] group-hover:scale-110 transition-transform duration-200 inline-block">02</span>
              <h3 className="text-sm font-bold text-[#17251F] group-hover:text-[#2F7D5A] transition-colors duration-200">Feature Engineering</h3>
              <p className="text-xs text-[#66736C] leading-relaxed">
                Transforms historical series with 1-, 3-, and 7-day lags and shifted rolling window metrics without future leakage.
              </p>
            </div>

            <div className="reveal-on-scroll stagger-3 feature-card-hover group p-5 rounded-2xl bg-white border border-[#E3E8E4] hover:border-[#2F7D5A]/50 shadow-xs space-y-2 cursor-default">
              <span className="text-xs font-mono font-bold text-[#2F7D5A] group-hover:scale-110 transition-transform duration-200 inline-block">03</span>
              <h3 className="text-sm font-bold text-[#17251F] group-hover:text-[#2F7D5A] transition-colors duration-200">Model Evaluation</h3>
              <p className="text-xs text-[#66736C] leading-relaxed">
                FastAPI microservice evaluates Linear, Random Forest, and Gradient Boosting pipelines on time-aware splits.
              </p>
            </div>

            <div className="reveal-on-scroll stagger-4 feature-card-hover group p-5 rounded-2xl bg-white border border-[#E3E8E4] hover:border-[#C89B3C]/50 shadow-xs space-y-2 cursor-default">
              <span className="text-xs font-mono font-bold text-[#C89B3C] group-hover:scale-110 transition-transform duration-200 inline-block">04</span>
              <h3 className="text-sm font-bold text-[#17251F] group-hover:text-[#C89B3C] transition-colors duration-200">Risk Detection</h3>
              <p className="text-xs text-[#66736C] leading-relaxed">
                Flags potential surplus batches before cooking begins with multi-class risk classification.
              </p>
            </div>

            <div className="reveal-on-scroll stagger-5 feature-card-hover group p-5 rounded-2xl bg-white border border-[#E3E8E4] hover:border-[#C45B52]/50 shadow-xs space-y-2 cursor-default">
              <span className="text-xs font-mono font-bold text-[#C45B52] group-hover:scale-110 transition-transform duration-200 inline-block">05</span>
              <h3 className="text-sm font-bold text-[#17251F] group-hover:text-[#C45B52] transition-colors duration-200">Prescriptive Action</h3>
              <p className="text-xs text-[#66736C] leading-relaxed">
                Translates predictive scores into exact batch size reductions and procurement corrections.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SDG 12 Responsible Consumption ────────────────────── */}
      <section id="sdg12" className="py-14 sm:py-20 px-4 sm:px-6 border-t border-[#E3E8E4] bg-white">
        <div className="reveal-on-scroll feature-card-hover group max-w-5xl mx-auto rounded-3xl p-5 sm:p-8 md:p-12 border border-[#E3E8E4] hover:border-[#2F7D5A]/40 bg-[#F7F8F4] flex flex-col md:flex-row items-center gap-6 sm:gap-8 shadow-xs cursor-default">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#263B32] group-hover:bg-[#17251F] group-hover:scale-105 transition-all duration-300 flex items-center justify-center text-3xl sm:text-4xl shadow-md flex-shrink-0 text-white">
            <span role="img" aria-label="Earth globe icon">🌍</span>
          </div>
          <div className="space-y-3 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <span className="text-xs font-bold text-[#2F7D5A] tracking-wider uppercase">United Nations SDG 12.3</span>
              <span className="text-[10px] text-[#263B32] px-2 py-0.5 rounded-full bg-[#DCEDE4] border border-[#2F7D5A]/25">
                Responsible Consumption & Production
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#17251F] group-hover:text-[#2F7D5A] transition-colors duration-200">Committed to Halving Commercial Food Waste</h2>
            <p className="text-xs sm:text-sm text-[#66736C] leading-relaxed">
              Target 12.3 calls on organizations to halve global food waste by 2030 and reduce food losses along supply chains. FoodWaste AI delivers the verifiable, audit-ready operational infrastructure required for hospitality and institutional kitchens to fulfill this mandate.
            </p>
          </div>
        </div>
      </section>

      {/* ── Use Cases ─────────────────────────────────────────── */}
      <section id="use-cases" className="py-14 sm:py-20 px-4 sm:px-6 border-t border-[#E3E8E4] bg-[#F7F8F4]">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="reveal-on-scroll text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-xs font-bold text-[#C89B3C] uppercase tracking-widest">Designed for Scale</h2>
            <p className="text-2xl sm:text-3xl font-bold text-[#17251F]">Who Benefits from FoodWaste AI</p>
            <p className="text-xs sm:text-sm text-[#66736C]">
              Built to integrate seamlessly into diverse high-volume food service workflows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="reveal-on-scroll stagger-1 feature-card-hover group bg-white rounded-2xl p-6 sm:p-7 space-y-3 border border-[#E3E8E4] hover:border-[#2F7D5A]/50 shadow-xs cursor-default">
              <div className="text-2xl group-hover:scale-110 transition-transform duration-300 inline-block">🍽️</div>
              <h3 className="text-base font-bold text-[#17251F] group-hover:text-[#2F7D5A] transition-colors duration-200">Restaurants & Bistros</h3>
              <p className="text-xs text-[#66736C] leading-relaxed">
                Protect tight operating margins by eliminating end-of-day kitchen surplus and adjusting prep quantities based on day-of-week demand trends.
              </p>
            </div>

            <div className="reveal-on-scroll stagger-2 feature-card-hover group bg-white rounded-2xl p-6 sm:p-7 space-y-3 border border-[#E3E8E4] hover:border-[#2F7D5A]/50 shadow-xs cursor-default">
              <div className="text-2xl group-hover:scale-110 transition-transform duration-300 inline-block">🏢</div>
              <h3 className="text-base font-bold text-[#17251F] group-hover:text-[#2F7D5A] transition-colors duration-200">Corporate & Campus Cafeterias</h3>
              <p className="text-xs text-[#66736C] leading-relaxed">
                Calibrate bulk preparation for fluctuating staff headcount, hybrid work schedules, and seasonal academic attendance.
              </p>
            </div>

            <div className="reveal-on-scroll stagger-3 feature-card-hover group bg-white rounded-2xl p-6 sm:p-7 space-y-3 border border-[#E3E8E4] hover:border-[#2F7D5A]/50 shadow-xs cursor-default">
              <div className="text-2xl group-hover:scale-110 transition-transform duration-300 inline-block">🏥</div>
              <h3 className="text-base font-bold text-[#17251F] group-hover:text-[#2F7D5A] transition-colors duration-200">Institutional Canteens & Healthcare</h3>
              <p className="text-xs text-[#66736C] leading-relaxed">
                Maintain nutritional consistency and compliance while managing high-volume meal trays with predictable daily consumption baselines.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Benefits Section ──────────────────────────────────── */}
      <section id="benefits" className="py-14 sm:py-20 px-4 sm:px-6 border-t border-[#E3E8E4] bg-white">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="reveal-on-scroll text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-xs font-bold text-[#2F7D5A] uppercase tracking-widest">Proven Impact</h2>
            <p className="text-2xl sm:text-3xl font-bold text-[#17251F]">Tangible Operational Value</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <div className="reveal-on-scroll stagger-1 feature-card-hover group p-5 sm:p-6 rounded-2xl bg-[#F7F8F4] hover:bg-white border border-[#E3E8E4] hover:border-[#2F7D5A]/50 space-y-2 shadow-xs cursor-default">
              <span role="img" aria-label="Cost savings" className="text-xl group-hover:scale-110 transition-transform duration-300 inline-block">💰</span>
              <h3 className="text-sm font-bold text-[#17251F] group-hover:text-[#2F7D5A] transition-colors duration-200">Cost Reduction</h3>
              <p className="text-xs text-[#66736C] leading-relaxed">
                Directly lowers raw procurement expenses by preventing unconsumed over-preparation.
              </p>
            </div>

            <div className="reveal-on-scroll stagger-2 feature-card-hover group p-5 sm:p-6 rounded-2xl bg-[#F7F8F4] hover:bg-white border border-[#E3E8E4] hover:border-[#2F7D5A]/50 space-y-2 shadow-xs cursor-default">
              <span role="img" aria-label="Carbon abatement" className="text-xl group-hover:scale-110 transition-transform duration-300 inline-block">🌱</span>
              <h3 className="text-sm font-bold text-[#17251F] group-hover:text-[#2F7D5A] transition-colors duration-200">Carbon Abatement</h3>
              <p className="text-xs text-[#66736C] leading-relaxed">
                Averts upstream agricultural resources and downstream landfill methane emissions.
              </p>
            </div>

            <div className="reveal-on-scroll stagger-3 feature-card-hover group p-5 sm:p-6 rounded-2xl bg-[#F7F8F4] hover:bg-white border border-[#E3E8E4] hover:border-[#2F7D5A]/50 space-y-2 shadow-xs cursor-default">
              <span role="img" aria-label="Tenant isolation security" className="text-xl group-hover:scale-110 transition-transform duration-300 inline-block">🔒</span>
              <h3 className="text-sm font-bold text-[#17251F] group-hover:text-[#2F7D5A] transition-colors duration-200">Multi-Tenant Isolation</h3>
              <p className="text-xs text-[#66736C] leading-relaxed">
                Enterprise security guarantees zero cross-organization data leakage with verified scoping.
              </p>
            </div>

            <div className="reveal-on-scroll stagger-4 feature-card-hover group p-5 sm:p-6 rounded-2xl bg-[#F7F8F4] hover:bg-white border border-[#E3E8E4] hover:border-[#2F7D5A]/50 space-y-2 shadow-xs cursor-default">
              <span role="img" aria-label="Target accuracy" className="text-xl group-hover:scale-110 transition-transform duration-300 inline-block">🎯</span>
              <h3 className="text-sm font-bold text-[#17251F] group-hover:text-[#2F7D5A] transition-colors duration-200">Zero Guesswork</h3>
              <p className="text-xs text-[#66736C] leading-relaxed">
                Substitutes subjective intuition with verifiable mathematical predictions and empirical rules.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final Call to Action ──────────────────────────────── */}
      <section className="reveal-on-scroll py-14 sm:py-20 px-4 sm:px-6 border-t border-[#17251F] bg-[#17251F] text-center relative overflow-hidden">
        <div className="max-w-3xl mx-auto space-y-6 relative z-10">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Ready to Build a Zero-Waste Kitchen?
          </h2>
          <p className="text-xs sm:text-sm text-[#DCEDE4]/80 max-w-xl mx-auto leading-relaxed">
            Join culinary managers using data-driven demand forecasting to save money, streamline inventory, and meet sustainability goals.
          </p>
          <div className="pt-2">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-6 sm:px-8 py-3.5 rounded-xl text-sm font-semibold bg-[#2F7D5A] hover:bg-[#263B32] text-white shadow-md border border-[#2F7D5A] transition-all"
            >
              <span>Create Your Organization Account</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Compact & Refined Footer ──────────────────────────── */}
      <footer className="py-6 sm:py-7 px-4 sm:px-6 border-t border-[#263B32]/70 bg-[#17251F] text-xs text-[#DCEDE4]/70">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-md bg-[#2F7D5A] flex items-center justify-center text-white text-[10px] font-bold">
              FW
            </div>
            <span className="font-semibold text-white">FoodWaste AI</span>
            <span className="text-[#DCEDE4]/40">•</span>
            <span className="text-[11px] sm:text-xs text-[#DCEDE4]/70">AI-Powered Food Waste Prediction & Reduction System</span>
          </div>

          <div className="flex items-center gap-5 text-[11px] sm:text-xs">
            <Link to="/login" className="hover:text-white transition-colors">Sign In</Link>
            <Link to="/register" className="hover:text-white transition-colors">Register</Link>
            <a href="#sdg12" className="hover:text-white transition-colors">SDG 12.3</a>
          </div>

          <div className="text-[11px] sm:text-xs text-[#DCEDE4]/50">
            <span>© {CURRENT_YEAR} FoodWaste AI. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

