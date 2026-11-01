import { useState } from 'react';
import { Copy, Download, FileText, RefreshCw, ShieldCheck, Trash2, Upload } from 'lucide-react';
import Modal from '../ui/Modal';
import Field from '../ui/Field';
import StatusBadge from '../ui/StatusBadge';
import DataState from '../common/DataState';
import FormError from '../common/FormError';
import { SkeletonRows } from '../ui/Skeleton';
import { useAsync } from '../../hooks/useAsync';
import { useToast, useConfirm } from '../../context/AppContext';
import * as admin from '../../services/adminService';
import { DAYS } from '../../constants';
import { formatBytes, formatCurrency, formatDateTime, titleCase } from '../../utils/format';

const DOC_LABEL = { REGISTRATION_CERTIFICATE: 'Medical registration certificate', QUALIFICATION_CERTIFICATE: 'Qualification certificate', OTHER: 'Other document' };
const DOC_ACCEPT = ['application/pdf', 'image/jpeg', 'image/png'];
const MODE_LABEL = { IN_PERSON: 'In-person', VIDEO: 'Video', AUDIO: 'Audio', CHAT: 'Chat' };

export default function DoctorDetailModal({ doctorId, open, onClose, onChanged, onEdit }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { data: d, loading, error, reload, setData } = useAsync(() => (doctorId ? admin.getAdminDoctor(doctorId) : Promise.resolve(null)), [doctorId, open], { immediate: !!doctorId });
  const [docType, setDocType] = useState('REGISTRATION_CERTIFICATE');
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState(null);
  const [invite, setInvite] = useState(null);

  const run = async (key, fn, success) => {
    setBusy(key); setFormError(null);
    try {
      const r = await fn();
      if (success) toast.success(success);
      return r;
    } catch (e) { setFormError(e); toast.error(e.message); return undefined; } finally { setBusy(''); }
  };

  const upload = async (file) => {
    if (!file) return;
    if (!DOC_ACCEPT.includes(file.type)) return toast.error('Only PDF, JPEG or PNG documents are accepted.');
    if (file.size > 10 * 1024 * 1024) return toast.error('File is too large (max 10 MB).');
    const r = await run('upload', () => admin.uploadDoctorDocument(doctorId, file, { type: docType, title: file.name }), 'Document uploaded.');
    if (r) { await reload(); onChanged?.(); }
  };

  const removeDoc = async (doc) => {
    const ok = await confirm({ title: 'Delete this document?', message: `“${doc.originalName}” will be permanently removed. If it is required for verification, the doctor goes back to “Pending”.`, confirmLabel: 'Delete', tone: 'danger' });
    if (!ok) return;
    const r = await run('del', () => admin.deleteDoctorDocument(doctorId, doc._id), 'Document deleted.');
    if (r) { await reload(); onChanged?.(); }
  };

  const decide = async (decision) => {
    if (decision === 'REJECTED' && !note.trim()) { setFormError({ message: 'Please record the reason for rejection.', details: [] }); return; }
    const r = await run('verify', () => admin.recordDoctorVerification(doctorId, decision, note), 'Verification decision recorded.');
    if (r) { setData(r); setNote(''); onChanged?.(); }
  };

  const resend = async () => {
    const r = await run('invite', () => admin.resendDoctorInvite(doctorId), 'New invitation issued.');
    if (r) setInvite(r.invitation);
  };

  const copy = async (t) => { try { await navigator.clipboard.writeText(t); toast.success('Link copied.'); } catch { toast.info('Select the link and copy it manually.'); } };

  const v = d?.verification;
  const pendingInvite = d?.userId?.status === 'PENDING_VERIFICATION';

  return (
    <Modal open={open} onClose={onClose} title="Doctor details" size="xl" footer={<>{d && <button type="button" className="btn btn-secondary" onClick={() => onEdit?.(d)}>Edit details</button>}<button type="button" className="btn btn-primary" onClick={onClose}>Close</button></>}>
      <DataState loading={loading} error={error} data={d} onRetry={reload} skeleton={<SkeletonRows />}>
        {d && (
          <div className="stack">
            <FormError error={formError} />
            <header className="row between wrap gap-sm">
              <div>
                <h3 style={{ margin: 0 }}>Dr. {String(d.userId?.name || '').replace(/^dr\.?\s+/i, '')}</h3>
                <div className="muted">{d.specialization}{d.additionalSpecializations?.length ? ` + ${d.additionalSpecializations.join(', ')}` : ''} · {d.departmentId?.name} · {d.hospitalId?.name}</div>
              </div>
              <div className="row gap-sm wrap"><StatusBadge status={d.status} /><StatusBadge status={v?.status} label={`Verification: ${titleCase(v?.status || 'PENDING')}`} /><StatusBadge status={d.userId?.status} label={`Account: ${titleCase(d.userId?.status || '')}`} /></div>
            </header>

            <section className="detail-grid">
              <dl className="summary">
                <div><dt>Email</dt><dd>{d.userId?.email}{d.userId?.emailVerified ? ' (verified)' : ' (not verified)'}</dd></div>
                <div><dt>Phone</dt><dd>{d.userId?.phone || '—'}</dd></div>
                <div><dt>Qualifications</dt><dd>{d.qualification || '—'}</dd></div>
                <div><dt>Experience</dt><dd>{d.experience ?? 0} years</dd></div>
                <div><dt>Category</dt><dd>{titleCase(d.professionalCategory || '—')}</dd></div>
                <div><dt>Registration</dt><dd>{d.registration?.number ? `${d.registration.number} · ${d.registration.council || ''} · ${d.registration.state || ''}` : '—'}</dd></div>
                <div><dt>Languages</dt><dd>{d.languages?.join(', ') || '—'}</dd></div>
              </dl>
              <dl className="summary">
                <div><dt>Consultation fee</dt><dd>{formatCurrency(d.consultationFee)}{d.followUpFee != null ? ` · follow-up ${formatCurrency(d.followUpFee)}` : ''}</dd></div>
                <div><dt>Modes</dt><dd>{(d.consultationModes || []).map((m) => MODE_LABEL[m] || m).join(', ') || '—'}</dd></div>
                <div><dt>Room</dt><dd>{d.consultationRoom || '—'}</dd></div>
                <div><dt>Booking</dt><dd>{d.bookingEnabled === false ? 'Disabled' : 'Enabled'}{d.maxAppointmentsPerDay ? ` · max ${d.maxAppointmentsPerDay}/day` : ''}</dd></div>
                <div><dt>Schedule</dt><dd>{d.availability?.length ? d.availability.map((a) => `${DAYS[a.dayOfWeek].slice(0, 3)} ${a.startTime}–${a.endTime}${a.breakStartTime ? ` (break ${a.breakStartTime}–${a.breakEndTime})` : ''}`).join(' · ') : 'No schedule set'}</dd></div>
                <div><dt>Leave dates</dt><dd>{d.leaveDates?.length ? d.leaveDates.join(', ') : '—'}</dd></div>
                <div><dt>Created</dt><dd>{formatDateTime(d.createdAt)}{d.createdBy?.name ? ` by ${d.createdBy.name}` : ''}</dd></div>
                <div><dt>Last login</dt><dd>{d.userId?.lastLoginAt ? formatDateTime(d.userId.lastLoginAt) : 'Never'}</dd></div>
              </dl>
            </section>

            {pendingInvite && (
              <div className="card card-flat stack-sm">
                <strong>Invitation pending</strong>
                <p className="muted small">The doctor has not set a password yet{d.userId?.inviteExpiresAt ? ` (link expires ${formatDateTime(d.userId.inviteExpiresAt)})` : ''}. They cannot sign in or be activated until they accept.</p>
                <div><button type="button" className="btn btn-secondary btn-sm" onClick={resend} disabled={busy === 'invite'}><RefreshCw size={14} /> Resend invitation</button></div>
                {invite && (
                  <Field label="New one-time link" hint="Shown only now. Send it to the doctor over a trusted channel.">
                    <div className="input-group"><input className="input" readOnly value={invite.inviteUrl} onFocus={(e) => e.target.select()} aria-label="Invitation link" /><button type="button" className="icon-btn" onClick={() => copy(invite.inviteUrl)} aria-label="Copy link"><Copy size={16} /></button></div>
                  </Field>
                )}
              </div>
            )}

            <section className="card card-flat stack-sm" aria-label="Professional documents">
              <div className="row between wrap gap-sm"><strong>Professional documents</strong>
                <div className="row gap-sm wrap">
                  <select className="select select-sm" value={docType} onChange={(e) => setDocType(e.target.value)} aria-label="Document type">{Object.entries(DOC_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                  <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}><Upload size={14} /> {busy === 'upload' ? 'Uploading…' : 'Upload'}
                    <input type="file" hidden accept={DOC_ACCEPT.join(',')} disabled={busy === 'upload'} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
                  </label>
                </div>
              </div>
              {d.missingDocuments?.length > 0 && <p className="field-hint">Still required for verification: {d.missingDocuments.map((t) => DOC_LABEL[t]).join(', ')}.</p>}
              {(d.documents || []).length === 0 && <p className="muted small">No documents uploaded yet. Files are stored privately and only open for authorised administrators of this hospital.</p>}
              {(d.documents || []).map((doc) => (
                <div className="doc-row" key={doc._id}>
                  <FileText size={18} aria-hidden="true" />
                  <div><strong>{doc.originalName}</strong><div className="muted small">{DOC_LABEL[doc.type]} · {formatBytes(doc.size)} · {formatDateTime(doc.uploadedAt)}</div></div>
                  <div className="row gap-sm">
                    <button type="button" className="icon-btn" aria-label={`Download ${doc.originalName}`} onClick={() => run('dl', () => admin.downloadDoctorDocument(doctorId, doc))}><Download size={16} /></button>
                    <button type="button" className="icon-btn" aria-label={`Delete ${doc.originalName}`} onClick={() => removeDoc(doc)}><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </section>

            <section className="card card-flat stack-sm" aria-label="Professional verification">
              <div className="row gap-sm"><ShieldCheck size={18} aria-hidden="true" /><strong>Professional verification</strong></div>
              <p className="muted small">Verification is a decision you record after reviewing the documents against the registration council&apos;s register — it is never set automatically. Changing registration details or removing a required document sends a verified doctor back to “Pending”.</p>
              {v?.status !== 'PENDING' && (
                <p className="small">Last decision: <strong>{titleCase(v?.status)}</strong>{v?.verifiedAt ? ` on ${formatDateTime(v.verifiedAt)}` : ''}{v?.verifiedBy?.name ? ` by ${v.verifiedBy.name}` : ''}{v?.notes ? ` — “${v.notes}”` : ''}</p>
              )}
              {v?.status === 'PENDING' && v?.notes && <p className="small muted">Note: {v.notes}</p>}
              <Field label="Verification notes" htmlFor="v-notes" hint="Required when rejecting.">
                <textarea id="v-notes" className="input" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <div className="row gap-sm wrap">
                <button type="button" className="btn btn-primary btn-sm" disabled={busy === 'verify' || v?.status === 'VERIFIED'} onClick={() => decide('VERIFIED')}>Mark verified</button>
                <button type="button" className="btn btn-danger-outline btn-sm" disabled={busy === 'verify' || v?.status === 'REJECTED'} onClick={() => decide('REJECTED')}>Reject</button>
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy === 'verify' || v?.status === 'PENDING'} onClick={() => decide('PENDING')}>Reopen review</button>
              </div>
            </section>
          </div>
        )}
      </DataState>
    </Modal>
  );
}
