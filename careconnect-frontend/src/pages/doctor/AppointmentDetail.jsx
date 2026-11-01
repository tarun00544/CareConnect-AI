import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ClipboardPlus, MessageSquare, Sparkles, Video } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import Field from '../../components/ui/Field';
import DataState from '../../components/common/DataState';
import FormError from '../../components/common/FormError';
import AIResult from '../../components/medical/AIResult';
import { useAsync } from '../../hooks/useAsync';
import { useToast } from '../../context/AppContext';
import { getMyPatients } from '../../services/doctorService';
import { updateAppointmentStatus } from '../../services/appointmentService';
import { addConsultationNotes, getConsultation, startConsultation, updateConsultation } from '../../services/consultationService';
import { createConversation } from '../../services/chatService';
import { createVideoSession } from '../../services/videoService';
import { runConsultationSummary } from '../../services/aiService';
import { ageFromDob, formatDate, formatTimeRange, refId, titleCase } from '../../utils/format';

/**
 * Doctor's view of one appointment / consultation (same component serves /doctor/appointments/:id and
 * /doctor/consultations/:id). "Consultation" = the IN_PROGRESS phase of the appointment; notes live on it.
 * The backend has no separate follow-up field, so follow-up instructions are recorded in the notes.
 */
export default function DoctorAppointmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: a, loading, error, reload } = useAsync(() => getConsultation(id), [id]);
  const pts = useAsync(() => getMyPatients(), []);
  const [newNote, setNewNote] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [summary, setSummary] = useState(null);
  const [sumBusy, setSumBusy] = useState(false);
  const [sumErr, setSumErr] = useState(null);

  useEffect(() => { if (a) setEditNotes(a.notes || ''); }, [a]);

  const patient = a && (pts.data || []).find((p) => p._id === refId(a.patientId));
  const patientName = patient?.userId?.name || 'Patient';
  const pObj = typeof a?.patientId === 'object' ? a.patientId : patient;
  const age = ageFromDob(pObj?.dateOfBirth);

  const run = async (fn, okMsg) => {
    setBusy(true); setErr(null);
    try { await fn(); if (okMsg) toast.success(okMsg); reload(); } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  const setStatus = (status, msg) => run(() => updateAppointmentStatus(id, status), msg);

  const openChat = async () => { setBusy(true); try { const c = await createConversation(id); navigate(`/doctor/chat?c=${c._id}`); } catch (e) { toast.error(e.message); setBusy(false); } };
  const openVideo = async () => { setBusy(true); try { const s = await createVideoSession(id); navigate(`/doctor/video/${s.id}`, { state: { appointmentId: id } }); } catch (e) { toast.error(e.message); setBusy(false); } };
  const summarise = async () => {
    setSumBusy(true); setSumErr(null);
    try { setSummary(await runConsultationSummary({ appointmentId: id, doctorNotes: a.notes || undefined })); } catch (e) { setSumErr(e); } finally { setSumBusy(false); }
  };

  const st = a?.status;
  return (
    <div className="stack-lg">
      <DataState loading={loading} error={error} data={a} onRetry={reload}>
        {a && (
          <>
            <PageHeader title={`Consultation — ${patientName}`} subtitle={`${formatDate(a.date)} · ${formatTimeRange(a.startTime, a.endTime)} · ${titleCase(a.consultationType)}`} actions={<StatusBadge status={st} />} />
            <div className="grid grid-2 align-start">
              <section className="card stack">
                <h3>Patient</h3>
                <dl className="summary">
                  <div><dt>Name</dt><dd>{patientName}</dd></div>
                  {patient?.userId?.phone && <div><dt>Phone</dt><dd>{patient.userId.phone}</dd></div>}
                  {age != null && <div><dt>Age</dt><dd>{age}</dd></div>}
                  {pObj?.gender && <div><dt>Gender</dt><dd>{titleCase(pObj.gender)}</dd></div>}
                  {pObj?.bloodGroup && pObj.bloodGroup !== 'UNKNOWN' && <div><dt>Blood group</dt><dd>{pObj.bloodGroup}</dd></div>}
                  {pObj?.allergies?.length > 0 && <div><dt>Allergies</dt><dd>{pObj.allergies.join(', ')}</dd></div>}
                  {pObj?.medicalHistory?.length > 0 && <div><dt>History</dt><dd>{pObj.medicalHistory.join(', ')}</dd></div>}
                  {pObj?.currentMedicines?.length > 0 && <div><dt>Current medicines</dt><dd>{pObj.currentMedicines.join(', ')}</dd></div>}
                  <div><dt>Payment</dt><dd><StatusBadge status={a.paymentStatus} size="sm" /></dd></div>
                </dl>
                {patient && <Link to={`/doctor/patients/${patient._id}`} className="small">View patient</Link>}
              </section>

              <section className="card stack">
                <h3>Actions</h3>
                <div className="row gap-sm wrap">
                  {st === 'PENDING' && <><button className="btn btn-primary" disabled={busy} onClick={() => setStatus('CONFIRMED', 'Appointment accepted')}>Accept</button><button className="btn btn-danger-outline" disabled={busy} onClick={() => setStatus('CANCELLED', 'Appointment declined')}>Decline</button></>}
                  {['CONFIRMED', 'RESCHEDULED'].includes(st) && <button className="btn btn-primary" disabled={busy} onClick={() => run(() => startConsultation(id), 'Consultation started')}>Start consultation</button>}
                  {st === 'IN_PROGRESS' && <button className="btn btn-primary" disabled={busy} onClick={() => setStatus('COMPLETED', 'Consultation completed')}>Mark completed</button>}
                  {['CONFIRMED', 'RESCHEDULED'].includes(st) && <button className="btn btn-secondary" disabled={busy} onClick={() => setStatus('NO_SHOW', 'Marked as no-show')}>No-show</button>}
                </div>
                <div className="row gap-sm wrap">
                  {['IN_PROGRESS', 'COMPLETED'].includes(st) && <Link className="btn btn-secondary" to={`/doctor/prescriptions/new?appointmentId=${a._id}`}><ClipboardPlus size={16} /> Write prescription</Link>}
                  <button className="btn btn-secondary" disabled={busy || st === 'CANCELLED'} onClick={openChat}><MessageSquare size={16} /> Chat</button>
                  {a.consultationType === 'VIDEO' && st !== 'CANCELLED' && <button className="btn btn-secondary" disabled={busy} onClick={openVideo}><Video size={16} /> Video room</button>}
                  <Link className="btn btn-secondary" to="/doctor/follow-ups">Schedule Follow-up</Link>
                  <Link className="btn btn-secondary" to="/doctor/referrals">Specialist Referral</Link>
                  <Link className="btn btn-secondary" to="/doctor/ai-copilot">AI Copilot</Link>
                </div>
                <FormError error={err} />
              </section>
            </div>

            <section className="card stack">
              <div className="row between wrap gap-sm"><h3>Notes</h3>{!editing && <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Edit all notes</button>}</div>
              {editing ? (
                <>
                  <p className="muted small">Saving replaces the existing notes. To add without overwriting, use “Add note”.</p>
                  <textarea className="input" rows={6} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} aria-label="Consultation notes" />
                  <div className="row gap-sm"><button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(async () => { await updateConsultation(id, { notes: editNotes }); setEditing(false); }, 'Notes saved')}>Save</button><button className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); setEditNotes(a.notes || ''); }}>Cancel</button></div>
                </>
              ) : <p style={{ whiteSpace: 'pre-wrap' }} className={a.notes ? '' : 'muted'}>{a.notes || 'No notes yet. The patient’s booking note (if any) appears here once added.'}</p>}
              <Field label="Add note" htmlFor="nn" hint="Appended on a new line. Include follow-up instructions here.">
                <textarea id="nn" className="input" rows={3} value={newNote} onChange={(e) => setNewNote(e.target.value)} />
              </Field>
              <div><button className="btn btn-secondary btn-sm" disabled={busy || !newNote.trim()} onClick={() => run(async () => { await addConsultationNotes(id, newNote.trim()); setNewNote(''); }, 'Note added')}>Add note</button></div>
            </section>

            <section className="card stack">
              <div className="row between wrap gap-sm"><h3>Consultation summary</h3><button className="btn btn-secondary btn-sm" disabled={sumBusy} onClick={summarise}><Sparkles size={15} /> {sumBusy ? 'Generating…' : 'Generate AI summary'}</button></div>
              <p className="muted small">A structured pre-consultation summary of the patient's reported information and your notes. It supports — never replaces — your clinical judgement.</p>
              <FormError error={sumErr} />
              {summary && <AIResult result={summary} variant="report" />}
            </section>
          </>
        )}
      </DataState>
    </div>
  );
}
