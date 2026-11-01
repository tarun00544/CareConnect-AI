import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The backend's CLIENT_URL (CORS + Socket.IO origin) defaults to http://localhost:5173,
// so the dev server is pinned to that port.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
});
