const raw = import.meta.env.VITE_API_URL;

if (!raw && import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.warn('[config] VITE_API_URL is not set — falling back to http://localhost:5000');
}

// Only public, non-secret configuration may live here.
export const API_URL = String(raw || 'http://localhost:5000').replace(/\/+$/, '');
export const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

/** Backend stores uploads as relative paths like /uploads/reports/abc.pdf */
export function fileHref(fileUrl) {
  if (!fileUrl) return null;
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  return `${API_URL}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`;
}
