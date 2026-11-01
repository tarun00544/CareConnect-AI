import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, CreditCard } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Field from '../../components/ui/Field';
import DatePicker from '../../components/ui/DatePicker';
import TimeSlotPicker from '../../components/ui/TimeSlotPicker';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import FormError from '../../components/common/FormError';
import { doctorDisplayName } from '../../components/doctors/DoctorCard';
import { useAsync } from '../../hooks/useAsync';
import { usePayment } from '../../hooks/usePayment';
import { listDepartments } from '../../services/departmentService';
import { listDoctors, getDoctor, getAvailability } from '../../services/doctorService';
import { createAppointment } from '../../services/appointmentService';
import { CONSULTATION_TYPES } from '../../constants';
import { formatCurrency, formatDate, formatTimeRange, todayISO } from '../../utils/format';
import { useToast } from '../../context/AppContext';

const STEPS = ['Department', 'Doctor', 'Date & time', 'Details', 'Summary'];

/**
 * Flow: Department → Doctor → Date → Available time → Type → Notes → Summary → Payment → Confirmation.
 * Request body matches createAppointmentValidator: { doctorId, date(ISO8601), startTime, endTime, consultationType, notes }.
 * The appointment is created PENDING first, then paid via Razorpay; the backend flips it to CONFIRMED on verification.
 */
export default function BookAppointment() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const preDoctorId = params.get('doctorId');
  const { pay, busy: paying, error: payError } = usePayment();

  const [step, setStep] = useState(0);
  const [deptId, setDeptId] = useState('');
  const [doctor, setDoctor] = useState(null);
  const [date, setDate] = useState(todayISO());
  const [slot, setSlot] = useState(null);
  const [type, setType] = useState('VIDEO');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);

  const depts = useAsync(() => listDepartments(), []);
  const docs = useAsync(() => (deptId ? listDoctors({ departmentId: deptId, limit: 100 }) : Promise.resolve(null)), [deptId]);
  const slots = useAsync(() => (doctor && date ? getAvailability(doctor._id, date) : Promise.resolve(null)), [doctor?._id, date]);

  // Deep link from a doctor profile: jump straight to date selection.
  useEffect(() => {
    if (!preDoctorId) return;
    getDoctor(preDoctorId).then((d) => {
      if (d.status !== 'ACTIVE') return;
      setDoctor(d); setDeptId(d.departmentId?._id || ''); setStep(2);
    }).catch(() => {});
  }, [preDoctorId]);

  useEffect(() => { setSlot(null); }, [doctor?._id, date]);
  // Keep the selected consultation type valid for the chosen doctor.
  useEffect(() => {
    const modes = doctor?.consultationModes;
    if (modes?.length && !modes.includes(type)) setType(modes[0]);
  }, [doctor, type]);

  const isPast = (s) => {
    if (date !== todayISO()) return false;
    const [h, m] = s.startTime.split(':').map(Number);
    const n = new Date();
    return h * 60 + m <= n.getHours() * 60 + n.getMinutes();
  };
  const openSlots = useMemo(() => (slots.data?.slots || []).filter((s) => s.available && !isPast(s)), [slots.data, date]); // eslint-disable-line react-hooks/exhaustive-deps

  const canNext = [!!deptId, !!doctor, !!slot, !!type, true][step];

  const submit = async () => {
    setSubmitting(true); setError(null);
    try {
      // Re-use an appointment we already created if the payment was dismissed and the user retries.
      const appt = created || (await createAppointment({ doctorId: doctor._id, date, startTime: slot.startTime, endTime: slot.endTime, consultationType: type, notes: notes.trim() }));
      setCreated(appt);
      setSubmitting(false);
      toast.info('Appointment requested — complete payment to confirm it.');
      await pay({ type: 'APPOINTMENT', referenceId: appt._id, description: `Consultation with ${doctorDisplayName(doctor)}`, returnTo: `/patient/appointments/${appt._id}` });
    } catch (e) {
      setError(e); setSubmitting(false);
      if (e.status === 409) { setSlot(null); setStep(2); slots.reload(); }
    }
  };

  return (
    <div className="stack-lg">
      <PageHeader title="Book an appointment" subtitle="Choose a department, doctor and an available time." />
      <ol className="stepper" aria-label="Booking progress">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? 'current' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>
            <span className="step-num">{i < step ? <Check size={14} /> : i + 1}</span><span className="step-label">{s}</span>
          </li>
        ))}
      </ol>

      <section className="card stack">
        {step === 0 && (
          <>
            <h3>Select a department</h3>
            {depts.loading ? <LoadingSpinner /> : depts.error ? <ErrorState error={depts.error} onRetry={depts.reload} compact /> : (
              <div className="choice-grid">
                {(depts.data || []).map((d) => (
                  <button key={d._id} type="button" className={`choice ${deptId === d._id ? 'active' : ''}`} onClick={() => { setDeptId(d._id); setDoctor(null); }} aria-pressed={deptId === d._id}>
                    <strong>{d.name}</strong><span className="muted small">{d.hospitalId?.name}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <h3>Select a doctor</h3>
            {docs.loading ? <LoadingSpinner /> : docs.error ? <ErrorState error={docs.error} onRetry={docs.reload} compact /> : !docs.data?.items.length ? (
              <EmptyState compact title="No doctors in this department" message="Go back and choose another department." />
            ) : (
              <div className="choice-grid">
                {docs.data.items.map((d) => (
                  <button key={d._id} type="button" className={`choice ${doctor?._id === d._id ? 'active' : ''}`} onClick={() => setDoctor(d)} aria-pressed={doctor?._id === d._id}>
                    <strong>{doctorDisplayName(d)}</strong><span className="muted small">{d.specialization} · {d.experience ?? 0} yrs</span><span className="small">{formatCurrency(d.consultationFee)}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <h3>Pick a date and time {doctor && <span className="muted">with {doctorDisplayName(doctor)}</span>}</h3>
            <Field label="Date" htmlFor="date"><DatePicker id="date" value={date} onChange={setDate} /></Field>
            {slots.loading ? <LoadingSpinner label="Checking availability…" /> : slots.error ? <ErrorState error={slots.error} onRetry={slots.reload} compact /> :
              !slots.data?.slots.length ? <EmptyState compact title="No consultation hours on this day" message="This doctor doesn't work on the selected weekday. Try another date." /> :
              openSlots.length === 0 ? <EmptyState compact title="Fully booked" message="All slots on this day are taken or have passed. Try another date." /> : null}
            {slots.data?.slots.length > 0 && <TimeSlotPicker slots={slots.data.slots} selected={slot} onSelect={setSlot} isPast={isPast} />}
          </>
        )}

        {step === 3 && (
          <>
            <h3>Consultation details</h3>
            <div className="choice-grid">
              {CONSULTATION_TYPES.filter((t) => !doctor?.consultationModes?.length || doctor.consultationModes.includes(t.value)).map((t) => (
                <button key={t.value} type="button" className={`choice ${type === t.value ? 'active' : ''}`} onClick={() => setType(t.value)} aria-pressed={type === t.value}>
                  <strong>{t.label}</strong><span className="muted small">{t.hint}</span>
                </button>
              ))}
            </div>
            <Field label="Notes for the doctor (optional)" htmlFor="notes" hint="Symptoms, questions or anything the doctor should know.">
              <textarea id="notes" className="input" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
            </Field>
          </>
        )}

        {step === 4 && doctor && slot && (
          <>
            <h3>Review and pay</h3>
            <dl className="summary">
              <div><dt>Doctor</dt><dd>{doctorDisplayName(doctor)} · {doctor.specialization}</dd></div>
              <div><dt>Hospital</dt><dd>{doctor.hospitalId?.name || '—'}</dd></div>
              <div><dt>Date</dt><dd>{formatDate(date)}</dd></div>
              <div><dt>Time</dt><dd>{formatTimeRange(slot.startTime, slot.endTime)}</dd></div>
              <div><dt>Type</dt><dd>{CONSULTATION_TYPES.find((t) => t.value === type)?.label}</dd></div>
              {notes && <div><dt>Notes</dt><dd>{notes}</dd></div>}
              <div className="summary-total"><dt>Consultation fee</dt><dd>{formatCurrency(doctor.consultationFee)}</dd></div>
            </dl>
            <p className="muted small">Your appointment is confirmed once payment is verified. If you close the payment window, you can pay later from the appointment page.</p>
            <FormError error={error} />
            {payError && !error && <div className="form-error" role="alert"><div>{payError.message}</div></div>}
            {created && <p className="small">Appointment requested. <Link to={`/patient/appointments/${created._id}`}>View it</Link> or retry payment below.</p>}
          </>
        )}

        <div className="row between wizard-nav">
          <button type="button" className="btn btn-ghost" disabled={step === 0 || submitting || paying} onClick={() => setStep((s) => s - 1)}><ChevronLeft size={16} /> Back</button>
          {step < 4 ? (
            <button type="button" className="btn btn-primary" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>Next <ChevronRight size={16} /></button>
          ) : (
            <button type="button" className="btn btn-primary btn-lg" disabled={submitting || paying || !slot} onClick={submit}>
              <CreditCard size={17} /> {submitting ? 'Requesting…' : paying ? 'Opening payment…' : created ? 'Retry payment' : `Confirm & pay ${formatCurrency(doctor?.consultationFee)}`}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
