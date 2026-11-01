import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as authService from '../services/authService';
import { AUTH_LOGOUT_EVENT } from '../services/api';
import { disconnectSocket } from '../services/socket';
import { tokenStorage } from '../utils/tokenStorage';
import { ROLE_HOME } from '../constants';

const AuthContext = createContext(null);

// status: 'loading' (restoring session) | 'authenticated' | 'unauthenticated'
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');
  const mounted = useRef(true);

  const clearSession = useCallback(() => {
    tokenStorage.clear();
    disconnectSocket();
    if (mounted.current) {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  // Session restoration: if tokens exist, ask the backend who we are. The axios layer transparently
  // refreshes an expired access token using the stored refresh token.
  useEffect(() => {
    mounted.current = true;
    (async () => {
      if (!tokenStorage.getAccess() && !tokenStorage.getRefresh()) {
        setStatus('unauthenticated');
        return;
      }
      try {
        const me = await authService.getMe();
        if (!mounted.current) return;
        tokenStorage.setUser(me);
        setUser(me);
        setStatus('authenticated');
      } catch (err) {
        // A network failure should not log the user out; only auth failures do.
        if (err?.isNetwork && tokenStorage.getUser()) {
          setUser(tokenStorage.getUser());
          setStatus('authenticated');
        } else {
          clearSession();
        }
      }
    })();
    return () => {
      mounted.current = false;
    };
  }, [clearSession]);

  // api.js raises this when a refresh fails or a 401 cannot be recovered.
  useEffect(() => {
    const onForcedLogout = () => clearSession();
    window.addEventListener(AUTH_LOGOUT_EVENT, onForcedLogout);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, onForcedLogout);
  }, [clearSession]);

  const applyAuthResult = useCallback((result) => {
    tokenStorage.setTokens(result);
    tokenStorage.setUser(result.user);
    setUser(result.user);
    setStatus('authenticated');
    return result.user;
  }, []);

  const login = useCallback(async (credentials) => applyAuthResult(await authService.login(credentials)), [applyAuthResult]);
  const register = useCallback(async (payload) => applyAuthResult(await authService.register(payload)), [applyAuthResult]);

  const logout = useCallback(async () => {
    try {
      await authService.logout(); // revokes refresh tokens server-side
    } catch {
      /* even if the call fails (offline / expired), clear locally */
    }
    clearSession();
  }, [clearSession]);

  const refreshUser = useCallback(async () => {
    const me = await authService.getMe();
    tokenStorage.setUser(me);
    setUser(me);
    return me;
  }, []);

  const value = useMemo(
    () => ({
      user,
      role: user?.role || null,
      status,
      isAuthenticated: status === 'authenticated',
      isLoading: status === 'loading',
      homePath: user ? ROLE_HOME[user.role] || '/' : '/login',
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, status, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
