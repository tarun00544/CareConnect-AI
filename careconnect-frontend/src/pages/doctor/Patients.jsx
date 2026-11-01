import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import SearchBar from '../../components/ui/SearchBar';
import EmptyState from '../../components/ui/EmptyState';
import DataState from '../../components/common/DataState';
import DataTable from '../../components/common/DataTable';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { useAsync } from '../../hooks/useAsync';
import { getMyPatients } from '../../services/doctorService';
import { ageFromDob, titleCase } from '../../utils/format';

export default function DoctorPatients() {
  const { data, loading, error, reload } = useAsync(() => getMyPatients(), []);
  const [q, setQ] = useState('');
  const items = useMemo(() => (data || []).filter((p) => `${p.userId?.name} ${p.userId?.email}`.toLowerCase().includes(q.trim().toLowerCase())), [data, q]);
  return (
    <div className="stack-lg">
      <PageHeader title="Patients" subtitle="Patients you have an appointment relationship with." />
      <SearchBar value={q} onChange={setQ} placeholder="Search by name or email" label="Search patients" />
      <DataState loading={loading} error={error} data={data} onRetry={reload} skeleton={<SkeletonRows />} isEmpty={() => items.length === 0} empty={<EmptyState icon={Users} title={q ? 'No matching patients' : 'No patients yet'} message="Patients appear here after they book with you." />}>
        <DataTable caption="Patients" rows={items} columns={[
          { key: 'name', header: 'Name', render: (p) => <Link to={`/doctor/patients/${p._id}`}><strong>{p.userId?.name || 'Patient'}</strong></Link> },
          { key: 'age', header: 'Age', render: (p) => ageFromDob(p.dateOfBirth) ?? '—' },
          { key: 'gender', header: 'Gender', render: (p) => (p.gender ? titleCase(p.gender) : '—') },
          { key: 'contact', header: 'Contact', render: (p) => p.userId?.phone || p.userId?.email || '—' },
          {
            key: 'actions',
            header: 'Actions',
            render: (p) => (
              <div className="row gap-xs">
                <Link to={`/doctor/patients/${p._id}`} className="btn btn-sm btn-primary">
                  Clinical Dossier
                </Link>
                <Link to="/doctor/patient-navigation" className="btn btn-sm btn-ghost">
                  Navigation
                </Link>
              </div>
            ),
          },
        ]} />
      </DataState>
    </div>
  );
}
