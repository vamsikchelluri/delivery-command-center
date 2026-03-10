// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, saveTokens, clearTokens, getAccessToken, getRefreshToken } from '../lib/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user on mount if token exists
  useEffect(() => {
    const token = getAccessToken();
    if (!token) { setLoading(false); return; }
    authApi.me()
      .then(u => setUser(u))
      .catch(() => clearTokens())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authApi.login({ email, password });
    saveTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout({ refreshToken: getRefreshToken() }); } catch {}
    clearTokens();
    setUser(null);
  }, []);

  // Permission helpers
  const can = useCallback((module, level = 'READ') => {
    if (!user) return false;
    const access = user.permissions?.[module] || 'NONE';
    const levels = { NONE: 0, READ: 1, FULL: 2 };
    return levels[access] >= levels[level];
  }, [user]);

  const canSeeField = useCallback((fieldKey) => {
    if (!user) return false;
    return user.fieldPerms?.[fieldKey] ?? false;
  }, [user]);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isCOO        = ['SUPER_ADMIN', 'COO'].includes(user?.role);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can, canSeeField, isSuperAdmin, isCOO }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
