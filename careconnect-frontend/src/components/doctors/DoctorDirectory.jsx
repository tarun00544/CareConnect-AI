import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Stethoscope } from 'lucide-react';
import DoctorCard, { doctorDisplayName } from './DoctorCard';
import SearchBar from '../ui/SearchBar';
import FilterPanel from '../ui/FilterPanel';
import Pagination from '../ui/Pagination';
import EmptyState from '../ui/EmptyState';
import DataState from '../common/DataState';
import { SkeletonCards } from '../ui/Skeleton';
import { useAsync } from '../../hooks/useAsync';
import { useDebounce } from '../../hooks/useDebounce';
import { listDoctors } from '../../services/doctorService';
import { listDepartments } from '../../services/departmentService';

const PAGE_SIZE = 9;

/**
 * Doctor discovery used by both the public site and the patient area.
 * Backend supports server-side filters departmentId / hospitalId / specialization only; there is no name search
 * endpoint, so free-text search runs client-side over the (up to 100) doctors returned by the filtered query.
 */
export default function DoctorDirectory({ profileBase }) {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounce(q, 250);
  const departmentId = params.get('departmentId') || '';
  const hospitalId = params.get('hospitalId') || '';

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
    setPage(1);
  };

  const depts = useAsync(() => listDepartments(), []);
  const docs = useAsync(() => listDoctors({ departmentId, hospitalId, limit: 100 }), [departmentId, hospitalId]);

  const hospitals = useMemo(() => {
    const m = new Map();
    (depts.data || []).forEach((d) => { if (d.hospitalId?._id) m.set(d.hospitalId._id, d.hospitalId.name); });
    return [...m].map(([value, label]) => ({ value, label }));
  }, [depts.data]);

  const filtered = useMemo(() => {
    const items = docs.data?.items || [];
    const s = dq.trim().toLowerCase();
    if (!s) return items;
    return items.filter((d) =>
      [doctorDisplayName(d), d.specialization, d.qualification, d.departmentId?.name, d.hospitalId?.name].filter(Boolean).join(' ').toLowerCase().includes(s)
    );
  }, [docs.data, dq]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageItems = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="stack">
      <div className="toolbar">
        <SearchBar value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search by name, specialization or hospital" label="Search doctors" />
      </div>
      <FilterPanel
        filters={[
          { key: 'department', label: 'Departments', value: departmentId, onChange: (v) => setFilter('departmentId', v), options: (depts.data || []).map((d) => ({ value: d._id, label: d.hospitalId?.name ? `${d.name} — ${d.hospitalId.name}` : d.name })) },
          { key: 'hospital', label: 'Hospitals', value: hospitalId, onChange: (v) => setFilter('hospitalId', v), options: hospitals },
        ]}
        onReset={departmentId || hospitalId || q ? () => { setParams({}, { replace: true }); setQ(''); setPage(1); } : undefined}
      />
      <DataState
        loading={docs.loading}
        error={docs.error}
        data={docs.data}
        isEmpty={() => filtered.length === 0}
        onRetry={docs.reload}
        skeleton={<SkeletonCards count={6} height={150} />}
        empty={<EmptyState icon={Stethoscope} title="No doctors match your search" message="Try removing a filter or searching with different words." />}
      >
        <div className="grid grid-cards">
          {pageItems.map((d) => <DoctorCard key={d._id} doctor={d} to={`${profileBase}/${d._id}`} />)}
        </div>
        <Pagination pagination={{ page: current, totalPages, total: filtered.length, limit: PAGE_SIZE }} onPage={setPage} />
        {docs.data?.pagination?.total > 100 && <p className="muted small">Showing the first 100 doctors for these filters — narrow by department or hospital to see others.</p>}
      </DataState>
    </div>
  );
}
