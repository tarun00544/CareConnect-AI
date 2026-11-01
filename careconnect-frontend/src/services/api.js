import axios from 'axios';
import { API_URL } from '../utils/env';
import { tokenStorage } from '../utils/tokenStorage';
import { normalizeError } from '../utils/response';

// ------------------------------------------------------------------
// Central Axios instance. All REST traffic goes through here — UI
// components never call axios directly; they use the service modules.
// ------------------------------------------------------------------
export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { Accept: 'application/json' },
});

/** Raised on window so AuthContext can clear state without a circular import. */
export const AUTH_LOGOUT_EVENT = 'careconnect:auth-logout';
export const AUTH_TOKENS_EVENT = 'careconnect:tokens-refreshed';

// Auth endpoints must never trigger the refresh-and-retry flow.
const NO_REFRESH = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh'];

api.interceptors.request.use((config) => {
  const token = tokenStorage.getAccess();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Single-flight refresh: concurrent 401s share one /auth/refresh call.
// The backend rotates the refresh token on every call, so parallel refreshes would invalidate each other.
let refreshPromise = null;

async function refreshTokens() {
  const refreshToken = tokenStorage.getRefresh();
  if (!refreshToken) throw new Error('No refresh token');
  if (!refreshPromise) {
    // Bare axios (not `api`) so this call bypasses our own interceptors.
    refreshPromise = axios
      .post(`${API_URL}/api/auth/refresh`, { refreshToken }, { timeout: 15000 })
      .then((res) => {
        const tokens = res.data?.data;
        if (!tokens?.accessToken) throw new Error('Malformed refresh response');
        tokenStorage.setTokens(tokens);
        window.dispatchEvent(new CustomEvent(AUTH_TOKENS_EVENT, { detail: tokens }));
        return tokens.accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export function forceLogout(reason) {
  tokenStorage.clear();
  window.dispatchEvent(new CustomEvent(AUTH_LOGOUT_EVENT, { detail: { reason } }));
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const url = original?.url || '';

    if (status === 401 && original && !original._retried && !NO_REFRESH.some((p) => url.startsWith(p))) {
      original._retried = true;
      // A stale access token is the usual cause; try a refresh once and replay the request.
      if (tokenStorage.getRefresh()) {
        try {
          const newAccess = await refreshTokens();
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${newAccess}`;
          return api(original);
        } catch {
          forceLogout('session-expired');
        }
      } else if (tokenStorage.getAccess()) {
        forceLogout('session-expired');
      }
    }

    // 403 / network / 429 / 5xx are surfaced to the caller as a normalised ApiClientError.
    return Promise.reject(normalizeError(error));
  }
);

export { refreshTokens };
export default api;
