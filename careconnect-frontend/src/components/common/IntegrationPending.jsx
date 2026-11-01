import { PlugZap } from 'lucide-react';

/**
 * Clearly-marked placeholder for UI that is ready but whose backend endpoint does not exist yet.
 * Never used to fake data — it explains what is missing.
 */
export default function IntegrationPending({ title = 'Integration pending', children, missing }) {
  return (
    <div className="pending-box" role="note">
      <PlugZap size={20} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p className="muted small">{children}</p>
        {missing && <code className="pending-code">{missing}</code>}
      </div>
    </div>
  );
}
