const TZ_UTC = { timeZone: 'UTC' };

// Backend stores appointment dates as UTC midnight of a calendar day, so format them in UTC
// to avoid off-by-one-day shifts in other timezones.
export function formatDate(value, opts = {}) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', ...TZ_UTC, ...opts });
}

/** For real instants (createdAt, verifiedAt …) — shown in the viewer's local time. */
export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function formatDay(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatTimeOfDay(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

/** "14:30" → "2:30 PM" */
export function formatHHmm(t) {
  if (!t || !/^\d{2}:\d{2}$/.test(t)) return t || '—';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`;
}

export function formatTimeRange(a, b) {
  return b ? `${formatHHmm(a)} – ${formatHHmm(b)}` : formatHHmm(a);
}

export function formatCurrency(amount, currency = 'INR') {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount));
}

/** Payment.amount is stored in paise. */
export const paiseToRupees = (paise) => (paise === null || paise === undefined ? null : Number(paise) / 100);

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function relativeTime(value) {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  const s = Math.round(diff / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d > 1 ? 's' : ''} ago`;
  return formatDay(value);
}

export function initials(name = '') {
  return (
    String(name)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || '?'
  );
}

/** ISO date (YYYY-MM-DD) in the user's local calendar. */
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** YYYY-MM-DD of a stored (UTC-midnight) date. */
export function toISODate(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function ageFromDob(dob) {
  if (!dob) return null;
  const b = new Date(dob);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getUTCFullYear();
  const m = now.getMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getUTCDate())) age -= 1;
  return age >= 0 && age <= 130 ? age : null;
}

export const titleCase = (s = '') =>
  String(s).replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\w/g, (c) => c.toUpperCase());

export const shortId = (id) => (id ? String(id).slice(-6).toUpperCase() : '—');

/** Appointment slot start as a local Date (stored date is a UTC-midnight calendar day). */
export function appointmentStart(appt) {
  if (!appt || !appt.date || !appt.startTime) return null;
  const [y, mo, d] = toISODate(appt.date).split('-').map(Number);
  const [h, m] = appt.startTime.split(':').map(Number);
  return new Date(y, mo - 1, d, h, m);
}

export const escapeRegex = (s = '') => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const addressLine = (a) => (a ? [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', ') : '');

// Populated refs may arrive as objects or raw ids — these helpers make both safe.
export const refId = (v) => (v && typeof v === 'object' ? v._id || v.id : v);
export const refObj = (v) => (v && typeof v === 'object' ? v : null);
