import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Bot } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Tabs from '../../components/ui/Tabs';
import EmptyState from '../../components/ui/EmptyState';
import DataState from '../../components/common/DataState';
import AppointmentCard from '../../components/appointments/AppointmentCard';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { useAsync } from '../../hooks/useAsync';
import { getMyDoctorAppointments } from '../../services/doctorService';
import { patientNameOf } from './Dashboard';

// A consultation is the IN_PROGRESS → COMPLETED phase of an appointment (no separate list endpoint exists).
export default function DoctorConsultations() {
  const [tab, setTab] = useState('IN_PROGRESS');
  const { data, loading, error, reload } = useAsync(() => getMyDoctorAppointments({ limit: 100 }), []);
  const items = (data?.items || []).filter((a) => (tab === 'READY' ? ['CONFIRMED', 'RESCHEDULED'].includes(a.status) : a.status === tab));
  return (
    <div className="stack-lg">
      <PageHeader
        title="Consultations"
        subtitle="Run consultations, write notes, coordinate follow-ups, and review continuity."
        action={
          <Link to="/doctor/ai-copilot" className="btn btn-primary btn-sm row gap-xs">
            <Bot size={16} /> <span>Launch AI Copilot</span>
          </Link>
        }
      />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'IN_PROGRESS', label: 'In progress' }, { value: 'READY', label: 'Ready to start' }, { value: 'COMPLETED', label: 'Completed' }]} />
      <DataState loading={loading} error={error} data={data} onRetry={reload} skeleton={<SkeletonRows />} isEmpty={() => items.length === 0} empty={<EmptyState icon={Activity} title="No consultations here" />}>
        <div className="stack">{items.map((a) => <AppointmentCard key={a._id} appointment={a} who={patientNameOf(a)} to={`/doctor/consultations/${a._id}`} showPayment={false} />)}</div>
      </DataState>
    </div>
  );
}
