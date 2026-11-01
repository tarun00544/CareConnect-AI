import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Tabs from '../../components/ui/Tabs';
import Pagination from '../../components/ui/Pagination';
import EmptyState from '../../components/ui/EmptyState';
import DataState from '../../components/common/DataState';
import AppointmentCard from '../../components/appointments/AppointmentCard';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { useAsync } from '../../hooks/useAsync';
import { getMyDoctorAppointments } from '../../services/doctorService';
import { updateAppointmentStatus } from '../../services/appointmentService';
import { useToast } from '../../context/AppContext';
import { patientNameOf } from './Dashboard';
import { APPOINTMENT_ACTIVE } from '../../constants';

const TABS = [{ value: 'all', label: 'All' }, { value: 'pending', label: 'Pending' }, { value: 'active', label: 'Active' }, { value: 'done', label: 'Completed' }, { value: 'other', label: 'Cancelled / no-show' }];
const match = (tab, a) => tab === 'all' || (tab === 'pending' && a.status === 'PENDING') || (tab === 'active' && APPOINTMENT_ACTIVE.includes(a.status)) || (tab === 'done' && a.status === 'COMPLETED') || (tab === 'other' && ['CANCELLED', 'NO_SHOW'].includes(a.status));

export default function DoctorAppointments() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const { data, loading, error, reload } = useAsync(() => getMyDoctorAppointments({ page, limit: 10 }), [page]);
  const items = (data?.items || []).filter((a) => match(tab, a));

  const setStatus = async (a, status) => {
    setBusyId(a._id);
    try { await updateAppointmentStatus(a._id, status); toast.success(`Appointment ${status.toLowerCase().replace('_', ' ')}`); reload(); }
    catch (e) { toast.error(e.message); } finally { setBusyId(null); }
  };

  return (
    <div className="stack-lg">
      <PageHeader title="Appointments" subtitle="Manage your consultations." />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <DataState loading={loading} error={error} data={data} onRetry={reload} skeleton={<SkeletonRows />} isEmpty={() => items.length === 0} empty={<EmptyState icon={CalendarDays} title="No appointments in this view" />}>
        <div className="stack">
          {items.map((a) => (
            <AppointmentCard key={a._id} appointment={a} who={patientNameOf(a)} to={`/doctor/appointments/${a._id}`}
              actions={a.status === 'PENDING' ? (
                <>
                  <button className="btn btn-primary btn-sm" disabled={busyId === a._id} onClick={() => setStatus(a, 'CONFIRMED')}>Accept</button>
                  <button className="btn btn-danger-outline btn-sm" disabled={busyId === a._id} onClick={() => setStatus(a, 'CANCELLED')}>Decline</button>
                </>
              ) : undefined} />
          ))}
        </div>
        <Pagination pagination={data?.pagination} onPage={setPage} />
      </DataState>
    </div>
  );
}
