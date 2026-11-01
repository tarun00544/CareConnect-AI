import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Save, Trash2 } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Field from '../../components/ui/Field';
import FormError from '../../components/common/FormError';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useAsync } from '../../hooks/useAsync';
import { useToast } from '../../context/AppContext';
import { getMyDoctorAppointments } from '../../services/doctorService';
import { createPrescription } from '../../services/prescriptionService';
import { createSchedule } from '../../services/reminderService';
import { formatDate, formatHHmm } from '../../utils/format';
import { patientNameOf } from './Dashboard';
import { rememberPrescription } from './Prescriptions';

const blank = () => ({ name: '', dosage: '', frequency: '', durationDays: '', notes: '', reminderTimes: '08:00, 20:00' });

// POST /api/prescriptions { appointmentId, medicines:[{name,dosage,frequency,durationDays,notes?}], instructions?, notes? }
export default function PrescriptionNew() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const appts = useAsync(() => getMyDoctorAppointments({ limit: 100 }), []);
  const [appointmentId, setAppointmentId] = useState(params.get('appointmentId') || '');
  const [meds, setMeds] = useState([blank()]);
  const [instructions, setInstructions] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const eligible = (appts.data?.items || []).filter((a) => !['CANCELLED', 'NO_SHOW'].includes(a.status));
  const upd = (i, k, v) => setMeds((m) => m.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));
  const ok = appointmentId && meds.length > 0 && meds.every((m) => m.name.trim() && m.dosage.trim() && m.frequency.trim() && Number(m.durationDays) > 0);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const p = await createPrescription({
        appointmentId,
        medicines: meds.map((m) => ({ name: m.name.trim(), dosage: m.dosage.trim(), frequency: m.frequency.trim(), durationDays: Number(m.durationDays), ...(m.notes.trim() ? { notes: m.notes.trim() } : {}) })),
        instructions: instructions.trim(), notes: notes.trim(),
      });

      // Auto-schedule medicine reminders for patient
      for (const m of meds) {
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        const times = (m.reminderTimes || '08:00, 20:00')
          .split(',')
          .map((t) => t.trim())
          .filter((t) => timeRegex.test(t));

        const startDate = new Date();
        const duration = Number(m.durationDays) || 7;
        const endDate = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);

        await createSchedule({
          patientId: p.patientId?._id || p.patientId,
          prescriptionId: p._id,
          medicineName: m.name.trim(),
          dosage: m.dosage.trim(),
          prescribedInstructions: m.notes.trim() || `${m.dosage.trim()} ${m.frequency.trim()}`,
          startDate,
          endDate,
          reminderTimes: times.length > 0 ? times : ['08:00', '20:00'],
          refillReminder: { enabled: true, remindDaysBefore: 3 },
        }).catch((schedErr) => console.warn('Schedule creation notice:', schedErr));
      }

      rememberPrescription(p._id);
      toast.success('Prescription and medicine reminder schedule created');
      navigate(`/doctor/prescriptions/${p._id}`, { replace: true });
    } catch (err) { setError(err); setBusy(false); }
  };

  return (
    <div className="stack-lg">
      <PageHeader title="New prescription" />
      <form className="stack-lg" onSubmit={submit}>
        <section className="card stack">
          <Field label="Consultation" htmlFor="appt" required>
            {appts.loading ? <LoadingSpinner inline /> : (
              <select id="appt" className="select" value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)}>
                <option value="">Select an appointment…</option>
                {eligible.map((a) => <option key={a._id} value={a._id}>{patientNameOf(a)} — {formatDate(a.date)} {formatHHmm(a.startTime)} ({a.status.replace('_', ' ').toLowerCase()})</option>)}
              </select>
            )}
          </Field>
        </section>
        <section className="card stack">
          <h3>Medicines</h3>
          {meds.map((m, i) => (
            <div key={i} className="med-form">
              <Field label="Name" htmlFor={`mn${i}`} required><input id={`mn${i}`} className="input" value={m.name} onChange={(e) => upd(i, 'name', e.target.value)} /></Field>
              <Field label="Dosage" htmlFor={`md${i}`} required><input id={`md${i}`} className="input" placeholder="500mg" value={m.dosage} onChange={(e) => upd(i, 'dosage', e.target.value)} /></Field>
              <Field label="Frequency" htmlFor={`mf${i}`} required><input id={`mf${i}`} className="input" placeholder="twice daily" value={m.frequency} onChange={(e) => upd(i, 'frequency', e.target.value)} /></Field>
              <Field label="Days" htmlFor={`mdu${i}`} required><input id={`mdu${i}`} type="number" min="1" className="input" value={m.durationDays} onChange={(e) => upd(i, 'durationDays', e.target.value)} /></Field>
              <Field label="Reminder Times" htmlFor={`mrt${i}`} hint="e.g. 08:00, 20:00"><input id={`mrt${i}`} className="input" placeholder="08:00, 20:00" value={m.reminderTimes} onChange={(e) => upd(i, 'reminderTimes', e.target.value)} /></Field>
              <Field label="Notes" htmlFor={`mno${i}`}><input id={`mno${i}`} className="input" value={m.notes} onChange={(e) => upd(i, 'notes', e.target.value)} /></Field>
              <button type="button" className="icon-btn med-remove" disabled={meds.length === 1} onClick={() => setMeds((x) => x.filter((_, k) => k !== i))} aria-label={`Remove medicine ${i + 1}`}><Trash2 size={16} /></button>
            </div>
          ))}
          <div><button type="button" className="btn btn-secondary btn-sm" onClick={() => setMeds((m) => [...m, blank()])}><Plus size={15} /> Add medicine</button></div>
        </section>
        <section className="card stack">
          <Field label="Instructions for the patient" htmlFor="ins"><textarea id="ins" className="input" rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} /></Field>
          <Field label="Notes" htmlFor="pn"><textarea id="pn" className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <FormError error={error} />
          <div><button type="submit" className="btn btn-primary" disabled={!ok || busy}><Save size={16} /> {busy ? 'Saving…' : 'Create prescription'}</button></div>
        </section>
      </form>
    </div>
  );
}
