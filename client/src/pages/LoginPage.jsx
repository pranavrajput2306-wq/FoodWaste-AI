import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSEO } from '../hooks/useSEO';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = location.state?.from?.pathname || '/dashboard';

  useSEO({
    title: 'Sign In — FoodWaste AI',
    description: 'Sign in to your FoodWaste AI workspace to manage food catalog items, monitor consumption trends, and receive AI-driven waste predictions.',
    noindex: false,
  });

  const [formData, setFormData]   = useState({ email: '', password: '' });
  const [errors,   setErrors]     = useState({});
  const [apiError, setApiError]   = useState('');
  const [loading,  setLoading]    = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    if (apiError)     setApiError('');
  };

  const validate = () => {
    const errs = {};
    if (!formData.email.trim())    errs.email    = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errs.email = 'Enter a valid email.';
    if (!formData.password)        errs.password = 'Password is required.';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setLoading(true);
    try {
      await login(formData);
      navigate(from, { replace: true });
    } catch (err) {
      setApiError(err?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
         style={{ background: 'var(--bg-primary)' }}>

      {/* Background orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-30"
             style={{ background: 'radial-gradient(circle, rgba(47,125,90,0.12), transparent)' }} />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-30"
             style={{ background: 'radial-gradient(circle, rgba(200,155,60,0.1), transparent)' }} />
      </div>

      <div className="relative w-full max-w-md fade-in-up">
        {/* Logo / branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-sm"
               style={{ background: 'var(--primary-accent)' }}>
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold gradient-text mb-1">FoodWaste AI</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            AI-Powered Food Waste Prediction & Reduction
          </p>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-6 sm:p-8 shadow-sm">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-[#66736C] hover:text-[#2F7D5A] transition-colors mb-4"
          >
            <span>←</span>
            <span>Back to Home</span>
          </Link>

          <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
            Sign in to your account
          </h2>

          {apiError && (
            <div className="mb-4 p-3 rounded-xl text-sm"
                 style={{ background: 'rgba(196,91,82,0.1)', border: '1px solid rgba(196,91,82,0.3)', color: '#C45B52' }}>
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Email */}
            <div>
              <label className="block text-sm font-medium mb-2"
                     style={{ color: 'var(--text-primary)' }} htmlFor="login-email">
                Email address
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@organization.com"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-150"
                style={{
                  background: '#FFFFFF',
                  border: errors.email ? '1px solid #C45B52' : '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
                onFocus={(e) => !errors.email && (e.target.style.borderColor = '#2F7D5A')}
                onBlur={(e)  => !errors.email && (e.target.style.borderColor = 'var(--border-color)')}
              />
              {errors.email && <p className="mt-1 text-xs" style={{ color: '#C45B52' }}>{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium mb-2"
                     style={{ color: 'var(--text-primary)' }} htmlFor="login-password">
                Password
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-150"
                style={{
                  background: '#FFFFFF',
                  border: errors.password ? '1px solid #C45B52' : '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
                onFocus={(e) => !errors.password && (e.target.style.borderColor = '#2F7D5A')}
                onBlur={(e)  => !errors.password && (e.target.style.borderColor = 'var(--border-color)')}
              />
              {errors.password && <p className="mt-1 text-xs" style={{ color: '#C45B52' }}>{errors.password}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              id="btn-login"
              className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-white transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed shadow-xs"
              style={{ background: 'var(--primary-accent)' }}
              onMouseEnter={(e) => !loading && (e.target.style.background = '#263B32')}
              onMouseLeave={(e) => !loading && (e.target.style.background = 'var(--primary-accent)')}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </span>
              ) : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            Don&apos;t have an account?{' '}
            <Link to="/register"
                  className="font-medium transition-colors duration-150"
                  style={{ color: 'var(--primary-accent)' }}
                  onMouseEnter={(e) => (e.target.style.color = '#263B32')}
                  onMouseLeave={(e) => (e.target.style.color = 'var(--primary-accent)')}>
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
