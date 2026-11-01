import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Video } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import DataState from '../../components/common/DataState';
import AppointmentCard from '../../components/appointments/AppointmentCard';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { useAsync } from '../../hooks/useAsync';
import { useDoctorDirectory } from '../../hooks/useDoctorDirectory';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/AppContext';
import { getMyAppointments } from '../../services/appointmentService';
import { getMyDoctorAppointments } from '../../services/doctorService';
import { createVideoSession } from '../../services/videoService';
import { ROLES } from '../../constants';

export default function VideoList() {
  const { role } = useAuth();
  const isDoctor = role === ROLES.DOCTOR;
  const base = isDoctor ? '/doctor' : '/patient';
  const navigate = useNavigate();
  const toast = useToast();
  const [busyId, setBusyId] = useState(null);
  const { doctorName } = useDoctorDirectory();
  const { data, loading, error, reload } = useAsync(async () => (isDoctor ? getMyDoctorAppointments({ limit: 100 }) : getMyAppointments({ limit: 100 })), [isDoctor]);

  // Video consultations that are still actionable. Patients also need payment to be complete.
  const items = (data?.items || []).filter((a) => a.consultationType === 'VIDEO' && ['CONFIRMED', 'IN_PROGRESS', 'RESCHEDULED', 'PENDING'].includes(a.status));

  const join = async (a) => {
    setBusyId(a._id);
    try { const s = await createVideoSession(a._id); navigate(`${base}/video/${s.id}`, { state: { appointmentId: a._id } }); }
    catch (e) { toast.error(e.message); setBusyId(null); }
  };

  const who = (a) => (isDoctor ? a.patientId?.userId?.name || 'Patient' : doctorName(a.doctorId));

  return (
    <div className="stack-lg">
      <PageHeader title="Video Consultation" subtitle="Rooms for your booked video appointments." />
      <DataState loading={loading} error={error} data={data} onRetry={reload} skeleton={<SkeletonRows />} isEmpty={() => items.length === 0}
        empty={<EmptyState icon={Video} title="No video appointments" message="Book an appointment with the “Video” type to see it here." />}>
        <div className="stack">
          {items.map((a) => (
            <AppointmentCard key={a._id} appointment={a} who={who(a)} to={`${base}/appointments/${a._id}`}
              actions={<button className="btn btn-primary btn-sm" disabled={busyId === a._id || (!isDoctor && a.paymentStatus !== 'PAID')} onClick={() => join(a)} title={!isDoctor && a.paymentStatus !== 'PAID' ? 'Complete payment first' : undefined}><Video size={15} /> {busyId === a._id ? 'Opening…' : 'Open room'}</button>} />
          ))}
        </div>
      </DataState>
    </div>
  );
}
