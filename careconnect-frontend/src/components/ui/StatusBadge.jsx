import { statusMeta } from '../../constants/statusMeta';

/** Accessible status pill: colour + text label (never colour alone). */
export default function StatusBadge({ status, label, size = 'md' }) {
  const meta = statusMeta(status);
  return (
    <span className={`badge badge-${meta.tone} ${size === 'sm' ? 'badge-sm' : ''}`}>
      <span className="badge-dot" aria-hidden="true" />
      {label || meta.label}
    </span>
  );
}
