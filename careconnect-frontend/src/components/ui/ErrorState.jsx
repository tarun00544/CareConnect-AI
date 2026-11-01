import { AlertTriangle, RefreshCw, ShieldAlert, WifiOff } from 'lucide-react';
import { getDetailMessages } from '../../utils/response';

/** Turns a normalised ApiClientError into a friendly panel with Retry. */
export default function ErrorState({ error, onRetry, title, compact = false }) {
  const status = error?.status;
  const Icon = error?.isNetwork ? WifiOff : status === 403 || status === 401 ? ShieldAlert : AlertTriangle;
  const heading =
    title ||
    (error?.isNetwork ? 'Connection problem'
      : status === 403 ? 'Access denied'
      : status === 404 ? 'Not found'
      : status === 429 ? 'Slow down a little'
      : status >= 500 ? 'Server error'
      : 'Something went wrong');
  const details = getDetailMessages(error);
  return (
    <div className={`state-box state-error ${compact ? 'state-compact' : ''}`} role="alert">
      <div className="state-icon"><Icon size={26} aria-hidden="true" /></div>
      <h3>{heading}</h3>
      <p className="muted">{error?.message || 'An unexpected error occurred.'}</p>
      {details.length > 0 && (
        <ul className="detail-list">
          {details.slice(0, 5).map((d) => <li key={d}>{d}</li>)}
        </ul>
      )}
      {onRetry && status !== 403 && (
        <div className="state-action">
          <button type="button" className="btn btn-secondary" onClick={onRetry}>
            <RefreshCw size={16} /> Try again
          </button>
        </div>
      )}
    </div>
  );
}
