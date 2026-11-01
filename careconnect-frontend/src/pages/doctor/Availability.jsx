import { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import DataState from '../../components/common/DataState';
import FormError from '../../components/common/FormError';
import EmptyState from '../../components/ui/EmptyState';
import { useAsync } from '../../hooks/useAsync';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/AppContext';
import { findMyDoctorProfile, updateMyAvailability } from '../../services/doctorService';
import { DAYS } from '../../constants';

// PATCH /api/doctors/me/availability { availability:[{ dayOfWeek(0=Sun), startTime, endTime, slotDurationMinutes }] } — replaces the schedule.
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

function validate(rows) {
  const errs = [];
  rows.forEach((r, i) => {
    if (!r.startTime || !r.endTime) errs.push(`Row ${i + 1}: set a start and end time.`);
    else if (toMin(r.endTime) <= toMin(r.startTime)) errs.push(`${DAYS[r.dayOfWeek]}: end time must be after the start time.`);
    else if (!(r.slotDurationMinutes >= 5)) errs.push(`${DAYS[r.dayOfWeek]}: slot length must be at least 5 minutes.`);
    else if (toMin(r.endTime) - toMin(r.startTime) < r.slotDurationMinutes) errs.push(`${DAYS[r.dayOfWeek]}: the window is shorter than one slot.`);
  });
  for (let d = 0; d < 7; d++) {
    const day = rows.filter((r) => r.dayOfWeek === d && r.startTime && r.endTime).sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
    for (let i = 1; i < day.length; i++) if (toMin(day[i].startTime) < toMin(day[i - 1].endTime)) errs.push(`${DAYS[d]}: time windows overlap.`);
  }
  return errs;
}

export default function Availability() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => findMyDoctorProfile(user.id), [user?.id]);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [saveErr, setSaveErr] = useState(null);
  const [problems, setProblems] = useState([]);
  useEffect(() => { if (data) setRows((data.availability || []).map((r) => ({ ...r }))); }, [data]);

  const upd = (i, k, v) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const add = () => setRows((rs) => [...rs, { dayOfWeek: 1, startTime: '09:00', endTime: '13:00', slotDurationMinutes: 20 }]);

  const save = async () => {
    const errs = validate(rows); setProblems(errs);
    if (errs.length) return;
    setBusy(true); setSaveErr(null);
    try { await updateMyAvailability(rows.map((r) => ({ dayOfWeek: Number(r.dayOfWeek), startTime: r.startTime, endTime: r.endTime, slotDurationMinutes: Number(r.slotDurationMinutes) }))); toast.success('Availability updated'); reload(); }
    catch (e) { setSaveErr(e); } finally { setBusy(false); }
  };

  return (
    <div className="stack-lg">
      <PageHeader title="Availability" subtitle="Your recurring weekly schedule. Patients can book open slots inside these windows." actions={<button className="btn btn-primary" onClick={save} disabled={busy || !data}><Save size={16} /> {busy ? 'Saving…' : 'Save schedule'}</button>} />
      <DataState loading={loading} error={error} data={data === null && !loading && !error ? false : data} onRetry={reload}>
        {data === null ? <div className="card"><EmptyState title="No doctor profile found" message="Your account isn't linked to a doctor profile yet, or it is inactive. Contact an administrator." /></div> : (
          <section className="card stack">
            {rows.length === 0 && <p className="muted">No weekly hours set — patients cannot book you until you add some.</p>}
            {rows.map((r, i) => (
              <div key={i} className="avail-row">
                <label><span className="sr-only">Day</span><select className="select" value={r.dayOfWeek} onChange={(e) => upd(i, 'dayOfWeek', Number(e.target.value))}>{DAYS.map((d, k) => <option key={d} value={k}>{d}</option>)}</select></label>
                <label><span className="sr-only">Start</span><input type="time" className="input" value={r.startTime} onChange={(e) => upd(i, 'startTime', e.target.value)} /></label>
                <span className="muted">to</span>
                <label><span className="sr-only">End</span><input type="time" className="input" value={r.endTime} onChange={(e) => upd(i, 'endTime', e.target.value)} /></label>
                <label className="row gap-xs"><input type="number" min="5" step="5" className="input input-sm" value={r.slotDurationMinutes} onChange={(e) => upd(i, 'slotDurationMinutes', Number(e.target.value))} aria-label="Slot minutes" /><span className="muted small">min</span></label>
                <button type="button" className="icon-btn" onClick={() => setRows((rs) => rs.filter((_, k) => k !== i))} aria-label="Remove window"><Trash2 size={16} /></button>
              </div>
            ))}
            <div><button type="button" className="btn btn-secondary btn-sm" onClick={add}><Plus size={15} /> Add window</button></div>
            {problems.length > 0 && <div className="form-error" role="alert"><ul>{problems.map((p) => <li key={p}>{p}</li>)}</ul></div>}
            <FormError error={saveErr} />
          </section>
        )}
      </DataState>
    </div>
  );
}
