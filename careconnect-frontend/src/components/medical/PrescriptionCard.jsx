import { Link } from 'react-router-dom';
import { ClipboardList, Pill } from 'lucide-react';
import { formatDay } from '../../utils/format';

export default function PrescriptionCard({ prescription: p, who, to }) {
  const meds = p.medicines || [];
  return (
    <article className="card rx-card">
      <div className="row between gap-sm">
        <div className="row gap-sm">
          <span className="round-icon"><ClipboardList size={18} aria-hidden="true" /></span>
          <div>
            <h3>{to ? <Link to={to}>{who || 'Prescription'}</Link> : who || 'Prescription'}</h3>
            <div className="muted small">Issued {formatDay(p.createdAt)}</div>
          </div>
        </div>
        <span className="chip">{meds.length} medicine{meds.length === 1 ? '' : 's'}</span>
      </div>
      <ul className="med-lines">
        {meds.slice(0, 3).map((m, i) => (
          <li key={`${m.name}-${i}`}><Pill size={14} aria-hidden="true" /> <strong>{m.name}</strong> <span className="muted">{m.dosage} · {m.frequency} · {m.durationDays} day{m.durationDays === 1 ? '' : 's'}</span></li>
        ))}
        {meds.length > 3 && <li className="muted small">+{meds.length - 3} more</li>}
      </ul>
    </article>
  );
}
