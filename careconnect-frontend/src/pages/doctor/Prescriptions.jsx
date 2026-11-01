import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Plus } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import IntegrationPending from '../../components/common/IntegrationPending';
import PrescriptionCard from '../../components/medical/PrescriptionCard';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useAsync } from '../../hooks/useAsync';
import { getPrescription } from '../../services/prescriptionService';
import { getMyDoctorAppointments } from '../../services/doctorService';
import { STORAGE_KEYS } from '../../constants';
import { localJson } from '../../utils/tokenStorage';
import { patientNameOf } from './Dashboard';
import AppointmentCard from '../../components/appointments/AppointmentCard';

export const rememberPrescription = (id) => {
  const ids = localJson.get(STORAGE_KEYS.MY_PRESCRIPTIONS, []);
  localJson.set(STORAGE_KEYS.MY_PRESCRIPTIONS, [id, ...ids.filter((x) => x !== id)].slice(0, 30));
};

// The backend has POST /prescriptions and GET /prescriptions/:id only — there is NO list endpoint for doctors.
// So this page (a) starts a prescription from a consultation and (b) re-opens prescriptions written from this browser.
export default function DoctorPrescriptions() {
  const [ids] = useState(() => localJson.get(STORAGE_KEYS.MY_PRESCRIPTIONS, []));
  const appts = useAsync(() => getMyDoctorAppointments({ limit: 100 }), []);
  const rx = useAsync(async () => (await Promise.allSettled(ids.map((id) => getPrescription(id)))).filter((r) => r.status === 'fulfilled').map((r) => r.value), []);
  const eligible = (appts.data?.items || []).filter((a) => ['IN_PROGRESS', 'COMPLETED'].includes(a.status)).slice(0, 8);
  const names = Object.fromEntries((appts.data?.items || []).map((a) => [a._id, patientNameOf(a)]));
  return (
    <div className="stack-lg">
      <PageHeader title="Prescriptions" subtitle="Write prescriptions for your consultations." actions={<Link to="/doctor/prescriptions/new" className="btn btn-primary"><Plus size={16} /> New prescription</Link>} />
      <section className="stack">
        <h2 className="section-title">Start from a consultation</h2>
        {appts.loading ? <LoadingSpinner /> : eligible.length === 0 ? <div className="card"><EmptyState compact title="No in-progress or completed consultations" message="Start a consultation first, then write the prescription." /></div> : (
          <div className="stack">{eligible.map((a) => <AppointmentCard key={a._id} appointment={a} who={patientNameOf(a)} showPayment={false} actions={<Link className="btn btn-primary btn-sm" to={`/doctor/prescriptions/new?appointmentId=${a._id}`}>Write prescription</Link>} />)}</div>
        )}
      </section>
      <section className="stack">
        <h2 className="section-title">Written from this browser</h2>
        {rx.loading ? <LoadingSpinner /> : (rx.data || []).length === 0 ? <div className="card"><EmptyState compact icon={ClipboardList} title="Nothing here yet" /></div> :
          rx.data.map((p) => <PrescriptionCard key={p._id} prescription={p} who={`For ${names[p.appointmentId?._id || p.appointmentId] || 'patient'}`} to={`/doctor/prescriptions/${p._id}`} />)}
        <IntegrationPending title="Prescription history pending backend endpoint" missing="GET /api/prescriptions (list) — not implemented">Only prescriptions created in this browser are listed. Older ones can't be retrieved until the backend adds a list endpoint.</IntegrationPending>
      </section>
    </div>
  );
}
