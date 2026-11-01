import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, FileHeart, Lock } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Tabs from '../../components/ui/Tabs';
import EmptyState from '../../components/ui/EmptyState';
import StatusBadge from '../../components/ui/StatusBadge';
import FileUploader from '../../components/ui/FileUploader';
import Field from '../../components/ui/Field';
import DataState from '../../components/common/DataState';
import PrescriptionCard from '../../components/medical/PrescriptionCard';
import AdmissionCard from '../../components/admission/AdmissionCard';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { useAsync } from '../../hooks/useAsync';
import { useDoctorDirectory } from '../../hooks/useDoctorDirectory';
import { getMyAdmissions, getMyAppointments, getMyPrescriptions, getMyRecords } from '../../services/patientService';
import { uploadReport } from '../../services/uploadService';
import { fileHref } from '../../utils/env';
import { formatDay, formatDate, formatTimeRange, titleCase } from '../../utils/format';
import { RECORD_TYPES } from '../../constants';
import { useToast } from '../../context/AppContext';

async function loadAll() {
  const [records, rx, adm, appts] = await Promise.allSettled([getMyRecords(), getMyPrescriptions(), getMyAdmissions(), getMyAppointments({ limit: 100 })]);
  const firstErr = [records, rx, adm, appts].find((r) => r.status === 'rejected');
  if ([records, rx, adm, appts].every((r) => r.status === 'rejected')) throw firstErr.reason;
  const v = (r, d) => (r.status === 'fulfilled' ? r.value : d);
  return { records: v(records, []), rx: v(rx, []), adm: v(adm, []), appts: v(appts, { items: [] }).items, partial: !!firstErr };
}

export default function Records() {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(loadAll, []);
  const { doctorName } = useDoctorDirectory();
  const [tab, setTab] = useState('reports');
  const [type, setType] = useState('LAB_REPORT');
  const [title, setTitle] = useState('');
  const completed = (data?.appts || []).filter((a) => a.status === 'COMPLETED');

  return (
    <div className="stack-lg">
      <PageHeader
        title="Medical Records"
        subtitle="Your private health documents in one place."
        action={
          <Link to="/patient/report-comparison" className="btn btn-primary btn-sm">
            Compare Reports (AI Evolution Tracker)
          </Link>
        }
      />
      <div className="privacy-note"><Lock size={15} aria-hidden="true" /> Only you and the care team involved in your treatment can see these records.</div>
      <DataState loading={loading} error={error} data={data} onRetry={reload} skeleton={<SkeletonRows />}>
        {data?.partial && <div className="form-error"><div>Some sections could not be loaded. <button className="link-btn" onClick={reload}>Retry</button></div></div>}
        <Tabs value={tab} onChange={setTab} tabs={[
          { value: 'reports', label: 'Reports', count: data?.records.length },
          { value: 'consultations', label: 'Consultations', count: completed.length },
          { value: 'prescriptions', label: 'Prescriptions', count: data?.rx.length },
          { value: 'admissions', label: 'Admissions', count: data?.adm.length },
        ]} />
        {tab === 'reports' && (
          <div className="stack">
            <section className="card stack">
              <h3>Upload a report</h3>
              <div className="grid grid-2">
                <Field label="Type" htmlFor="rt"><select id="rt" className="select" value={type} onChange={(e) => setType(e.target.value)}>{RECORD_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</select></Field>
                <Field label="Title (optional)" htmlFor="rtitle"><input id="rtitle" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Defaults to the file name" /></Field>
              </div>
              <FileUploader label="Choose a report file" onUpload={(f, p) => uploadReport(f, { type, title: title.trim() || undefined, onProgress: p })} onUploaded={() => { toast.success('Report uploaded'); setTitle(''); reload(); }} buttonLabel="Upload report" />
            </section>
            {data.records.length === 0 ? <div className="card"><EmptyState icon={FileHeart} title="No reports yet" message="Uploaded reports and doctor-added records appear here." /></div> : (
              <div className="stack">{data.records.map((r) => (
                <article key={r._id} className="card row between gap-sm wrap">
                  <div><h3>{r.title}</h3><div className="muted small">{titleCase(r.type)} · {formatDay(r.createdAt)}</div>{r.description && <p className="muted">{r.description}</p>}</div>
                  {r.fileUrl && <a className="btn btn-secondary btn-sm" href={fileHref(r.fileUrl)} target="_blank" rel="noreferrer noopener"><ExternalLink size={14} /> Open file</a>}
                </article>
              ))}</div>
            )}
          </div>
        )}
        {tab === 'consultations' && (completed.length === 0 ? <div className="card"><EmptyState title="No completed consultations" /></div> : (
          <div className="stack">{completed.map((a) => (
            <article key={a._id} className="card row between gap-sm wrap">
              <div><h3><Link to={`/patient/appointments/${a._id}`}>{doctorName(a.doctorId)}</Link></h3><div className="muted small">{formatDate(a.date)} · {formatTimeRange(a.startTime, a.endTime)}</div></div>
              <StatusBadge status={a.status} size="sm" />
            </article>
          ))}</div>
        ))}
        {tab === 'prescriptions' && (data.rx.length === 0 ? <div className="card"><EmptyState title="No prescriptions" /></div> : <div className="stack">{data.rx.map((p) => <PrescriptionCard key={p._id} prescription={p} who={`Prescription from ${doctorName(p.doctorId)}`} to={`/patient/prescriptions/${p._id}`} />)}</div>)}
        {tab === 'admissions' && (data.adm.length === 0 ? <div className="card"><EmptyState title="No admissions" /></div> : <div className="stack">{data.adm.map((a) => <AdmissionCard key={a._id} admission={a} to={`/patient/admission/${a._id}`} />)}</div>)}
      </DataState>
    </div>
  );
}
