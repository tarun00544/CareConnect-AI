import { Link } from 'react-router-dom';
import { Building2, HeartPulse } from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';
import { formatDay } from '../../utils/format';

export default function AdmissionCard({ admission: a, to, hospitalName, departmentName }) {
  return (
    <article className="card">
      <div className="row between gap-sm wrap">
        <div className="row gap-sm">
          <span className="round-icon"><HeartPulse size={18} aria-hidden="true" /></span>
          <div>
            <h3>{to ? <Link to={to}>{a.reason}</Link> : a.reason}</h3>
            <div className="muted small">Requested {formatDay(a.createdAt)}</div>
          </div>
        </div>
        <StatusBadge status={a.status} />
      </div>
      {(hospitalName || departmentName) && (
        <div className="meta-list meta-inline" style={{ marginTop: 10 }}>
          <li><Building2 size={14} aria-hidden="true" /> {[departmentName, hospitalName].filter(Boolean).join(' · ')}</li>
        </div>
      )}
    </article>
  );
}
