import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ label = 'Loading…', size = 22, inline = false }) {
  return (
    <div className={inline ? 'spinner-inline' : 'spinner-block'} role="status" aria-live="polite">
      <Loader2 size={size} className="spin" aria-hidden="true" />
      <span className={inline ? '' : 'muted'}>{label}</span>
    </div>
  );
}
