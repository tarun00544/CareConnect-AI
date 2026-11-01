import { Inbox } from 'lucide-react';

export default function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', message, action, compact = false }) {
  return (
    <div className={`state-box ${compact ? 'state-compact' : ''}`}>
      <div className="state-icon"><Icon size={26} aria-hidden="true" /></div>
      <h3>{title}</h3>
      {message && <p className="muted">{message}</p>}
      {action && <div className="state-action">{action}</div>}
    </div>
  );
}
