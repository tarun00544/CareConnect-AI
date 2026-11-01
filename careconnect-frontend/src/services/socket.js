import { io } from 'socket.io-client';
import { API_URL } from '../utils/env';
import { tokenStorage } from '../utils/tokenStorage';
import { refreshTokens } from './api';

// One shared Socket.IO connection per browser tab.
// Authentication: the backend's io.use() middleware reads `socket.handshake.auth.token` and verifies it with the
// SAME JWT access secret as REST. `auth` is a function so every (re)connect sends the freshest token.
let socket = null;
let refreshing = false;

export function connectSocket() {
  if (socket) return socket;
  socket = io(API_URL, {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    auth: (cb) => cb({ token: tokenStorage.getAccess() }),
  });

  socket.on('connect_error', async (err) => {
    // Token expired between refreshes → refresh once, then let socket.io retry with the new token.
    if (/token|expired|authentication/i.test(err?.message || '') && !refreshing && tokenStorage.getRefresh()) {
      refreshing = true;
      try {
        await refreshTokens();
      } catch {
        /* api layer will force logout on the next REST 401 */
      } finally {
        refreshing = false;
      }
    }
  });

  socket.connect();
  return socket;
}

export const getSocket = () => socket;

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
