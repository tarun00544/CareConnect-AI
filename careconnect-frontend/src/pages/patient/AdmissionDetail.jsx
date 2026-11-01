import { Link, useParams } from 'react-router-dom';
import { Check, FileText } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import DataState from '../../components/common/DataState';
import FileUploader from '../../components/ui/FileUploader';
import { useAsync } from '../../hooks/useAsync';
import { getAdmission, uploadAdmissionDocument } from '../../services/admissionService';
import { fileHref } from '../../utils/env';
import { formatDay, formatDateTime } from '../../utils/format';
import { statusMeta } from '../../constants/statusMeta';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants';

const FLOW = ['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'BED_ASSIGNED', 'ADMITTED', 'DISCHARGED'];

export default function AdmissionDetail() {
  const { id } = useParams();
  const { role } = useAuth();
  const { data: a, loading, error, reload } = useAsync(() => getAdmission(id), [id]);
  const idx = a ? FLOW.indexOf(a.status) : -1;
  const cancelled = a?.status === 'CANCELLED';
  const f = a?.admissionForm || {};
  return (
    <div className="stack-lg">
      <DataState loading={loading} error={error} data={a} onRetry={reload}>
        {a && (
          <>
            <PageHeader title="Admission request" subtitle={a.reason} actions={<StatusBadge status={a.status} />} />
            <section className="card">
              <h3>Progress</h3>
              {cancelled ? <p className="muted">This request was cancelled.</p> : (
                <ol className="track">{FLOW.map((s, i) => (
                  <li key={s} className={i < idx ? 'done' : i === idx ? 'current' : ''} aria-current={i === idx ? 'step' : undefined}><span className="track-dot">{i <= idx ? <Check size={13} /> : null}</span><span>{statusMeta(s).label}</span></li>
                ))}</ol>
              )}
            </section>
            <div className="grid grid-2 align-start">
              <section className="card">
                <h3>Details</h3>
                <dl className="summary">
                  <div><dt>Hospital</dt><dd>{a.hospitalId?.name || '—'}</dd></div>
                  <div><dt>Department</dt><dd>{a.departmentId?.name || '—'}</dd></div>
                  <div><dt>Requested</dt><dd>{formatDateTime(a.createdAt)}</dd></div>
                  {a.admissionDate && <div><dt>Admitted</dt><dd>{formatDateTime(a.admissionDate)}</dd></div>}
                  {a.dischargeDate && <div><dt>Discharged</dt><dd>{formatDateTime(a.dischargeDate)}</dd></div>}
                  <div><dt>Room</dt><dd>{a.roomId?.roomNumber ? `${a.roomId.roomNumber}${a.roomId.roomType ? ` (${String(a.roomId.roomType).replace('_', ' ').toLowerCase()})` : ''}` : 'Not assigned yet'}</dd></div>
                  <div><dt>Bed</dt><dd>{a.bedId?.bedNumber || 'Not assigned yet'}</dd></div>
                </dl>
              </section>
              <section className="card stack">
                <h3>Documents</h3>
                {(a.documents || []).length === 0 ? <p className="muted">No documents attached.</p> : (
                  <ul className="file-list">{a.documents.map((d) => (
                    <li key={d._id || d.fileUrl} className="row between"><span className="row gap-xs"><FileText size={15} /> {d.title}</span>
                      <a href={fileHref(d.fileUrl)} target="_blank" rel="noreferrer noopener" className="small">Open · {formatDay(d.uploadedAt)}</a></li>
                  ))}</ul>
                )}
                {role === ROLES.PATIENT && !cancelled && a.status !== 'DISCHARGED' && (
                  <FileUploader label="Add a document" autoUpload onUpload={(file, p) => uploadAdmissionDocument(a._id, file, { title: file.name, onProgress: p })} onUploaded={reload} preview={false} />
                )}
              </section>
            </div>
            {f.personalDetails && (
              <section className="card">
                <h3>Submitted information</h3>
                <dl className="summary">
                  <div><dt>Patient</dt><dd>{f.personalDetails.fullName}</dd></div>
                  {f.emergencyContact?.name && <div><dt>Emergency contact</dt><dd>{f.emergencyContact.name} · {f.emergencyContact.phone}</dd></div>}
                  {f.medicalHistory?.length > 0 && <div><dt>Medical history</dt><dd>{f.medicalHistory.join(', ')}</dd></div>}
                  {f.allergies?.length > 0 && <div><dt>Allergies</dt><dd>{f.allergies.join(', ')}</dd></div>}
                  {f.currentMedicines?.length > 0 && <div><dt>Current medicines</dt><dd>{f.currentMedicines.join(', ')}</dd></div>}
                  {f.insurance?.provider && <div><dt>Insurance</dt><dd>{f.insurance.provider}</dd></div>}
                </dl>
              </section>
            )}
            <Link to="/patient/admission" className="btn btn-ghost">← All admission requests</Link>
          </>
        )}
      </DataState>
    </div>
  );
}
