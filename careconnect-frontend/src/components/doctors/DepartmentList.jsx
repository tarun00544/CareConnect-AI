import { Building2 } from 'lucide-react';
import DepartmentCard from './DepartmentCard';
import DataState from '../common/DataState';
import EmptyState from '../ui/EmptyState';
import { SkeletonCards } from '../ui/Skeleton';
import { useAsync } from '../../hooks/useAsync';
import { listDepartments } from '../../services/departmentService';

export default function DepartmentList({ doctorsBase }) {
  const { data, error, loading, reload } = useAsync(() => listDepartments(), []);
  return (
    <DataState loading={loading} error={error} data={data} onRetry={reload} skeleton={<SkeletonCards count={6} height={70} />}
      empty={<EmptyState icon={Building2} title="No departments available" message="Departments will appear here once a hospital publishes them." />}>
      <div className="grid grid-cards">
        {(data || []).map((d) => <DepartmentCard key={d._id} department={d} doctorsTo={`${doctorsBase}?departmentId=${d._id}`} />)}
      </div>
    </DataState>
  );
}
