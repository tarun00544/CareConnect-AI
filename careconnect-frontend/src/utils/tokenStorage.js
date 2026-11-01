import { STORAGE_KEYS } from '../constants';

// The backend returns JWTs in the JSON body (no cookies), so they must be persisted client-side.
// Access token lives 15m by default; refresh token 7d (rotated on every refresh).
const safe = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

export const tokenStorage = {
  getAccess: () => safe.get(STORAGE_KEYS.ACCESS),
  getRefresh: () => safe.get(STORAGE_KEYS.REFRESH),
  setTokens({ accessToken, refreshToken }) {
    if (accessToken) safe.set(STORAGE_KEYS.ACCESS, accessToken);
    if (refreshToken) safe.set(STORAGE_KEYS.REFRESH, refreshToken);
  },
  getUser() {
    const raw = safe.get(STORAGE_KEYS.USER);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },
  setUser: (u) => safe.set(STORAGE_KEYS.USER, JSON.stringify(u)),
  clear() {
    safe.del(STORAGE_KEYS.ACCESS);
    safe.del(STORAGE_KEYS.REFRESH);
    safe.del(STORAGE_KEYS.USER);
  },
};

export const localJson = {
  get(key, fallback) {
    const raw = safe.get(key);
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  },
  set: (key, value) => safe.set(key, JSON.stringify(value)),
  remove: (key) => safe.del(key),
  getRaw: (key) => safe.get(key),
  setRaw: (key, v) => safe.set(key, v),
};
