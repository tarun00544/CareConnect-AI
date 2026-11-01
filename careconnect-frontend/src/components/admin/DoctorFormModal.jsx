import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, FileText, Plus, Trash2, X } from 'lucide-react';
import Modal from '../ui/Modal';
import Field from '../ui/Field';
import FileUploader from '../ui/FileUploader';
import FormError from '../common/FormError';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorState from '../ui/ErrorState';
import { useAsync } from '../../hooks/useAsync';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/AppContext';
import * as admin from '../../services/adminService';
import { getDoctorOptions } from '../../services/doctorService';
import { uploadProfileImage } from '../../services/uploadService';
import { ROLES, DAYS } from '../../constants';
import { formatBytes, formatDateTime, titleCase } from '../../utils/format';
import { getFieldErrors } from '../../utils/response';

const STEPS = ['Personal', 'Professional', 'Hospital', 'Schedule', 'Account & documents'];
const MODE_LABEL = { IN_PERSON: 'In-person', VIDEO: 'Video', AUDIO: 'Audio', CHAT: 'Chat' };
const DOC_LABEL = { REGISTRATION_CERTIFICATE: 'Medical registration certificate', QUALIFICATION_CERTIFICATE: 'Qualification certificate', OTHER: 'Other document' };
const DOC_ACCEPT = ['application/pdf', 'image/jpeg', 'image/png'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9][0-9\s-]{7,16}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

const EMPTY = {
  name: '', email: '', phone: '', profilePhotoUrl: '', dateOfBirth: '', gender: '',
  address: { line1: '', city: '', state: '', pincode: '' },
  professionalCategory: '', specialization: '', additionalSpecializations: [], departmentId: '', qualification: '',
  registration: { number: '', council: '', state: '' }, experience: '', bio: '', languages: [],
  hospitalId: '', consultationRoom: '', consultationModes: ['IN_PERSON', 'VIDEO'], appointmentDurationMinutes: 20,
  consultationFee: '', followUpFee: '', emergencyAvailable: false, onlineConsultationAvailable: true,
  availability: [], maxAppointmentsPerDay: '', bookingEnabled: true, leaveDates: [],
};

function fromDoctor(d) {
  return {
    ...EMPTY,
    name: d.userId?.name || '', email: d.userId?.email || '', phone: d.userId?.phone || '',
    profilePhotoUrl: d.profilePhotoUrl || '', dateOfBirth: d.dateOfBirth ? String(d.dateOfBirth).slice(0, 10) : '', gender: d.gender || '',
    address: { ...EMPTY.address, ...(d.address || {}) },
    professionalCategory: d.professionalCategory || '', specialization: d.specialization || '',
    additionalSpecializations: d.additionalSpecializations || [], departmentId: d.departmentId?._id || d.departmentId || '',
    qualification: d.qualification || '', registration: { ...EMPTY.registration, ...(d.registration || {}) },
    experience: d.experience ?? '', bio: d.bio || '', languages: d.languages || [],
    hospitalId: d.hospitalId?._id || d.hospitalId || '', consultationRoom: d.consultationRoom || '',
    consultationModes: d.consultationModes || [], appointmentDurationMinutes: d.appointmentDurationMinutes || 20,
    consultationFee: d.consultationFee ?? '', followUpFee: d.followUpFee ?? '',
    emergencyAvailable: !!d.emergencyAvailable, onlineConsultationAvailable: d.onlineConsultationAvailable !== false,
    availability: (d.availability || []).map((a) => ({ dayOfWeek: a.dayOfWeek, startTime: a.startTime, endTime: a.endTime, slotDurationMinutes: a.slotDurationMinutes || 20, breakStartTime: a.breakStartTime || '', breakEndTime: a.breakEndTime || '' })),
    maxAppointmentsPerDay: d.maxAppointmentsPerDay ?? '', bookingEnabled: d.bookingEnabled !== false, leaveDates: d.leaveDates || [],
  };
}

const fieldStep = (f) => {
  if (['name', 'email', 'phone', 'profilePhotoUrl', 'dateOfBirth', 'gender'].includes(f) || f.startsWith('address')) return 0;
  if (['professionalCategory', 'specialization', 'additionalSpecializations', 'qualification', 'experience', 'bio', 'languages'].includes(f) || f.startsWith('registration')) return 1;
  if (['hospitalId', 'departmentId', 'consultationRoom', 'consultationModes', 'appointmentDurationMinutes', 'consultationFee', 'followUpFee', 'emergencyAvailable', 'onlineConsultationAvailable'].includes(f)) return 2;
  if (['availability', 'maxAppointmentsPerDay', 'leaveDates', 'bookingEnabled'].includes(f)) return 3;
  return 4;
};

function validate(f, { options, isEdit, needsHospital }) {
  const e = {};
  const category = options.professionalCategories.find((c) => c.value === f.professionalCategory);
  if (f.name.trim().length < 2) e.name = 'Full name is required';
  if (!isEdit && !EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid email address';
  if (!PHONE_RE.test(f.phone.trim())) e.phone = 'Enter a valid phone number';
  if (f.address.pincode && !/^\d{6}$/.test(f.address.pincode)) e['address.pincode'] = 'PIN code must be 6 digits';
  if (f.dateOfBirth) {
    const age = (Date.now() - new Date(f.dateOfBirth).getTime()) / (365.25 * 864e5);
    if (!(age >= 18 && age <= 100)) e.dateOfBirth = 'Enter a valid date of birth (age 18–100)';
  }
  if (!category) e.professionalCategory = 'Select a professional category';
  if (!f.specialization) e.specialization = 'Select a primary specialization';
  if (f.qualification.trim().length < 2) e.qualification = 'Qualifications are required';
  if (category?.registrationRequired) {
    if (!f.registration.number.trim()) e['registration.number'] = 'Registration number is required';
    if (!f.registration.council.trim()) e['registration.council'] = 'Registration council is required';
    if (!f.registration.state.trim()) e['registration.state'] = 'Registration state is required';
  }
  if (f.experience === '' || Number(f.experience) < 0 || Number(f.experience) > 70) e.experience = 'Enter years of experience (0–70)';
  if (needsHospital && !f.hospitalId) e.hospitalId = 'Select a hospital';
  if (!f.departmentId) e.departmentId = 'Select a department';
  if (f.consultationFee === '' || Number(f.consultationFee) < 0) e.consultationFee = 'Enter a fee of 0 or more';
  if (f.followUpFee !== '' && Number(f.followUpFee) < 0) e.followUpFee = 'Follow-up fee cannot be negative';
  if (!f.consultationModes.length) e.consultationModes = 'Choose at least one consultation mode';
  else if (!f.onlineConsultationAvailable && f.consultationModes.some((m) => m !== 'IN_PERSON')) e.consultationModes = 'Online consultation is switched off — only in-person can be offered';
  const dur = Number(f.appointmentDurationMinutes);
  if (!(dur >= 5 && dur <= 240)) e.appointmentDurationMinutes = 'Duration must be 5–240 minutes';
  if (f.maxAppointmentsPerDay !== '' && !(Number.isInteger(Number(f.maxAppointmentsPerDay)) && Number(f.maxAppointmentsPerDay) >= 1)) e.maxAppointmentsPerDay = 'Enter a whole number of 1 or more';
  const probs = [];
  f.availability.forEach((w, i) => {
    const n = `Window ${i + 1}`;
    if (!TIME_RE.test(w.startTime) || !TIME_RE.test(w.endTime)) probs.push(`${n}: set start and end time`);
    else if (toMin(w.endTime) <= toMin(w.startTime)) probs.push(`${n}: end time must be after start time`);
    else {
      if (toMin(w.endTime) - toMin(w.startTime) < Number(w.slotDurationMinutes || dur)) probs.push(`${n}: window is shorter than one slot`);
      if (!!w.breakStartTime !== !!w.breakEndTime) probs.push(`${n}: set both break times or neither`);
      else if (w.breakStartTime) {
        if (toMin(w.breakEndTime) <= toMin(w.breakStartTime)) probs.push(`${n}: break end must be after break start`);
        else if (toMin(w.breakStartTime) < toMin(w.startTime) || toMin(w.breakEndTime) > toMin(w.endTime)) probs.push(`${n}: break must be inside the working hours`);
      }
    }
  });
  for (let d = 0; d < 7; d += 1) {
    const day = f.availability.filter((w) => w.dayOfWeek === d && TIME_RE.test(w.startTime) && TIME_RE.test(w.endTime)).sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
    for (let i = 1; i < day.length; i += 1) if (toMin(day[i].startTime) < toMin(day[i - 1].endTime)) { probs.push(`${DAYS[d]} has overlapping windows`); break; }
  }
  if (probs.length) e.availability = [...new Set(probs)].join(' · ');
  return e;
}

function buildPayload(f, { isEdit, needsHospital }) {
  const num = (v) => (v === '' || v === null ? undefined : Number(v));
  const p = {
    name: f.name.trim(), phone: f.phone.trim(),
    dateOfBirth: f.dateOfBirth || undefined, gender: f.gender || undefined,
    address: f.address,
    professionalCategory: f.professionalCategory, specialization: f.specialization,
    additionalSpecializations: f.additionalSpecializations, departmentId: f.departmentId,
    qualification: f.qualification.trim(), registration: f.registration,
    experience: num(f.experience), bio: f.bio, languages: f.languages,
    consultationRoom: f.consultationRoom, consultationModes: f.consultationModes,
    appointmentDurationMinutes: num(f.appointmentDurationMinutes), consultationFee: num(f.consultationFee),
    followUpFee: f.followUpFee === '' ? undefined : Number(f.followUpFee),
    emergencyAvailable: f.emergencyAvailable, onlineConsultationAvailable: f.onlineConsultationAvailable,
    availability: f.availability.map((w) => ({ ...w, slotDurationMinutes: Number(w.slotDurationMinutes || f.appointmentDurationMinutes), breakStartTime: w.breakStartTime || undefined, breakEndTime: w.breakEndTime || undefined })),
    maxAppointmentsPerDay: f.maxAppointmentsPerDay === '' ? (isEdit ? null : undefined) : Number(f.maxAppointmentsPerDay),
    bookingEnabled: f.bookingEnabled, leaveDates: f.leaveDates,
  };
  if (f.profilePhotoUrl) p.profilePhotoUrl = f.profilePhotoUrl;
  if (!isEdit) p.email = f.email.trim();
  // hospitalId is only sent by super admins; for hospital admins the server derives it from the session.
  if (needsHospital) p.hospitalId = f.hospitalId;
  return p;
}

function Chips({ options, value, onToggle, label }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button key={o.value} type="button" className={`chip chip-btn ${on ? 'chip-on' : ''}`} aria-pressed={on} onClick={() => onToggle(o.value)}>
            {on && <Check size={13} aria-hidden="true" />} {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function DoctorFormModal({ open, onClose, doctor, onSaved }) {
  const { role } = useAuth();
  const toast = useToast();
  const isEdit = !!doctor;
  const needsHospital = role === ROLES.SUPER_ADMIN && !isEdit;

  const opts = useAsync(() => getDoctorOptions(), []);
  const [form, setForm] = useState(EMPTY);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [queue, setQueue] = useState([]); // documents to upload after the doctor is created
  const [queueType, setQueueType] = useState('REGISTRATION_CERTIFICATE');
  const [queueError, setQueueError] = useState('');
  const [result, setResult] = useState(null); // success panel after create
  const [newDept, setNewDept] = useState('');
  const [leaveInput, setLeaveInput] = useState('');
  const submitting = useRef(false);

  const ctx = useAsync(() => admin.getDoctorFormContext(form.hospitalId || undefined), [open, form.hospitalId]);

  useEffect(() => {
    if (!open) return;
    setForm(doctor ? fromDoctor(doctor) : EMPTY);
    setStep(0); setErrors({}); setFormError(null); setQueue([]); setResult(null); setBusy(false); setNewDept(''); setLeaveInput('');
    submitting.current = false;
  }, [open, doctor]);

  // Hospital admins have exactly one hospital; pre-select it for display.
  useEffect(() => {
    if (ctx.data?.fixedHospital && ctx.data.hospitals[0] && !form.hospitalId) setForm((f) => ({ ...f, hospitalId: ctx.data.hospitals[0]._id }));
  }, [ctx.data, form.hospitalId]);

  const options = opts.data;
  const category = options?.professionalCategories.find((c) => c.value === form.professionalCategory);
  const specs = useMemo(() => (options?.specializations || []).filter((s) => !category || s.categories.includes(category.value)), [options, category]);
  const departments = ctx.data?.departments || [];
  const suggestions = useMemo(() => (options?.departmentSuggestions?.[form.specialization] || []).filter((n) => !departments.some((d) => d.name.toLowerCase() === n.toLowerCase())), [options, form.specialization, departments]);

  const set = (path, value) => {
    setForm((f) => {
      const next = { ...f };
      if (path.includes('.')) { const [a, b] = path.split('.'); next[a] = { ...f[a], [b]: value }; } else next[path] = value;
      if (path === 'professionalCategory') { next.specialization = ''; next.additionalSpecializations = []; }
      if (path === 'hospitalId') next.departmentId = '';
      return next;
    });
    setErrors((e) => { if (!e[path]) return e; const { [path]: _drop, ...rest } = e; return rest; });
  };
  const toggle = (path, v) => set(path, form[path].includes(v) ? form[path].filter((x) => x !== v) : [...form[path], v]);
  const err = (k) => errors[k];

  const updateWindow = (i, patch) => { setForm((f) => ({ ...f, availability: f.availability.map((w, idx) => (idx === i ? { ...w, ...patch } : w)) })); setErrors((e) => { const { availability: _a, ...rest } = e; return rest; }); };
  const addWindow = (day = 1) => setForm((f) => ({ ...f, availability: [...f.availability, { dayOfWeek: day, startTime: '09:00', endTime: '13:00', slotDurationMinutes: Number(f.appointmentDurationMinutes) || 20, breakStartTime: '', breakEndTime: '' }] }));
  const quickWeek = () => setForm((f) => ({ ...f, availability: [1, 2, 3, 4, 5].map((d) => ({ dayOfWeek: d, startTime: '09:00', endTime: '17:00', slotDurationMinutes: Number(f.appointmentDurationMinutes) || 20, breakStartTime: '13:00', breakEndTime: '14:00' })) }));

  const createDept = async () => {
    const name = newDept.trim();
    if (name.length < 2) return;
    try {
      await admin.createDepartment({ name, hospitalId: needsHospital ? form.hospitalId : undefined });
      setNewDept('');
      const fresh = await ctx.reload();
      const hit = fresh?.departments.find((d) => d.name.toLowerCase() === name.toLowerCase());
      if (hit) set('departmentId', hit._id);
      toast.success(`Department “${name}” added to this hospital.`);
    } catch (e) { toast.error(e.message); }
  };

  const addQueued = (file) => {
    setQueueError('');
    if (!file) return;
    if (!DOC_ACCEPT.includes(file.type)) return setQueueError('Only PDF, JPEG or PNG documents are accepted.');
    if (file.size > 10 * 1024 * 1024) return setQueueError('File is too large (max 10 MB).');
    if (queue.length >= 10) return setQueueError('You can attach up to 10 documents.');
    setQueue((q) => [...q, { id: `${Date.now()}-${q.length}`, type: queueType, file }]);
  };

  const goTo = (n) => setStep(Math.max(0, Math.min(STEPS.length - 1, n)));

  const next = () => {
    const all = validate(form, { options, isEdit, needsHospital });
    const here = Object.keys(all).filter((k) => fieldStep(k) === step);
    if (here.length) { setErrors((e) => ({ ...e, ...Object.fromEntries(here.map((k) => [k, all[k]])) })); return; }
    goTo(step + 1);
  };

  const submit = async (ev) => {
    ev?.preventDefault();
    if (submitting.current) return; // guards against double-submits
    const all = validate(form, { options, isEdit, needsHospital });
    const keys = Object.keys(all);
    if (keys.length) {
      setErrors(all);
      setFormError({ message: 'Please fix the highlighted fields.', details: [] });
      goTo(Math.min(...keys.map(fieldStep)));
      return;
    }
    submitting.current = true; setBusy(true); setFormError(null);
    try {
      const payload = buildPayload(form, { isEdit, needsHospital });
      if (isEdit) {
        await admin.updateDoctor(doctor._id, payload);
        toast.success('Doctor updated successfully.');
        onSaved?.();
        onClose();
        return;
      }
      const created = await admin.createDoctor(payload);
      const failures = [];
      for (const q of queue) {
        try { await admin.uploadDoctorDocument(created.doctor._id, q.file, { type: q.type, title: q.file.name }); } catch (e) { failures.push(`${q.file.name}: ${e.message}`); }
      }
      toast.success('Doctor created. Share the invitation link so they can set a password.');
      setResult({ ...created, failures });
      onSaved?.();
    } catch (e) {
      // keep everything the admin typed; map server validation to fields
      const fe = getFieldErrors(e);
      setErrors(fe);
      setFormError(e);
      const keys = Object.keys(fe);
      if (keys.length) goTo(Math.min(...keys.map(fieldStep)));
    } finally {
      submitting.current = false; setBusy(false);
    }
  };

  const copy = async (text) => { try { await navigator.clipboard.writeText(text); toast.success('Invitation link copied.'); } catch { toast.info('Select the link and copy it manually.'); } };

  /* -------- success panel -------- */
  if (open && result) {
    return (
      <Modal open onClose={onClose} title="Doctor created" size="md" footer={<button type="button" className="btn btn-primary" onClick={onClose}>Done</button>}>
        <div className="stack">
          <p><strong>{form.name}</strong> was added. Their account stays inactive until they accept the invitation, after which you can verify their documents and activate them.</p>
          <Field label="One-time invitation link" hint={`Expires ${formatDateTime(result.invitation.expiresAt)}. It is shown only now — use “Resend invitation” on the doctor if it is lost.`}>
            <div className="input-group">
              <input className="input" readOnly value={result.invitation.inviteUrl} onFocus={(e) => e.target.select()} aria-label="Invitation link" />
              <button type="button" className="icon-btn" onClick={() => copy(result.invitation.inviteUrl)} aria-label="Copy invitation link"><Copy size={16} /></button>
            </div>
          </Field>
          <p className="muted small">Email delivery is not configured in this project, so send this link to the doctor yourself over a trusted channel.</p>
          {result.failures?.length > 0 && (
            <div className="form-error" role="alert"><div><strong>Some documents could not be uploaded</strong><ul>{result.failures.map((f) => <li key={f}>{f}</li>)}</ul><span>You can add them from the doctor&apos;s details.</span></div></div>
          )}
        </div>
      </Modal>
    );
  }

  const footer = (
    <>
      <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
      {step > 0 && <button type="button" className="btn btn-secondary" onClick={() => goTo(step - 1)} disabled={busy}><ChevronLeft size={15} /> Back</button>}
      {step < STEPS.length - 1
        ? <button type="button" className="btn btn-primary" onClick={next} disabled={busy}>Next <ChevronRight size={15} /></button>
        : <button type="submit" form="doctor-form" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create doctor'}</button>}
    </>
  );

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} dismissible={!busy} title={isEdit ? 'Edit doctor' : 'Add doctor'} size="xl" footer={footer}>
      {opts.loading || (ctx.loading && !ctx.data) ? <LoadingSpinner label="Loading form…" /> : opts.error ? <ErrorState error={opts.error} onRetry={opts.reload} compact /> : (
        <form id="doctor-form" onSubmit={submit} noValidate className="stack">
          <ol className="stepper stepper-scroll" aria-label="Form sections">
            {STEPS.map((s, i) => (
              <li key={s} className={i === step ? 'current' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>
                <button type="button" className="step-btn" onClick={() => goTo(i)}><span className="step-num">{i < step ? <Check size={14} /> : i + 1}</span><span className="step-label">{s}</span></button>
              </li>
            ))}
          </ol>
          <FormError error={formError} />

          {step === 0 && (
            <section className="form-grid" aria-label="Personal information">
              <Field label="Full name" htmlFor="d-name" required error={err('name')}><input id="d-name" className="input" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={100} autoComplete="off" /></Field>
              <Field label="Email address" htmlFor="d-email" required error={err('email')} hint={isEdit ? 'The login email can only be changed by a Super Admin.' : 'Used as the doctor’s login.'}>
                <input id="d-email" type="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} disabled={isEdit} autoComplete="off" />
              </Field>
              <Field label="Phone number" htmlFor="d-phone" required error={err('phone')}><input id="d-phone" type="tel" className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98765 43210" /></Field>
              <Field label="Date of birth" htmlFor="d-dob" error={err('dateOfBirth')}><input id="d-dob" type="date" className="input" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} max={new Date().toISOString().slice(0, 10)} /></Field>
              <Field label="Gender" htmlFor="d-gender" error={err('gender')}>
                <select id="d-gender" className="select" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                  <option value="">Prefer not to say</option><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="OTHER">Other</option>
                </select>
              </Field>
              <Field label="Address" htmlFor="d-addr" className="span-2"><input id="d-addr" className="input" value={form.address.line1} onChange={(e) => set('address.line1', e.target.value)} /></Field>
              <Field label="City" htmlFor="d-city"><input id="d-city" className="input" value={form.address.city} onChange={(e) => set('address.city', e.target.value)} /></Field>
              <Field label="State" htmlFor="d-state"><input id="d-state" className="input" value={form.address.state} onChange={(e) => set('address.state', e.target.value)} /></Field>
              <Field label="PIN code" htmlFor="d-pin" error={err('address.pincode')}><input id="d-pin" className="input" inputMode="numeric" maxLength={6} value={form.address.pincode} onChange={(e) => set('address.pincode', e.target.value.replace(/\D/g, ''))} /></Field>
              <div className="field span-2">
                <label>Profile photo <span className="muted">(optional)</span></label>
                {form.profilePhotoUrl && <div className="muted small">Photo saved. Choose another to replace it.</div>}
                <FileUploader label="Upload profile photo" accept={['image/jpeg', 'image/png', 'image/webp']} maxMb={5} hint="JPG, PNG or WebP · up to 5 MB"
                  onUpload={(file, p) => uploadProfileImage(file, p)} onUploaded={(r) => set('profilePhotoUrl', r.url)} />
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="form-grid" aria-label="Professional information">
              <Field label="Professional category" htmlFor="d-cat" required error={err('professionalCategory')} className="span-2">
                <select id="d-cat" className="select" value={form.professionalCategory} onChange={(e) => set('professionalCategory', e.target.value)}>
                  <option value="">Select category…</option>{options.professionalCategories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Primary specialization" htmlFor="d-spec" required error={err('specialization')} hint={!category ? 'Choose a category first.' : undefined}>
                <select id="d-spec" className="select" value={form.specialization} onChange={(e) => set('specialization', e.target.value)} disabled={!category}>
                  <option value="">Select…</option>{specs.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Experience (years)" htmlFor="d-exp" required error={err('experience')}><input id="d-exp" type="number" min="0" max="70" className="input" value={form.experience} onChange={(e) => set('experience', e.target.value)} /></Field>
              <Field label="Additional specializations" error={err('additionalSpecializations')} className="span-2" hint="Optional — select any that apply.">
                <Chips label="Additional specializations" options={specs.filter((s) => s.value !== form.specialization)} value={form.additionalSpecializations} onToggle={(v) => toggle('additionalSpecializations', v)} />
              </Field>
              <Field label="Qualifications" htmlFor="d-qual" required error={err('qualification')} className="span-2"><input id="d-qual" className="input" value={form.qualification} onChange={(e) => set('qualification', e.target.value)} placeholder="e.g. MBBS, MD (Medicine)" maxLength={200} /></Field>
              <Field label="Registration number" htmlFor="d-reg" required={!!category?.registrationRequired} error={err('registration.number')}><input id="d-reg" className="input" value={form.registration.number} onChange={(e) => set('registration.number', e.target.value)} /></Field>
              <Field label="Registration council" htmlFor="d-council" required={!!category?.registrationRequired} error={err('registration.council')} hint={category?.councilHint}><input id="d-council" className="input" value={form.registration.council} onChange={(e) => set('registration.council', e.target.value)} /></Field>
              <Field label="Registration state" htmlFor="d-rstate" required={!!category?.registrationRequired} error={err('registration.state')}><input id="d-rstate" className="input" value={form.registration.state} onChange={(e) => set('registration.state', e.target.value)} /></Field>
              <div className="field"><label>Registration verification</label><div className="muted small">Entering a number does not verify the doctor. After the account is created, upload the certificates and record a decision from the doctor&apos;s details.</div></div>
              <Field label="Languages spoken" className="span-2"><Chips label="Languages" options={options.languages.map((l) => ({ value: l, label: l }))} value={form.languages} onToggle={(v) => toggle('languages', v)} /></Field>
              <Field label="Professional biography" htmlFor="d-bio" className="span-2" error={err('bio')} hint={`${form.bio.length}/2000`}><textarea id="d-bio" className="input" rows={3} maxLength={2000} value={form.bio} onChange={(e) => set('bio', e.target.value)} /></Field>
            </section>
          )}

          {step === 2 && (
            <section className="form-grid" aria-label="Hospital information">
              {needsHospital ? (
                <Field label="Hospital" htmlFor="d-hosp" required error={err('hospitalId')}>
                  <select id="d-hosp" className="select" value={form.hospitalId} onChange={(e) => set('hospitalId', e.target.value)}>
                    <option value="">Select hospital…</option>{(ctx.data?.hospitals || []).map((h) => <option key={h._id} value={h._id}>{h.name}</option>)}
                  </select>
                </Field>
              ) : (
                <Field label="Hospital" hint="Taken from your account — it cannot be changed."><input className="input" disabled value={ctx.data?.hospitals?.[0]?.name || doctor?.hospitalId?.name || 'Your hospital'} /></Field>
              )}
              <Field label="Department" htmlFor="d-dept" required error={err('departmentId')} hint={!departments.length ? 'This hospital has no departments yet — add one below.' : undefined}>
                <select id="d-dept" className="select" value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
                  <option value="">Select department…</option>{departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
              </Field>
              {(!needsHospital || form.hospitalId) && (
                <div className="field span-2">
                  <label htmlFor="d-newdept">Add a department to this hospital <span className="muted">(only the departments you offer)</span></label>
                  <div className="row gap-sm wrap">
                    <input id="d-newdept" className="input" style={{ flex: 1, minWidth: 180 }} list="dept-suggest" value={newDept} onChange={(e) => setNewDept(e.target.value)} placeholder="e.g. Cardiology" maxLength={80} />
                    <datalist id="dept-suggest">{suggestions.map((n) => <option key={n} value={n} />)}</datalist>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={createDept} disabled={newDept.trim().length < 2}><Plus size={14} /> Add department</button>
                  </div>
                  {suggestions.length > 0 && <div className="field-hint">Suggested for {form.specialization}: {suggestions.join(', ')}</div>}
                </div>
              )}
              <Field label="Consultation room" htmlFor="d-room"><input id="d-room" className="input" value={form.consultationRoom} onChange={(e) => set('consultationRoom', e.target.value)} maxLength={60} /></Field>
              <Field label="Appointment duration (minutes)" htmlFor="d-dur" required error={err('appointmentDurationMinutes')}><input id="d-dur" type="number" min="5" max="240" className="input" value={form.appointmentDurationMinutes} onChange={(e) => set('appointmentDurationMinutes', e.target.value)} /></Field>
              <Field label="Consultation fee (₹)" htmlFor="d-fee" required error={err('consultationFee')}><input id="d-fee" type="number" min="0" className="input" value={form.consultationFee} onChange={(e) => set('consultationFee', e.target.value)} /></Field>
              <Field label="Follow-up fee (₹)" htmlFor="d-ffee" error={err('followUpFee')}><input id="d-ffee" type="number" min="0" className="input" value={form.followUpFee} onChange={(e) => set('followUpFee', e.target.value)} /></Field>
              <Field label="Consultation modes" required error={err('consultationModes')} className="span-2">
                <Chips label="Consultation modes" options={options.consultationModes.map((m) => ({ value: m, label: MODE_LABEL[m] || m }))} value={form.consultationModes} onToggle={(v) => toggle('consultationModes', v)} />
              </Field>
              <label className="check"><input type="checkbox" checked={form.onlineConsultationAvailable} onChange={(e) => set('onlineConsultationAvailable', e.target.checked)} /> Online consultation available</label>
              <label className="check"><input type="checkbox" checked={form.emergencyAvailable} onChange={(e) => set('emergencyAvailable', e.target.checked)} /> Available for emergency consultations</label>
            </section>
          )}

          {step === 3 && (
            <section className="stack" aria-label="Availability and schedule">
              <div className="row between wrap gap-sm">
                <div><strong>Weekly working hours</strong><div className="muted small">Slots are generated from these windows (minus breaks and leave days).</div></div>
                <div className="row gap-sm wrap">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={quickWeek}>Mon–Fri 9–5</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => addWindow()}><Plus size={14} /> Add window</button>
                </div>
              </div>
              {err('availability') && <div className="field-error" role="alert">{err('availability')}</div>}
              {form.availability.length === 0 && <p className="muted">No windows yet — the doctor will have no bookable slots until a schedule is added.</p>}
              {form.availability.map((w, i) => (
                <div className="window-row" key={i}>
                  <label>Day<select className="select select-sm" value={w.dayOfWeek} onChange={(e) => updateWindow(i, { dayOfWeek: Number(e.target.value) })}>{DAYS.map((d, n) => <option key={d} value={n}>{d}</option>)}</select></label>
                  <label>Start<input type="time" className="input input-sm" value={w.startTime} onChange={(e) => updateWindow(i, { startTime: e.target.value })} /></label>
                  <label>End<input type="time" className="input input-sm" value={w.endTime} onChange={(e) => updateWindow(i, { endTime: e.target.value })} /></label>
                  <label>Break from<input type="time" className="input input-sm" value={w.breakStartTime} onChange={(e) => updateWindow(i, { breakStartTime: e.target.value })} /></label>
                  <label>Break to<input type="time" className="input input-sm" value={w.breakEndTime} onChange={(e) => updateWindow(i, { breakEndTime: e.target.value })} /></label>
                  <label>Slot (min)<input type="number" min="5" max="240" className="input input-sm" value={w.slotDurationMinutes} onChange={(e) => updateWindow(i, { slotDurationMinutes: e.target.value })} /></label>
                  <button type="button" className="icon-btn" aria-label={`Remove window ${i + 1}`} onClick={() => setForm((f) => ({ ...f, availability: f.availability.filter((_, n) => n !== i) }))}><Trash2 size={16} /></button>
                </div>
              ))}
              <div className="form-grid">
                <Field label="Maximum appointments per day" htmlFor="d-max" error={err('maxAppointmentsPerDay')} hint="Optional — leave empty for no limit."><input id="d-max" type="number" min="1" className="input" value={form.maxAppointmentsPerDay} onChange={(e) => set('maxAppointmentsPerDay', e.target.value)} /></Field>
                <label className="check"><input type="checkbox" checked={form.bookingEnabled} onChange={(e) => set('bookingEnabled', e.target.checked)} /> Appointment booking enabled</label>
                <Field label="Leave dates" className="span-2" hint="No slots are offered on these days.">
                  <div className="row gap-sm wrap">
                    <input type="date" className="input" style={{ maxWidth: 190 }} value={leaveInput} onChange={(e) => setLeaveInput(e.target.value)} aria-label="Leave date" />
                    <button type="button" className="btn btn-secondary btn-sm" disabled={!leaveInput || form.leaveDates.includes(leaveInput)} onClick={() => { set('leaveDates', [...form.leaveDates, leaveInput].sort()); setLeaveInput(''); }}><Plus size={14} /> Add</button>
                  </div>
                  <div className="chips">{form.leaveDates.map((d) => <span key={d} className="chip">{d}<button type="button" className="icon-btn icon-btn-sm" aria-label={`Remove ${d}`} onClick={() => set('leaveDates', form.leaveDates.filter((x) => x !== d))}><X size={12} /></button></span>)}</div>
                </Field>
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="stack" aria-label="Account and documents">
              <div className="card card-flat stack-sm">
                <strong>Account</strong>
                {isEdit ? (
                  <dl className="summary">
                    <div><dt>Login email</dt><dd>{form.email}</dd></div>
                    <div><dt>Email verified</dt><dd>{doctor.userId?.emailVerified ? 'Yes' : 'No'}</dd></div>
                    <div><dt>Created</dt><dd>{formatDateTime(doctor.createdAt)}{doctor.createdBy?.name ? ` by ${doctor.createdBy.name}` : ''}</dd></div>
                    <div><dt>Last login</dt><dd>{doctor.userId?.lastLoginAt ? formatDateTime(doctor.userId.lastLoginAt) : 'Never'}</dd></div>
                  </dl>
                ) : (
                  <p className="muted small">The doctor gets a one-time invitation link to set their own password — you never choose or see it. The account stays inactive until they accept and you activate the profile. The created date, creator and last login are recorded by the system.</p>
                )}
              </div>
              {isEdit ? (
                <p className="muted">Professional documents and the verification decision are managed from the doctor&apos;s <strong>Details</strong> view.</p>
              ) : (
                <div className="stack-sm">
                  <strong>Professional documents</strong>
                  <p className="muted small">Optional now — they are stored privately and uploaded right after the doctor is created. Required for verification: {category ? category.requiredDocuments.map((t) => DOC_LABEL[t]).join(', ') : 'select a category first'}.</p>
                  <div className="row gap-sm wrap">
                    <select className="select" style={{ maxWidth: 260 }} value={queueType} onChange={(e) => setQueueType(e.target.value)} aria-label="Document type">
                      {options.documentTypes.map((t) => <option key={t} value={t}>{DOC_LABEL[t] || titleCase(t)}</option>)}
                    </select>
                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>Choose file
                      <input type="file" hidden accept={DOC_ACCEPT.join(',')} onChange={(e) => { addQueued(e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                    <span className="muted small">PDF, JPEG or PNG · up to 10 MB</span>
                  </div>
                  {queueError && <div className="field-error" role="alert">{queueError}</div>}
                  {queue.map((q) => (
                    <div className="doc-row" key={q.id}><FileText size={18} aria-hidden="true" /><div><strong>{q.file.name}</strong><div className="muted small">{DOC_LABEL[q.type]} · {formatBytes(q.file.size)}</div></div>
                      <button type="button" className="icon-btn" aria-label={`Remove ${q.file.name}`} onClick={() => setQueue((x) => x.filter((i) => i.id !== q.id))}><Trash2 size={16} /></button></div>
                  ))}
                </div>
              )}
            </section>
          )}
        </form>
      )}
    </Modal>
  );
}
