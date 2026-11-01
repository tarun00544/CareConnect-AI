import { Link } from 'react-router-dom';
import { CalendarDays, Clock, MapPin, Video, MessageSquare, Building } from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';
import { formatDate, formatTimeRange } from '../../utils/format';

const TYPE = { VIDEO: { label: 'Video', icon: Video }, CHAT: { label: 'Chat', icon: MessageSquare }, IN_PERSON: { label: 'In person', icon: Building } };

/**
 * `who` = display name of the counterparty (doctor for patients, patient for doctors); `meta` = extra line.
 * The backend does not include user names on appointment refs, so pages resolve names and pass them in.
 */
export default function AppointmentCard({ appointment: a, who, meta, to, actions, showPayment = true }) {
  const T = TYPE[a.consultationType] || TYPE.VIDEO;
  const TypeIcon = T.icon;
  return (
    <article className="card appt-card">
      <div className="appt-date" aria-hidden="true">
        <span>{formatDate(a.date, { month: 'short', day: undefined, year: undefined })}</span>
        <strong>{new Date(a.date).getUTCDate()}</strong>
      </div>
      <div className="appt-main">
        <div className="appt-head">
          <h3>{to ? <Link to={to}>{who || 'Appointment'}</Link> : who || 'Appointment'}</h3>
          <div className="row gap-xs wrap">
            <StatusBadge status={a.status} size="sm" />
            {showPayment && a.paymentStatus && a.paymentStatus !== 'PAID' && a.status !== 'CANCELLED' && <StatusBadge status={a.paymentStatus} label={`Payment ${a.paymentStatus.toLowerCase()}`} size="sm" />}
          </div>
        </div>
        <ul className="meta-list meta-inline">
          <li><CalendarDays size={14} aria-hidden="true" /> {formatDate(a.date)}</li>
          <li><Clock size={14} aria-hidden="true" /> {formatTimeRange(a.startTime, a.endTime)}</li>
          <li><TypeIcon size={14} aria-hidden="true" /> {T.label}</li>
          {meta && <li><MapPin size={14} aria-hidden="true" /> {meta}</li>}
        </ul>
        {actions && <div className="row gap-sm wrap appt-actions">{actions}</div>}
      </div>
    </article>
  );
}
