import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarClock, CreditCard, MessageSquare, Video, XCircle } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import Field from '../../components/ui/Field';
import DatePicker from '../../components/ui/DatePicker';
import TimeSlotPicker from '../../components/ui/TimeSlotPicker';
import DataState from '../../components/common/DataState';
import FormError from '../../components/common/FormError';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { doctorDisplayName } from '../../components/doctors/DoctorCard';
import { useAsync } from '../../hooks/useAsync';
import { usePayment } from '../../hooks/usePayment';
import { useDoctorDirectory } from '../../hooks/useDoctorDirectory';
import { cancelAppointment, getAppointment, rescheduleAppointment } from '../../services/appointmentService';
import { createConversation } from '../../services/chatService';
import { createVideoSession } from '../../services/videoService';
import { getAvailability } from '../../services/doctorService';
import { useConfirm, useToast } from '../../context/AppContext';
import { formatCurrency, formatDate, formatTimeRange, refId, todayISO } from '../../utils/format';
import { useNavigate } from 'react-router-dom';

export default function AppointmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { pay, busy: paying, error: payError } = usePayment();
  const { data: a, loading, error, reload } = useAsync(() => getAppointment(id), [id]);
  const { getDoctor } = useDoctorDirectory();
  const [resched, setResched] = useState(false);
  const [busy, setBusy] = useState(false);

  const doctor = a ? (getDoctor(a.doctorId) || (typeof a.doctorId === 'object' ? a.doctorId : null)) : null;
  const dName = doctor ? doctorDisplayName(doctor) : (a?.doctorId ? doctorName(a.doctorId) : 'Your doctor');
  const active = a && ['PENDING', 'CONFIRMED', 'RESCHEDULED'].includes(a.status);
  const fee = doctor?.consultationFee;

  const cancel = async () => {
    if (!(await confirm({ title: 'Cancel this appointment?', message: 'The time slot will be released. Refunds are handled outside this app.', confirmLabel: 'Cancel appointment', tone: 'danger' }))) return;
    setBusy(true);
    try { await cancelAppointment(id); toast.success('Appointment cancelled'); reload(); } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const openChat = async () => {
    setBusy(true);
    try { const c = await createConversation(id); navigate(`/patient/chat?c=${c._id}`); } catch (e) { toast.error(e.message); setBusy(false); }
  };
  const openVideo = async () => {
    setBusy(true);
    try { const s = await createVideoSession(id); navigate(`/patient/video/${s.id}`, { state: { appointmentId: id } }); } catch (e) { toast.error(e.message); setBusy(false); }
  };

  return (
    <div className="stack-lg">
      <DataState loading={loading} error={error} data={a} onRetry={reload}>
        {a && (
          <>
            <PageHeader title={`Appointment with ${dName}`} subtitle={`${formatDate(a.date)} · ${formatTimeRange(a.startTime, a.endTime)}`} actions={<StatusBadge status={a.status} />} />
            <div className="grid grid-2 align-start">
              <section className="card">
                <h3>Details</h3>
                <dl className="summary">
                  <div><dt>Doctor</dt><dd>{dName}{doctor?.specialization ? ` · ${doctor.specialization}` : ''}</dd></div>
                  <div><dt>Department</dt><dd>{a.departmentId?.name || doctor?.departmentId?.name || '—'}</dd></div>
                  <div><dt>Hospital</dt><dd>{a.hospitalId?.name || '—'}</dd></div>
                  <div><dt>Type</dt><dd>{String(a.consultationType).replace('_', ' ').toLowerCase()}</dd></div>
                  <div><dt>Payment</dt><dd><StatusBadge status={a.paymentStatus} size="sm" /> {fee != null && <span className="muted"> {formatCurrency(fee)}</span>}</dd></div>
                  {a.notes && <div><dt>Notes</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{a.notes}</dd></div>}
                </dl>
              </section>
              <section className="card stack">
                <h3>Actions</h3>
                {a.paymentStatus !== 'PAID' && active && (
                  <>
                    <button type="button" className="btn btn-primary" disabled={paying} onClick={() => pay({ type: 'APPOINTMENT', referenceId: a._id, description: `Consultation with ${dName}`, returnTo: `/patient/appointments/${a._id}` })}>
                      <CreditCard size={16} /> {paying ? 'Opening payment…' : 'Pay to confirm'}
                    </button>
                    {payError && <div className="field-error">{payError.message}</div>}
                  </>
                )}
                {active && a.paymentStatus === 'PAID' && a.consultationType === 'VIDEO' && (
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={openVideo}><Video size={16} /> Open video consultation</button>
                )}
                {a.status !== 'CANCELLED' && <button type="button" className="btn btn-secondary" disabled={busy} onClick={openChat}><MessageSquare size={16} /> Chat with doctor</button>}
                {active && <button type="button" className="btn btn-secondary" onClick={() => setResched(true)}><CalendarClock size={16} /> Reschedule</button>}
                {active && <button type="button" className="btn btn-danger-outline" disabled={busy} onClick={cancel}><XCircle size={16} /> Cancel appointment</button>}
                {['COMPLETED'].includes(a.status) && (
                  <>
                    <Link className="btn btn-secondary" to="/patient/prescriptions">View prescriptions</Link>
                    <Link className="btn btn-secondary" to="/patient/follow-ups">Follow-up Tasks</Link>
                    <Link className="btn btn-secondary" to="/patient/report-comparison">Compare Lab Reports</Link>
                  </>
                )}
                {!active && a.status !== 'COMPLETED' && <p className="muted small">No further actions for this appointment.</p>}
              </section>
            </div>
            <RescheduleModal open={resched} onClose={() => setResched(false)} appointment={a} doctorId={refId(a.doctorId)} onDone={() => { setResched(false); reload(); }} />
          </>
        )}
      </DataState>
    </div>
  );
}

function RescheduleModal({ open, onClose, appointment, doctorId, onDone }) {
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const [slot, setSlot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const slots = useAsync(() => (open ? getAvailability(doctorId, date) : Promise.resolve(null)), [open, date, doctorId]);

  const isPast = (s) => { if (date !== todayISO()) return false; const [h, m] = s.startTime.split(':').map(Number); const n = new Date(); return h * 60 + m <= n.getHours() * 60 + n.getMinutes(); };
  const save = async () => {
    setBusy(true); setError(null);
    try { await rescheduleAppointment(appointment._id, { date, startTime: slot.startTime, endTime: slot.endTime }); toast.success('Appointment rescheduled'); onDone(); }
    catch (e) { setError(e); setBusy(false); if (e.status === 409) slots.reload(); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Reschedule appointment" footer={<><button className="btn btn-ghost" onClick={onClose}>Close</button><button className="btn btn-primary" disabled={!slot || busy} onClick={save}>{busy ? 'Saving…' : 'Confirm new time'}</button></>}>
      <div className="stack">
        <Field label="New date" htmlFor="rdate"><DatePicker id="rdate" value={date} onChange={(v) => { setDate(v); setSlot(null); }} /></Field>
        {slots.loading ? <LoadingSpinner inline label="Checking availability…" /> : slots.data?.slots.length ? <TimeSlotPicker slots={slots.data.slots} selected={slot} onSelect={setSlot} isPast={isPast} /> : <p className="muted">No consultation hours on this day.</p>}
        <FormError error={error} />
      </div>
    </Modal>
  );
}
