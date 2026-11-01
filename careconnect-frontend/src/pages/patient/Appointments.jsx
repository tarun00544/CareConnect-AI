import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Plus } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Tabs from '../../components/ui/Tabs';
import Pagination from '../../components/ui/Pagination';
import EmptyState from '../../components/ui/EmptyState';
import DataState from '../../components/common/DataState';
import { SkeletonRows } from '../../components/ui/Skeleton';
import AppointmentCard from '../../components/appointments/AppointmentCard';
import { useAsync } from '../../hooks/useAsync';
import { useDoctorDirectory } from '../../hooks/useDoctorDirectory';
import { getMyAppointments } from '../../services/appointmentService';
import { APPOINTMENT_ACTIVE } from '../../constants';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Active' },
  { value: 'done', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function Appointments() {
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState('all');
  const { data, loading, error, reload } = useAsync(() => getMyAppointments({ page, limit: 10 }), [page]);
  const { doctorName, getDoctor } = useDoctorDirectory();
  const match = (a) => tab === 'all' || (tab === 'upcoming' && APPOINTMENT_ACTIVE.includes(a.status)) || (tab === 'done' && a.status === 'COMPLETED') || (tab === 'cancelled' && ['CANCELLED', 'NO_SHOW'].includes(a.status));
  const items = (data?.items || []).filter(match);

  return (
    <div className="stack-lg">
      <PageHeader title="Appointments" subtitle="Your consultations, past and upcoming." actions={<Link to="/patient/appointments/book" className="btn btn-primary"><Plus size={16} /> Book appointment</Link>} />
      <Tabs tabs={FILTERS} value={tab} onChange={setTab} />
      <DataState loading={loading} error={error} data={data} onRetry={reload} skeleton={<SkeletonRows />} isEmpty={() => items.length === 0}
        empty={<EmptyState icon={CalendarDays} title={tab === 'all' ? 'No appointments yet' : 'Nothing in this view'} message="Find a doctor and book your first consultation." action={<Link to="/patient/appointments/book" className="btn btn-primary">Book appointment</Link>} />}>
        <div className="stack">
          {items.map((a) => (
            <AppointmentCard
              key={a._id}
              appointment={a}
              who={doctorName(a.doctorId)}
              meta={a.departmentId?.name || a.doctorId?.departmentId?.name || getDoctor(a.doctorId)?.departmentId?.name || a.doctorId?.specialization}
              to={`/patient/appointments/${a._id}`}
            />
          ))}
        </div>
        <Pagination pagination={data?.pagination} onPage={setPage} />
      </DataState>
    </div>
  );
}
