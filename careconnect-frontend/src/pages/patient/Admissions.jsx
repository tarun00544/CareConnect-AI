import { Link } from 'react-router-dom';
import { HeartPulse, Plus } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import DataState from '../../components/common/DataState';
import AdmissionCard from '../../components/admission/AdmissionCard';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { useAsync } from '../../hooks/useAsync';
import { getMyAdmissions } from '../../services/patientService';

export default function Admissions() {
  const { data, loading, error, reload } = useAsync(() => getMyAdmissions(), []);
  return (
    <div className="stack-lg">
      <PageHeader title="Hospital Admission" subtitle="Request an admission and follow its progress." actions={<Link to="/patient/admission/new" className="btn btn-primary"><Plus size={16} /> New admission request</Link>} />
      <DataState loading={loading} error={error} data={data} onRetry={reload} skeleton={<SkeletonRows />}
        empty={<EmptyState icon={HeartPulse} title="No admission requests" message="If a doctor advises admission, you can submit the request here." action={<Link to="/patient/admission/new" className="btn btn-primary">Start a request</Link>} />}>
        <div className="stack">{(data || []).map((a) => <AdmissionCard key={a._id} admission={a} to={`/patient/admission/${a._id}`} />)}</div>
      </DataState>
    </div>
  );
}
