import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useSEO from '../hooks/useSEO';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  useSEO({
    title: 'Create an Account — FoodWaste AI',
    description: 'Join FoodWaste AI to start forecasting kitchen demand, reducing commercial food waste, and optimizing inventory with machine learning.',
  });

  const [formData, setFormData] = useState({
    name: '', email: '', password: '', confirmPassword: '',
  });
  const [errors,   setErrors]   = useState({});
  const [apiError, setApiError] = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    if (apiError)     setApiError('');
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim())   errs.name = 'Full name is required.';
    else if (formData.name.trim().length < 2) errs.name = 'Name must be at least 2 characters.';

    if (!formData.email.trim())  errs.email = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errs.email = 'Enter a valid email.';

    if (!formData.password)      errs.password = 'Password is required.';
    else if (formData.password.length < 8) errs.password = 'Minimum 8 characters.';
    else if (!/[A-Z]/.test(formData.password)) errs.password = 'Must contain an uppercase letter.';
    else if (!/[0-9]/.test(formData.password)) errs.password = 'Must contain a number.';

    if (!formData.confirmPassword) errs.confirmPassword = 'Please confirm your password.';
    else if (formData.password !== formData.confirmPassword)
      errs.confirmPassword = 'Passwords do not match.';

    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setLoading(true);
    try {
      await register({
        name:     formData.name.trim(),
        email:    formData.email.trim(),
        password: formData.password,
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setApiError(err?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStrength = (pw) => {
    let s = 0;
    if (pw.length >= 8)         s++;
    if (/[A-Z]/.test(pw))       s++;
    if (/[0-9]/.test(pw))       s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  };
  const strength = getStrength(formData.password);
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['', '#C45B52', '#C89B3C', '#C89B3C', '#2F7D5A'];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
         style={{ background: 'var(--bg-primary)' }}>

      {/* Background orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full opacity-30"
             style={{ background: 'radial-gradient(circle, rgba(47,125,90,0.12), transparent)' }} />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full opacity-30"
             style={{ background: 'radial-gradient(circle, rgba(200,155,60,0.1), transparent)' }} />
      </div>

      <div className="relative w-full max-w-md fade-in-up">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-sm"
               style={{ background: 'var(--primary-accent)' }}>
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold gradient-text mb-1">FoodWaste AI</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Start reducing food waste with AI insights
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
            Create your account
          </h2>

          {apiError && (
            <div className="mb-4 p-3 rounded-xl text-sm"
                 style={{ background: 'rgba(196,91,82,0.1)', border: '1px solid rgba(196,91,82,0.3)', color: '#C45B52' }}>
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Full name */}
            <Field id="reg-name" label="Full name" error={errors.name}>
              <input
                id="reg-name" name="name" type="text" autoComplete="name"
                value={formData.name} onChange={handleChange}
                placeholder="Jane Smith"
                {...inputStyle(errors.name)}
              />
            </Field>

            {/* Email */}
            <Field id="reg-email" label="Work email" error={errors.email}>
              <input
                id="reg-email" name="email" type="email" autoComplete="email"
                value={formData.email} onChange={handleChange}
                placeholder="you@organization.com"
                {...inputStyle(errors.email)}
              />
            </Field>

            {/* Password */}
            <Field id="reg-password" label="Password" error={errors.password}>
              <input
                id="reg-password" name="password" type="password" autoComplete="new-password"
                value={formData.password} onChange={handleChange}
                placeholder="Min 8 chars, uppercase & number"
                {...inputStyle(errors.password)}
              />
              {formData.password && (
                <div className="mt-2">
                  <div className="flex gap-1 h-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex-1 rounded-full transition-all duration-300"
                           style={{ background: i <= strength ? strengthColors[strength] : '#E3E8E4' }} />
                    ))}
                  </div>
                  <p className="text-xs mt-1" style={{ color: strengthColors[strength] }}>
                    {strengthLabels[strength]}
                  </p>
                </div>
              )}
            </Field>

            {/* Confirm password */}
            <Field id="reg-confirm" label="Confirm password" error={errors.confirmPassword}>
              <input
                id="reg-confirm" name="confirmPassword" type="password" autoComplete="new-password"
                value={formData.confirmPassword} onChange={handleChange}
                placeholder="••••••••"
                {...inputStyle(errors.confirmPassword)}
              />
            </Field>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              id="btn-register"
              className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-white transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed mt-2 shadow-xs"
              style={{ background: 'var(--primary-accent)' }}
              onMouseEnter={(e) => !loading && (e.target.style.background = '#263B32')}
              onMouseLeave={(e) => !loading && (e.target.style.background = 'var(--primary-accent)')}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Creating account…
                </span>
              ) : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            Already have an account?{' '}
            <Link to="/login" className="font-medium transition-colors duration-150"
                  style={{ color: 'var(--primary-accent)' }}
                  onMouseEnter={(e) => (e.target.style.color = '#263B32')}
                  onMouseLeave={(e) => (e.target.style.color = 'var(--primary-accent)')}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function Field({ id, label, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5"
             style={{ color: 'var(--text-primary)' }} htmlFor={id}>
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs" style={{ color: '#C45B52' }}>{error}</p>}
    </div>
  );
}

function inputStyle(error) {
  return {
    className: 'w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-150',
    style: {
      background: '#FFFFFF',
      border: error ? '1px solid #C45B52' : '1px solid var(--border-color)',
      color: 'var(--text-primary)',
    },
    onFocus: (e) => !error && (e.target.style.borderColor = '#2F7D5A'),
    onBlur:  (e) => !error && (e.target.style.borderColor = 'var(--border-color)'),
  };
}
