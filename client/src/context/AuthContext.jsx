import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/axios';

const AuthContext = createContext(null);

/**
 * AuthProvider
 * Manages authentication state across the entire application.
 * Persists token + user to localStorage so state survives page refresh.
 */
export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(() => localStorage.getItem('authToken'));
  const [loading, setLoading] = useState(true); // true until initial auth check finishes

  // ── Restore session on mount ───────────────────────────
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUser  = localStorage.getItem('authUser');

    if (storedToken && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        setToken(storedToken);
      } catch {
        // Corrupted stored data — clear it
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
      }
    }
    setLoading(false);
  }, []);

  // ── Persist helper ─────────────────────────────────────
  const persist = useCallback((token, user) => {
    localStorage.setItem('authToken', token);
    localStorage.setItem('authUser',  JSON.stringify(user));
    setToken(token);
    setUser(user);
  }, []);

  // ── Register ───────────────────────────────────────────
  const register = useCallback(async (formData) => {
    const { data } = await authApi.register(formData);
    persist(data.token, data.user);
    return data;
  }, [persist]);

  // ── Login ──────────────────────────────────────────────
  const login = useCallback(async (credentials) => {
    const { data } = await authApi.login(credentials);
    persist(data.token, data.user);
    return data;
  }, [persist]);

  // ── Logout ─────────────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    setToken(null);
    setUser(null);
  }, []);

  const isAuthenticated = Boolean(token && user);

  const value = {
    user,
    token,
    loading,
    isAuthenticated,
    register,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth — hook to access authentication context.
 * Must be used inside <AuthProvider>.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
