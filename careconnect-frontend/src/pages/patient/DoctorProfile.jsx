import { Link, useParams } from 'react-router-dom';
import { Building2, CalendarPlus, Clock, GraduationCap, IndianRupee, Mail } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import DataState from '../../components/common/DataState';
import StatusBadge from '../../components/ui/StatusBadge';
import { doctorDisplayName } from '../../components/doctors/DoctorCard';
import { useAsync } from '../../hooks/useAsync';
import { getDoctor } from '../../services/doctorService';
import { DAYS } from '../../constants';
import { formatCurrency, formatHHmm, initials } from '../../utils/format';

export default function DoctorProfile() {
  const { id } = useParams();
  const { data: d, loading, error, reload } = useAsync(() => getDoctor(id), [id]);
  const schedule = d ? [...(d.availability || [])].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)) : [];
  const bookable = d && d.status === 'ACTIVE';
  return (
    <div className="stack-lg">
      <DataState loading={loading} error={error} data={d} onRetry={reload}>
        {d && (
          <>
            <PageHeader title={doctorDisplayName(d)} subtitle={d.specialization || d.departmentId?.name}
              actions={bookable ? <Link to={`/patient/appointments/book?doctorId=${d._id}`} className="btn btn-primary"><CalendarPlus size={16} /> Book appointment</Link> : <StatusBadge status={d.status} />} />
            <div className="grid grid-2 align-start">
              <section className="card stack">
                <div className="row gap-sm"><span className="avatar avatar-xl">{initials(d.userId?.name)}</span>
                  <div><h3>{doctorDisplayName(d)}</h3><div className="muted">{d.qualification}</div></div></div>
                {d.bio && <p>{d.bio}</p>}
                <ul className="meta-list">
                  {d.departmentId?.name && <li><Building2 size={15} /> {d.departmentId.name}{d.hospitalId?.name ? ` · ${d.hospitalId.name}` : ''}</li>}
                  {d.qualification && <li><GraduationCap size={15} /> {d.qualification}</li>}
                  <li><Clock size={15} /> {d.experience ?? 0} years experience</li>
                  <li><IndianRupee size={15} /> {formatCurrency(d.consultationFee)} per consultation</li>
                  {d.userId?.email && <li><Mail size={15} /> {d.userId.email}</li>}
                </ul>
              </section>
              <section className="card">
                <h3>Weekly schedule</h3>
                {schedule.length === 0 ? <p className="muted">This doctor has not published a weekly schedule yet.</p> : (
                  <table className="table table-plain"><tbody>
                    {schedule.map((s, i) => <tr key={i}><td><strong>{DAYS[s.dayOfWeek]}</strong></td><td>{formatHHmm(s.startTime)} – {formatHHmm(s.endTime)}</td><td className="muted small">{s.slotDurationMinutes} min slots</td></tr>)}
                  </tbody></table>
                )}
                <p className="muted small">Exact open times are shown when you pick a date while booking.</p>
              </section>
            </div>
          </>
        )}
      </DataState>
    </div>
  );
}
