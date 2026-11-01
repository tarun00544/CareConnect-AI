import { Link, useParams } from 'react-router-dom';
import { Pill, Printer, Clock } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import DataState from '../../components/common/DataState';
import { useAsync } from '../../hooks/useAsync';
import { useDoctorDirectory } from '../../hooks/useDoctorDirectory';
import { useAuth } from '../../context/AuthContext';
import { getPrescription } from '../../services/prescriptionService';
import { formatDay, refId } from '../../utils/format';
import { doctorDisplayName } from '../../components/doctors/DoctorCard';
import { ROLES } from '../../constants';

/** GET /api/prescriptions/:id — doctorId/patientId/appointmentId are populated documents (no user names). */
export default function PrescriptionDetail() {
  const { id } = useParams();
  const { role } = useAuth();
  const isPatient = role === ROLES.PATIENT;
  const { data: p, loading, error, reload } = useAsync(() => getPrescription(id), [id]);
  const { getDoctor } = useDoctorDirectory();
  const doc = p ? getDoctor(p.doctorId) : null;
  return (
    <div className="stack-lg">
      <DataState loading={loading} error={error} data={p} onRetry={reload}>
        {p && (
          <>
            <PageHeader title="Prescription" subtitle={`Issued ${formatDay(p.createdAt)}${doc ? ` by ${doctorDisplayName(doc)}` : ''}`}
              actions={<button className="btn btn-secondary" onClick={() => window.print()}><Printer size={16} /> Print</button>} />
            <section className="card receipt stack">
              <table className="table"><thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Notes</th></tr></thead>
                <tbody>{(p.medicines || []).map((m, i) => (
                  <tr key={i}><td data-label="Medicine"><strong><Pill size={14} /> {m.name}</strong></td><td data-label="Dosage">{m.dosage}</td><td data-label="Frequency">{m.frequency}</td><td data-label="Duration">{m.durationDays} day{m.durationDays === 1 ? '' : 's'}</td><td data-label="Notes">{m.notes || '—'}</td></tr>
                ))}</tbody></table>
              {p.instructions && <div><h4>Instructions</h4><p style={{ whiteSpace: 'pre-wrap' }}>{p.instructions}</p></div>}
              {p.notes && <div><h4>Doctor's notes</h4><p style={{ whiteSpace: 'pre-wrap' }}>{p.notes}</p></div>}
              <p className="muted small">Take medicines only as directed by your doctor.</p>
            </section>
            <div className="row gap-sm wrap">
              {isPatient && <Link to="/patient/pharmacy" className="btn btn-primary">Order medicines</Link>}
              {isPatient && <Link to="/patient/reminders" className="btn btn-secondary"><Clock size={16} /> View Reminders</Link>}
              {refId(p.appointmentId) && <Link to={`${isPatient ? '/patient' : '/doctor'}/appointments/${refId(p.appointmentId)}`} className="btn btn-secondary">View appointment</Link>}
            </div>
          </>
        )}
      </DataState>
    </div>
  );
}
