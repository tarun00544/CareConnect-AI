import { ClipboardList } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import DataState from '../../components/common/DataState';
import PrescriptionCard from '../../components/medical/PrescriptionCard';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { useAsync } from '../../hooks/useAsync';
import { useDoctorDirectory } from '../../hooks/useDoctorDirectory';
import { getMyPrescriptions } from '../../services/patientService';

export default function Prescriptions() {
  const { data, loading, error, reload } = useAsync(() => getMyPrescriptions(), []);
  const { doctorName } = useDoctorDirectory();
  return (
    <div className="stack-lg">
      <PageHeader title="Prescriptions" subtitle="Prescriptions issued by your doctors." />
      <DataState loading={loading} error={error} data={data} onRetry={reload} skeleton={<SkeletonRows />} empty={<EmptyState icon={ClipboardList} title="No prescriptions yet" message="Prescriptions from your consultations will appear here." />}>
        <div className="stack">{(data || []).map((p) => <PrescriptionCard key={p._id} prescription={p} who={`Prescription from ${doctorName(p.doctorId)}`} to={`/patient/prescriptions/${p._id}`} />)}</div>
      </DataState>
    </div>
  );
}
