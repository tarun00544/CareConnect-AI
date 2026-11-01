import { Link } from 'react-router-dom';
import { Building2, Clock, GraduationCap, IndianRupee } from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';
import { formatCurrency, initials } from '../../utils/format';
import { CONSULTATION_TYPES, DAYS } from '../../constants';

export const doctorDisplayName = (d) => {
  const n = d?.userId?.name;
  return n ? `Dr. ${String(n).replace(/^dr\.?\s+/i, '')}` : 'Doctor';
};

export function availabilityDays(d) {
  const set = [...new Set((d?.availability || []).map((a) => a.dayOfWeek))].sort();
  return set.map((i) => DAYS[i]?.slice(0, 3)).filter(Boolean);
}

export default function DoctorCard({ doctor, to, cta = 'View profile & book' }) {
  const days = availabilityDays(doctor);
  return (
    <article className="card doctor-card">
      <div className="doctor-top">
        <span className="avatar avatar-lg">{initials(doctor.userId?.name)}</span>
        <div className="doctor-id">
          <h3>{doctorDisplayName(doctor)}</h3>
          <div className="muted">{doctor.specialization || doctor.departmentId?.name || 'General practice'}</div>
        </div>
        {doctor.status && doctor.status !== 'ACTIVE' && <StatusBadge status={doctor.status} size="sm" />}
      </div>
      <ul className="meta-list">
        {doctor.qualification && <li><GraduationCap size={15} aria-hidden="true" /> {doctor.qualification}</li>}
        {doctor.departmentId?.name && <li><Building2 size={15} aria-hidden="true" /> {doctor.departmentId.name}{doctor.hospitalId?.name ? ` · ${doctor.hospitalId.name}` : ''}</li>}
        {typeof doctor.experience === 'number' && <li><Clock size={15} aria-hidden="true" /> {doctor.experience} yr{doctor.experience === 1 ? '' : 's'} experience</li>}
        <li><IndianRupee size={15} aria-hidden="true" /> {formatCurrency(doctor.consultationFee)} per consultation</li>
      </ul>
      {doctor.consultationModes?.length > 0 && (
        <div className="chips" aria-label="Consultation modes">
          {doctor.consultationModes.map((m) => <span key={m} className="chip chip-soft">{CONSULTATION_TYPES.find((t) => t.value === m)?.label.replace(' consultation', '').replace(' visit', '') || m}</span>)}
          {doctor.verification?.status === 'VERIFIED' && <span className="chip chip-soft">Verified</span>}
        </div>
      )}
      <div className="chips" aria-label="Weekly availability">
        {days.length ? days.map((d) => <span key={d} className="chip">{d}</span>) : <span className="muted small">No weekly schedule published</span>}
      </div>
      <Link to={to} className="btn btn-primary btn-block">{cta}</Link>
    </article>
  );
}
