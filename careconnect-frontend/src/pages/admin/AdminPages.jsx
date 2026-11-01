import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Bed, CalendarDays, HeartPulse, IndianRupee, Lock, Plus, Siren, Stethoscope, Users } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import StatusBadge from '../../components/ui/StatusBadge';
import Pagination from '../../components/ui/Pagination';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import Tabs from '../../components/ui/Tabs';
import DataState from '../../components/common/DataState';
import DataTable from '../../components/common/DataTable';
import FormError from '../../components/common/FormError';
import { SkeletonRows } from '../../components/ui/Skeleton';
import RoomBedGrid from '../../components/admin/RoomBedGrid';
import { doctorDisplayName } from '../../components/doctors/DoctorCard';
import SearchBar from '../../components/ui/SearchBar';
import DoctorFormModal from '../../components/admin/DoctorFormModal';
import DoctorDetailModal from '../../components/admin/DoctorDetailModal';
import { UserDetailModal, UserEditModal, UserDeleteDialog } from '../../components/admin/UserModals';
import { useAsync } from '../../hooks/useAsync';
import { useDebounce } from '../../hooks/useDebounce';
import { getDoctorOptions } from '../../services/doctorService';
import { useDoctorDirectory } from '../../hooks/useDoctorDirectory';
import { useAuth } from '../../context/AuthContext';
import { useConfirm, useToast } from '../../context/AppContext';
import * as admin from '../../services/adminService';
import { updateAppointmentStatus } from '../../services/appointmentService';
import { allocateBed, releaseBed, updateBedStatus } from '../../services/bedService';
import { updateAdmissionStatus } from '../../services/admissionService';
import { updateEmergencyStatus } from '../../services/emergencyService';
import { ADMISSION_STATUS, APPOINTMENT_STATUS_SETTABLE, BED_STATUS, EMERGENCY_STATUS, ROLES, ROLE_LABEL } from '../../constants';
import { formatCurrency, formatDate, formatDateTime, formatTimeRange, paiseToRupees, refId, shortId, titleCase } from '../../utils/format';

const scopeNote = (role) => (role === ROLES.HOSPITAL_ADMIN ? 'Showing data for your hospital.' : 'Showing data across all hospitals.');

/** Inline status <select> used by several tables. */
function StatusSelect({ value, options, onChange, disabled, label }) {
  return (
    <select className="select select-sm" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      {options.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}
    </select>
  );
}

function Restricted({ what }) {
  return (
    <div className="card"><EmptyState icon={Lock} title="Restricted to Super Admins" message={`The backend only allows SUPER_ADMIN accounts to view ${what}. Hospital admins are not permitted.`} action={<Link className="btn btn-primary" to="/hospital-admin/dashboard">Back to dashboard</Link>} /></div>
  );
}

/* ------------------------------------------------------------------ Dashboard */
export function AdminDashboard() {
  const { role } = useAuth();
  const { data, loading, error, reload } = useAsync(() => admin.getDashboard(), []);
  const base = role === ROLES.SUPER_ADMIN ? '/super-admin' : '/hospital-admin';
  const occ = data?.bedOccupancy;
  return (
    <div className="stack-lg">
      <PageHeader title={`${ROLE_LABEL[role]} dashboard`} subtitle={scopeNote(role)} />
      <DataState loading={loading} error={error} data={data} onRetry={reload} skeleton={<SkeletonRows />}>
        {data && (
          <>
            <div className="grid grid-stats">
              <StatCard label="Patients" value={data.totalPatients} icon={Users} />
              <StatCard label="Doctors" value={data.totalDoctors} icon={Stethoscope} tone="blue" />
              <StatCard label="Appointments" value={data.totalAppointments} icon={CalendarDays} />
              <StatCard label="Admissions" value={data.totalAdmissions} icon={HeartPulse} tone="blue" />
              <StatCard label="Bed occupancy" value={`${Math.round((occ?.rate || 0) * 100)}%`} icon={Bed} tone="amber" hint={`${occ?.occupied}/${occ?.total} beds`} />
              <StatCard label="Emergency cases" value={data.emergencyCases} icon={Siren} tone="red" />
              <StatCard label="Revenue" value={formatCurrency(paiseToRupees(data.totalRevenuePaise))} icon={IndianRupee} hint="All verified payments" />
            </div>
            <div className="grid grid-actions">
              {[['appointments', 'Appointments', CalendarDays], ['admissions', 'Admissions', HeartPulse], ['beds', 'Beds', Bed], ['emergency', 'Emergency', Siren], ['analytics', 'Analytics', Activity]].map(([p, l, I]) => (
                <Link key={p} to={`${base}/${p}`} className={`action-tile ${p === 'emergency' ? 'action-danger' : ''}`}><I size={22} /><span>{l}</span></Link>
              ))}
            </div>
            {role === ROLES.HOSPITAL_ADMIN && <p className="muted small">Patient and revenue totals are platform-wide figures returned by the backend; other counts are limited to your hospital.</p>}
          </>
        )}
      </DataState>
    </div>
  );
}

/* ------------------------------------------------------------------ Analytics */
export function AdminAnalytics() {
  const { role } = useAuth();
  const { data, loading, error, reload } = useAsync(() => admin.getAnalytics(), []);
  const bars = data ? [['Patients', data.totalPatients], ['Doctors', data.totalDoctors], ['Appointments', data.totalAppointments], ['Admissions', data.totalAdmissions], ['Emergency', data.emergencyCases], ['Medicine orders', data.medicineOrders]] : [];
  const max = Math.max(1, ...bars.map(([, v]) => v));
  return (
    <div className="stack-lg">
      <PageHeader title="Analytics" subtitle={scopeNote(role)} />
      <DataState loading={loading} error={error} data={data} onRetry={reload} skeleton={<SkeletonRows />}>
        {data && (
          <>
            <div className="grid grid-stats">
              <StatCard label="Revenue" value={formatCurrency(data.revenue)} icon={IndianRupee} />
              <StatCard label="Medicine orders" value={data.medicineOrders} icon={Activity} tone="blue" />
              <StatCard label="Bed occupancy" value={`${Math.round((data.bedOccupancy?.rate || 0) * 100)}%`} icon={Bed} tone="amber" hint={`${data.bedOccupancy?.occupied}/${data.bedOccupancy?.total} beds`} />
            </div>
            <section className="card">
              <h3>Volume overview</h3>
              <div className="bars" role="img" aria-label="Bar chart of platform volumes">
                {bars.map(([label, v]) => (
                  <div key={label} className="bar-row"><span className="bar-label">{label}</span><span className="bar-track"><span className="bar-fill" style={{ width: `${(v / max) * 100}%` }} /></span><span className="bar-val">{v}</span></div>
                ))}
              </div>
              <div className="bar-row" style={{ marginTop: 16 }}><span className="bar-label">Bed occupancy</span><span className="bar-track"><span className="bar-fill bar-amber" style={{ width: `${(data.bedOccupancy?.rate || 0) * 100}%` }} /></span><span className="bar-val">{Math.round((data.bedOccupancy?.rate || 0) * 100)}%</span></div>
            </section>
            <p className="muted small">Time-series and per-department analytics are not provided by the backend; these are current totals.</p>
          </>
        )}
      </DataState>
    </div>
  );
}

/* ------------------------------------------------------------------ paginated list helper */
function usePaged(fetcher) {
  const [page, setPage] = useState(1);
  const res = useAsync(() => fetcher({ page, limit: 15 }), [page]);
  return { ...res, page, setPage };
}

/* ------------------------------------------------------------------ shared list filters */
const useFilters = (initial) => {
  const [f, setF] = useState(initial);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v, page: 1 }));
  return [f, set, setF];
};

/* ------------------------------------------------------------------ Users (SUPER_ADMIN) */
export function AdminUsers() {
  const { user: me } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [f, set, setF] = useFilters({ q: '', role: '', status: '', page: 1 });
  const q = useDebounce(f.q);
  const [view, setView] = useState(null);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [busyId, setBusyId] = useState('');
  const res = useAsync(() => admin.listUsers({ page: f.page, limit: 15, ...(q ? { q } : {}), ...(f.role ? { role: f.role } : {}), ...(f.status ? { status: f.status } : {}) }), [f.page, f.role, f.status, q]);
  const hospitals = useAsync(() => admin.getDoctorFormContext().then((c) => c.hospitals), []);

  const toggleStatus = async (u) => {
    const suspending = u.status === 'ACTIVE';
    const ok = await confirm({
      title: suspending ? 'Deactivate this user?' : 'Reactivate this user?',
      message: suspending ? `${u.name} will be signed out and blocked from every protected endpoint until reactivated.${u.role === 'DOCTOR' ? ' Their doctor profile is also taken off the booking list.' : ''}` : `${u.name} will be able to sign in again.`,
      confirmLabel: suspending ? 'Deactivate' : 'Reactivate', tone: suspending ? 'danger' : 'primary',
    });
    if (!ok) return;
    setBusyId(u._id);
    try {
      const r = await admin.setUserStatus(u._id, suspending ? 'SUSPENDED' : 'ACTIVE');
      toast.success(suspending ? 'User deactivated.' : 'User reactivated.');
      if (r.affectedUpcomingAppointments) toast.warning(`${r.affectedUpcomingAppointments} upcoming appointment(s) with this doctor still exist — review them under Appointments.`, { duration: 9000 });
      res.reload();
    } catch (e) { toast.error(e.message); } finally { setBusyId(''); }
  };

  const items = res.data?.items || [];
  const filtered = !!(q || f.role || f.status);
  return (
    <div className="stack-lg">
      <PageHeader title="Users" subtitle="Manage every account on the platform." />
      <div className="filter-panel">
        <SearchBar value={f.q} onChange={(v) => set('q', v)} placeholder="Search name, email or phone…" label="Search users" />
        <select className="select" value={f.role} onChange={(e) => set('role', e.target.value)} aria-label="Filter by role"><option value="">All roles</option>{Object.values(ROLES).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
        <select className="select" value={f.status} onChange={(e) => set('status', e.target.value)} aria-label="Filter by account status">
          <option value="">Active & inactive</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="PENDING_VERIFICATION">Pending verification</option><option value="DELETED">Deleted</option>
        </select>
        {filtered && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setF({ q: '', role: '', status: '', page: 1 })}>Clear filters</button>}
      </div>
      <DataState loading={res.loading} error={res.error} data={res.data} onRetry={res.reload} skeleton={<SkeletonRows />} isEmpty={(d) => !d.items.length} empty={<EmptyState icon={Users} title={filtered ? 'No users match your filters' : 'No users'} />}>
        <DataTable caption="Users" rows={items} columns={[
          { key: 'name', header: 'Name', render: (u) => <strong>{u.name}</strong> },
          { key: 'email', header: 'Email' },
          { key: 'role', header: 'Role', render: (u) => <span className="chip">{ROLE_LABEL[u.role] || u.role}</span> },
          { key: 'status', header: 'Status', render: (u) => <StatusBadge status={u.status} size="sm" /> },
          { key: 'created', header: 'Joined', render: (u) => formatDate(u.createdAt, { timeZone: undefined }) },
          { key: 'actions', header: 'Actions', className: 'col-actions', render: (u) => {
            const deleted = u.status === 'DELETED';
            const self = String(u._id) === String(me?.id);
            return (
              <div className="row gap-sm wrap">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setView(u)}>View</button>
                {!deleted && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEdit(u)}>Edit</button>}
                {!deleted && u.status !== 'PENDING_VERIFICATION' && (
                  <button type="button" className="btn btn-secondary btn-sm" disabled={busyId === u._id || (self && u.status === 'ACTIVE')} title={self ? 'You cannot deactivate your own account' : undefined} onClick={() => toggleStatus(u)}>
                    {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                  </button>
                )}
                {!deleted && <button type="button" className="btn btn-danger-outline btn-sm" disabled={self} title={self ? 'You cannot delete your own account' : undefined} onClick={() => setDel(u)}>Delete</button>}
              </div>
            );
          } },
        ]} />
        <Pagination pagination={res.data?.pagination} onPage={(page) => setF((x) => ({ ...x, page }))} />
      </DataState>
      <UserDetailModal open={!!view} userId={view?._id} onClose={() => setView(null)} />
      <UserEditModal open={!!edit} user={edit} currentUserId={me?.id} hospitals={hospitals.data || []} onClose={() => setEdit(null)} onSaved={res.reload} />
      <UserDeleteDialog open={!!del} user={del} onClose={() => setDel(null)} onDeleted={res.reload} />
    </div>
  );
}

/* ------------------------------------------------------------------ Doctors */
export function AdminDoctors() {
  const { role } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [f, set, setF] = useFilters({ q: '', departmentId: '', specialization: '', status: '', verification: '', account: '', page: 1 });
  const q = useDebounce(f.q);
  const [form, setForm] = useState({ open: false, doctor: null });
  const [detail, setDetail] = useState(null);
  const [busyId, setBusyId] = useState('');
  const opts = useAsync(() => getDoctorOptions(), []);
  const ctx = useAsync(() => admin.getDoctorFormContext(), []);
  const params = { page: f.page, limit: 15, ...(q ? { q } : {}), ...Object.fromEntries(['departmentId', 'specialization', 'status', 'verification', 'account'].filter((k) => f[k]).map((k) => [k, f[k]])) };
  const res = useAsync(() => admin.listDoctors(params), [f.page, f.departmentId, f.specialization, f.status, f.verification, f.account, q]);

  const openEdit = async (row) => {
    try { setForm({ open: true, doctor: await admin.getAdminDoctor(row._id) }); } catch (e) { toast.error(e.message); }
  };

  const changeStatus = async (d, status) => {
    const ok = await confirm({
      title: status === 'INACTIVE' ? 'Deactivate this doctor?' : status === 'ON_LEAVE' ? 'Mark doctor on leave?' : 'Activate this doctor?',
      message: status === 'INACTIVE' ? `${doctorDisplayName(d)} will be signed out, blocked from doctor functions and removed from the patient directory. Existing appointments are kept.`
        : status === 'ON_LEAVE' ? 'The doctor stays signed in but cannot receive new bookings while on leave.'
        : 'The doctor will be able to sign in and, once verified, appear in the patient directory.',
      confirmLabel: status === 'INACTIVE' ? 'Deactivate' : status === 'ON_LEAVE' ? 'Mark on leave' : 'Activate', tone: status === 'INACTIVE' ? 'danger' : 'primary',
    });
    if (!ok) return;
    setBusyId(d._id);
    try {
      const r = await admin.setDoctorStatus(d._id, status);
      toast.success('Doctor status updated.');
      if (r.affectedUpcomingAppointments) toast.warning(`${r.affectedUpcomingAppointments} upcoming appointment(s) remain for this doctor — review them under Appointments.`, { duration: 9000 });
      res.reload();
    } catch (e) { toast.error(e.message); } finally { setBusyId(''); }
  };

  const items = res.data?.items || [];
  const filtered = !!(q || f.departmentId || f.specialization || f.status || f.verification || f.account);
  return (
    <div className="stack-lg">
      <PageHeader title="Doctors" subtitle={scopeNote(role)} actions={<button type="button" className="btn btn-primary" onClick={() => setForm({ open: true, doctor: null })}><Plus size={16} /> Add Doctor</button>} />
      <div className="filter-panel">
        <SearchBar value={f.q} onChange={(v) => set('q', v)} placeholder="Search name, email or phone…" label="Search doctors" />
        <select className="select" value={f.departmentId} onChange={(e) => set('departmentId', e.target.value)} aria-label="Filter by department"><option value="">All departments</option>{(ctx.data?.departments || []).map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</select>
        <select className="select" value={f.specialization} onChange={(e) => set('specialization', e.target.value)} aria-label="Filter by specialization"><option value="">All specializations</option>{(opts.data?.specializations || []).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
        <select className="select" value={f.status} onChange={(e) => set('status', e.target.value)} aria-label="Filter by status"><option value="">Any status</option><option value="ACTIVE">Active</option><option value="ON_LEAVE">On leave</option><option value="INACTIVE">Inactive</option></select>
        <select className="select" value={f.account} onChange={(e) => set('account', e.target.value)} aria-label="Filter by account"><option value="">Any account</option><option value="ACTIVE">Account active</option><option value="PENDING_VERIFICATION">Invitation pending</option><option value="SUSPENDED">Account suspended</option></select>
        <select className="select" value={f.verification} onChange={(e) => set('verification', e.target.value)} aria-label="Filter by verification"><option value="">Any verification</option><option value="PENDING">Pending</option><option value="VERIFIED">Verified</option><option value="REJECTED">Rejected</option></select>
        {filtered && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setF({ q: '', departmentId: '', specialization: '', status: '', verification: '', account: '', page: 1 })}>Clear filters</button>}
      </div>
      <DataState loading={res.loading} error={res.error} data={res.data} onRetry={res.reload} skeleton={<SkeletonRows />} isEmpty={(d) => !d.items.length}
        empty={<EmptyState icon={Stethoscope} title={filtered ? 'No doctors match your filters' : 'No doctors yet'} message={filtered ? undefined : 'Add your first doctor to get started.'} action={!filtered && <button type="button" className="btn btn-primary" onClick={() => setForm({ open: true, doctor: null })}><Plus size={16} /> Add Doctor</button>} />}>
        <DataTable caption="Doctors" rows={items} columns={[
          { key: 'name', header: 'Doctor', render: (d) => <><strong>{doctorDisplayName(d)}</strong><div className="muted small">{d.userId?.email}</div></> },
          { key: 'spec', header: 'Specialization', render: (d) => <>{d.specialization || '—'}<div className="muted small">{d.departmentId?.name}</div></> },
          { key: 'exp', header: 'Experience', render: (d) => `${d.experience ?? 0} yrs` },
          { key: 'fee', header: 'Fee', render: (d) => formatCurrency(d.consultationFee) },
          { key: 'verif', header: 'Verification', render: (d) => <StatusBadge status={d.verification?.status || 'PENDING'} size="sm" /> },
          { key: 'status', header: 'Status', render: (d) => <><StatusBadge status={d.status} size="sm" />{d.userId?.status === 'PENDING_VERIFICATION' && <div className="muted small">Invitation pending</div>}</> },
          { key: 'actions', header: 'Actions', className: 'col-actions', render: (d) => (
            <div className="row gap-sm wrap">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetail(d)}>View</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(d)}>Edit</button>
              {d.status === 'ACTIVE'
                ? <button type="button" className="btn btn-secondary btn-sm" disabled={busyId === d._id} onClick={() => changeStatus(d, 'INACTIVE')}>Deactivate</button>
                : <button type="button" className="btn btn-secondary btn-sm" disabled={busyId === d._id || d.userId?.status === 'PENDING_VERIFICATION'} title={d.userId?.status === 'PENDING_VERIFICATION' ? 'The doctor must accept the invitation first' : undefined} onClick={() => changeStatus(d, 'ACTIVE')}>Activate</button>}
            </div>
          ) },
        ]} />
        <Pagination pagination={res.data?.pagination} onPage={(page) => setF((x) => ({ ...x, page }))} />
      </DataState>
      <DoctorFormModal open={form.open} doctor={form.doctor} onClose={() => setForm({ open: false, doctor: null })} onSaved={res.reload} />
      <DoctorDetailModal open={!!detail} doctorId={detail?._id} onClose={() => setDetail(null)} onChanged={res.reload} onEdit={(full) => { setDetail(null); setForm({ open: true, doctor: full }); }} />
    </div>
  );
}

/* ------------------------------------------------------------------ Patients (SUPER_ADMIN) */
export function AdminPatients() {
  const { role } = useAuth();
  const p = usePaged(admin.listPatients);
  if (role !== ROLES.SUPER_ADMIN) return <div className="stack-lg"><PageHeader title="Patients" /><Restricted what="the patient directory" /></div>;
  return (
    <div className="stack-lg">
      <PageHeader title="Patients" subtitle="All registered patients." />
      <DataState loading={p.loading} error={p.error} data={p.data} onRetry={p.reload} skeleton={<SkeletonRows />} isEmpty={(d) => !d.items.length} empty={<EmptyState icon={Users} title="No patients" />}>
        <DataTable caption="Patients" rows={p.data?.items || []} columns={[
          { key: 'name', header: 'Patient', render: (x) => <strong>{x.userId?.name || '—'}</strong> },
          { key: 'email', header: 'Email', render: (x) => x.userId?.email || '—' },
          { key: 'phone', header: 'Phone', render: (x) => x.userId?.phone || '—' },
          { key: 'gender', header: 'Gender', render: (x) => (x.gender ? titleCase(x.gender) : '—') },
          { key: 'blood', header: 'Blood group', render: (x) => (x.bloodGroup && x.bloodGroup !== 'UNKNOWN' ? x.bloodGroup : '—') },
          { key: 'since', header: 'Registered', render: (x) => formatDate(x.createdAt, { timeZone: undefined }) },
        ]} />
        <Pagination pagination={p.data?.pagination} onPage={p.setPage} />
      </DataState>
    </div>
  );
}

/* ------------------------------------------------------------------ Appointments */
export function AdminAppointments() {
  const { role } = useAuth();
  const toast = useToast();
  const { doctorName } = useDoctorDirectory();
  const [busyId, setBusyId] = useState(null);
  const p = usePaged(admin.listAppointments);
  const change = async (a, status) => {
    setBusyId(a._id);
    try { await updateAppointmentStatus(a._id, status); toast.success('Status updated'); p.reload(); } catch (e) { toast.error(e.message); } finally { setBusyId(null); }
  };
  return (
    <div className="stack-lg">
      <PageHeader title="Appointments" subtitle={scopeNote(role)} />
      <DataState loading={p.loading} error={p.error} data={p.data} onRetry={p.reload} skeleton={<SkeletonRows />} isEmpty={(d) => !d.items.length} empty={<EmptyState icon={CalendarDays} title="No appointments" />}>
        <DataTable caption="Appointments" rows={p.data?.items || []} columns={[
          { key: 'ref', header: 'Ref', render: (a) => `#${shortId(a._id)}` },
          { key: 'when', header: 'When', render: (a) => <>{formatDate(a.date)}<br /><span className="muted small">{formatTimeRange(a.startTime, a.endTime)}</span></> },
          { key: 'doctor', header: 'Doctor', render: (a) => doctorName(a.doctorId) },
          { key: 'patient', header: 'Patient', render: (a) => `Patient #${shortId(refId(a.patientId))}` },
          { key: 'type', header: 'Type', render: (a) => titleCase(a.consultationType) },
          { key: 'pay', header: 'Payment', render: (a) => <StatusBadge status={a.paymentStatus} size="sm" /> },
          { key: 'status', header: 'Status', render: (a) => (
            <div className="stack-xs"><StatusBadge status={a.status} size="sm" />
              <StatusSelect value={APPOINTMENT_STATUS_SETTABLE.includes(a.status) ? a.status : ''} options={a.status === 'RESCHEDULED' ? ['', ...APPOINTMENT_STATUS_SETTABLE] : APPOINTMENT_STATUS_SETTABLE} disabled={busyId === a._id} onChange={(s) => s && s !== a.status && change(a, s)} label="Change status" /></div>
          ) },
        ]} />
        <Pagination pagination={p.data?.pagination} onPage={p.setPage} />
      </DataState>
      <p className="muted small">The backend doesn't return patient names to admins; patients are identified by reference.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ Admissions (+ bed allocation) */
export function AdminAdmissions() {
  const { role } = useAuth();
  const toast = useToast();
  const p = usePaged(admin.listAdmissions);
  const [alloc, setAlloc] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const change = async (a, status) => {
    setBusyId(a._id);
    try { await updateAdmissionStatus(a._id, status); toast.success('Admission status updated'); p.reload(); } catch (e) { toast.error(e.message); } finally { setBusyId(null); }
  };
  return (
    <div className="stack-lg">
      <PageHeader title="Admissions" subtitle={scopeNote(role)} />
      <DataState loading={p.loading} error={p.error} data={p.data} onRetry={p.reload} skeleton={<SkeletonRows />} isEmpty={(d) => !d.items.length} empty={<EmptyState icon={HeartPulse} title="No admission requests" />}>
        <DataTable caption="Admissions" rows={p.data?.items || []} columns={[
          { key: 'ref', header: 'Ref', render: (a) => `#${shortId(a._id)}` },
          { key: 'reason', header: 'Reason', render: (a) => <span className="clamp">{a.reason}</span> },
          { key: 'patient', header: 'Patient', render: (a) => `Patient #${shortId(refId(a.patientId))}` },
          { key: 'req', header: 'Requested', render: (a) => formatDateTime(a.createdAt) },
          { key: 'status', header: 'Status', render: (a) => (
            <div className="stack-xs"><StatusBadge status={a.status} size="sm" /><StatusSelect value={a.status} options={Object.values(ADMISSION_STATUS)} disabled={busyId === a._id} onChange={(s) => s !== a.status && change(a, s)} label="Change admission status" /></div>
          ) },
          { key: 'bed', header: 'Bed', render: (a) => (a.bedId ? <span className="chip">Assigned</span> : ['APPROVED', 'UNDER_REVIEW', 'REQUESTED'].includes(a.status) ? <button className="btn btn-secondary btn-sm" onClick={() => setAlloc(a)}>Allocate bed</button> : '—') },
        ]} />
        <Pagination pagination={p.data?.pagination} onPage={p.setPage} />
      </DataState>
      <AllocateModal admission={alloc} onClose={() => setAlloc(null)} onDone={() => { setAlloc(null); p.reload(); }} />
    </div>
  );
}

function AllocateModal({ admission, onClose, onDone }) {
  const toast = useToast();
  const beds = useAsync(() => (admission ? admin.listBeds() : Promise.resolve(null)), [admission?._id]);
  const [sel, setSel] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const available = (beds.data || []).filter((b) => b.status === BED_STATUS.AVAILABLE);
  const go = async () => {
    setBusy(true); setErr(null);
    try { await allocateBed({ bedId: sel, admissionId: admission._id }); toast.success('Bed allocated — the patient has been notified.'); setSel(''); onDone(); }
    catch (e) { setErr(e); if (e.status === 409) beds.reload(); } finally { setBusy(false); }
  };
  return (
    <Modal open={!!admission} onClose={onClose} title="Allocate a bed" footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!sel || busy} onClick={go}>{busy ? 'Allocating…' : 'Allocate bed'}</button></>}>
      <div className="stack">
        {beds.loading ? <p className="muted">Loading beds…</p> : beds.error ? <FormError error={beds.error} /> : available.length === 0 ? <p className="muted">No beds are currently available.</p> : (
          <RoomBedGrid beds={available} renderActions={(b) => <button type="button" className={`btn btn-sm ${sel === b._id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSel(b._id)} aria-pressed={sel === b._id}>{sel === b._id ? 'Selected' : 'Select'}</button>} />
        )}
        <FormError error={err} />
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ Beds */
export function AdminBeds() {
  const { role } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => admin.listBeds(), []);
  const [busyId, setBusyId] = useState(null);
  const [tab, setTab] = useState('');
  const counts = useMemo(() => Object.fromEntries(Object.values(BED_STATUS).map((s) => [s, (data || []).filter((b) => b.status === s).length])), [data]);
  const beds = (data || []).filter((b) => !tab || b.status === tab);
  const act = async (fn, msg, id) => { setBusyId(id); try { await fn(); toast.success(msg); reload(); } catch (e) { toast.error(e.message); } finally { setBusyId(null); } };
  return (
    <div className="stack-lg">
      <PageHeader title="Beds & rooms" subtitle={scopeNote(role)} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: '', label: 'All', count: data?.length }, ...Object.values(BED_STATUS).map((s) => ({ value: s, label: titleCase(s), count: counts[s] }))]} />
      <DataState loading={loading} error={error} data={data} onRetry={reload} skeleton={<SkeletonRows />} isEmpty={() => beds.length === 0} empty={<EmptyState icon={Bed} title="No beds to show" />}>
        <RoomBedGrid beds={beds} showAssignment renderActions={(b) => (
          <div className="row gap-xs wrap">
            <StatusSelect value={b.status} options={Object.values(BED_STATUS)} disabled={busyId === b._id} onChange={(s) => s !== b.status && act(() => updateBedStatus(b._id, s), 'Bed status updated', b._id)} label={`Status for bed ${b.bedNumber}`} />
            {b.status === BED_STATUS.OCCUPIED && <button className="btn btn-secondary btn-sm" disabled={busyId === b._id} onClick={() => act(() => releaseBed(b._id), 'Bed released', b._id)}>Release</button>}
          </div>
        )} />
      </DataState>
      <p className="muted small">The backend returns only a bed's assigned patient id — not names — so occupant and doctor details aren't shown. Allocate beds from the Admissions page.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ Emergency */
export function AdminEmergency() {
  const { role } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => admin.listEmergency(), []);
  const [busyId, setBusyId] = useState(null);
  const change = async (c, status) => { setBusyId(c._id); try { await updateEmergencyStatus(c._id, { status }); toast.success('Emergency case updated'); reload(); } catch (e) { toast.error(e.message); } finally { setBusyId(null); } };
  return (
    <div className="stack-lg">
      <PageHeader title="Emergency cases" subtitle={`${scopeNote(role)} New cases also arrive live.`} />
      <DataState loading={loading} error={error} data={data} onRetry={reload} skeleton={<SkeletonRows />} empty={<EmptyState icon={Siren} title="No emergency cases" />}>
        <DataTable caption="Emergency cases" rows={data || []} columns={[
          { key: 'ref', header: 'Case', render: (c) => `#${shortId(c._id)}` },
          { key: 'type', header: 'Emergency', render: (c) => <strong>{c.emergencyType}</strong> },
          { key: 'loc', header: 'Location', render: (c) => c.location?.address || (c.location?.lat ? `${Number(c.location.lat).toFixed(3)}, ${Number(c.location.lng).toFixed(3)}` : '—') },
          { key: 'patient', header: 'Patient', render: (c) => `Patient #${shortId(refId(c.patientId))}` },
          { key: 'time', header: 'Received', render: (c) => formatDateTime(c.createdAt) },
          { key: 'status', header: 'Status', render: (c) => (
            <div className="stack-xs"><StatusBadge status={c.status} size="sm" /><StatusSelect value={c.status} options={Object.values(EMERGENCY_STATUS)} disabled={busyId === c._id} onChange={(s) => s !== c.status && change(c, s)} label="Change emergency status" /></div>
          ) },
        ]} />
      </DataState>
    </div>
  );
}
