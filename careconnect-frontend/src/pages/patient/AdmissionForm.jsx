import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Send, Trash2 } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Field from '../../components/ui/Field';
import FileUploader from '../../components/ui/FileUploader';
import FormError from '../../components/common/FormError';
import { useAsync } from '../../hooks/useAsync';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/AppContext';
import { getMyProfile } from '../../services/patientService';
import { listDepartments } from '../../services/departmentService';
import { listDoctors } from '../../services/doctorService';
import { createAdmission, uploadAdmissionDocument } from '../../services/admissionService';
import { BLOOD_GROUPS, GENDERS } from '../../constants';
import { formatBytes, titleCase } from '../../utils/format';
import { doctorDisplayName } from '../../components/doctors/DoctorCard';

const STEPS = ['Personal', 'Emergency contact', 'Medical history', 'Allergies & medicines', 'Insurance', 'Documents', 'Consent', 'Review'];
const lines = (t) => t.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
const dobInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

/**
 * Backend body (admissionController.createAdmission): { hospitalId, departmentId, doctorId?, reason, admissionForm }.
 * `admissionForm` is a free-form Mixed object, so the structured sections below live inside it.
 * Documents can only be attached AFTER the admission exists (POST /admissions/:id/documents), so files chosen in
 * step 6 are uploaded right after the request is created.
 */
export default function AdmissionForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const profile = useAsync(() => getMyProfile(), []);
  const depts = useAsync(() => listDepartments(), []);

  const [step, setStep] = useState(0);
  const [f, setF] = useState({
    departmentId: '', doctorId: '', reason: '',
    fullName: user?.name || '', phone: user?.phone || '', dateOfBirth: '', gender: '', bloodGroup: '', address: '',
    ecName: '', ecPhone: '', ecRelation: '',
    history: '', allergies: '', medicines: '',
    insProvider: '', insPolicy: '', insHolder: '',
    consent: false,
  });
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [uploadErrors, setUploadErrors] = useState([]);
  const [prefilled, setPrefilled] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  useEffect(() => {
    if (prefilled || !profile.data) return;
    const p = profile.data;
    const a = p.address || {};
    setF((x) => ({
      ...x, dateOfBirth: dobInput(p.dateOfBirth), gender: p.gender || '', bloodGroup: p.bloodGroup && p.bloodGroup !== 'UNKNOWN' ? p.bloodGroup : '',
      address: [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', '),
      ecName: p.emergencyContact?.name || '', ecPhone: p.emergencyContact?.phone || '', ecRelation: p.emergencyContact?.relation || '',
      history: (p.medicalHistory || []).join('\n'), allergies: (p.allergies || []).join('\n'), medicines: (p.currentMedicines || []).join('\n'),
    }));
    setPrefilled(true);
  }, [profile.data, prefilled]);

  const dept = (depts.data || []).find((d) => d._id === f.departmentId);
  const docs = useAsync(() => (f.departmentId ? listDoctors({ departmentId: f.departmentId, limit: 100 }) : Promise.resolve(null)), [f.departmentId]);

  const valid = useMemo(() => [
    !!f.departmentId && f.reason.trim().length >= 3 && f.fullName.trim().length > 0,
    !!(f.ecName.trim() && f.ecPhone.trim()),
    true, true, true, true, f.consent, true,
  ], [f]);

  const addFile = (file) => { if (file) setFiles((l) => [...l, file]); };

  const submit = async () => {
    setBusy(true); setError(null); setUploadErrors([]);
    let admission;
    try {
      admission = await createAdmission({
        hospitalId: dept.hospitalId?._id || dept.hospitalId,
        departmentId: f.departmentId,
        doctorId: f.doctorId || undefined,
        reason: f.reason.trim(),
        admissionForm: {
          personalDetails: { fullName: f.fullName.trim(), phone: f.phone.trim(), dateOfBirth: f.dateOfBirth || null, gender: f.gender || null, bloodGroup: f.bloodGroup || null, address: f.address.trim() },
          emergencyContact: { name: f.ecName.trim(), phone: f.ecPhone.trim(), relation: f.ecRelation.trim() },
          medicalHistory: lines(f.history),
          allergies: lines(f.allergies),
          currentMedicines: lines(f.medicines),
          insurance: { provider: f.insProvider.trim(), policyNumber: f.insPolicy.trim(), policyHolder: f.insHolder.trim() },
          consent: { accepted: true, acceptedAt: new Date().toISOString() },
        },
      });
    } catch (e) { setError(e); setBusy(false); return; }

    const failed = [];
    for (const file of files) {
      try { await uploadAdmissionDocument(admission._id, file, { title: file.name }); } catch (e) { failed.push(`${file.name}: ${e.message}`); }
    }
    setBusy(false);
    if (failed.length) {
      setUploadErrors(failed);
      toast.warning('Admission requested, but some documents failed to upload. You can add them from the admission page.');
    } else toast.success('Admission request submitted');
    navigate(`/patient/admission/${admission._id}`, { replace: true });
  };

  return (
    <div className="stack-lg">
      <PageHeader title="Request admission" subtitle="Complete the steps below. A hospital team will review your request." />
      <ol className="stepper stepper-scroll" aria-label="Admission progress">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? 'current' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>
            <span className="step-num">{i < step ? <Check size={14} /> : i + 1}</span><span className="step-label">{s}</span>
          </li>
        ))}
      </ol>
      <section className="card stack">
        {step === 0 && (
          <>
            <h3>Personal details</h3>
            <div className="grid grid-2">
              <Field label="Department" htmlFor="dept" required>
                <select id="dept" className="select" value={f.departmentId} onChange={(e) => setF((x) => ({ ...x, departmentId: e.target.value, doctorId: '' }))}>
                  <option value="">Select department…</option>{(depts.data || []).map((d) => <option key={d._id} value={d._id}>{d.name}{d.hospitalId?.name ? ` — ${d.hospitalId.name}` : ''}</option>)}
                </select>
              </Field>
              <Field label="Preferred doctor (optional)" htmlFor="doc">
                <select id="doc" className="select" value={f.doctorId} onChange={set('doctorId')} disabled={!f.departmentId}>
                  <option value="">No preference</option>{(docs.data?.items || []).map((d) => <option key={d._id} value={d._id}>{doctorDisplayName(d)}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Reason for admission" htmlFor="reason" required hint="Briefly describe why admission is needed."><textarea id="reason" className="input" rows={3} value={f.reason} onChange={set('reason')} /></Field>
            <div className="grid grid-2">
              <Field label="Full name" htmlFor="fn" required><input id="fn" className="input" value={f.fullName} onChange={set('fullName')} /></Field>
              <Field label="Phone" htmlFor="phone"><input id="phone" type="tel" className="input" value={f.phone} onChange={set('phone')} /></Field>
              <Field label="Date of birth" htmlFor="dob"><input id="dob" type="date" className="input" value={f.dateOfBirth} onChange={set('dateOfBirth')} max={new Date().toISOString().slice(0, 10)} /></Field>
              <Field label="Gender" htmlFor="gender"><select id="gender" className="select" value={f.gender} onChange={set('gender')}><option value="">Select…</option>{GENDERS.map((g) => <option key={g} value={g}>{titleCase(g)}</option>)}</select></Field>
              <Field label="Blood group" htmlFor="bg"><select id="bg" className="select" value={f.bloodGroup} onChange={set('bloodGroup')}><option value="">Unknown</option>{BLOOD_GROUPS.filter((b) => b !== 'UNKNOWN').map((b) => <option key={b}>{b}</option>)}</select></Field>
              <Field label="Address" htmlFor="addr"><input id="addr" className="input" value={f.address} onChange={set('address')} /></Field>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <h3>Emergency contact</h3>
            <div className="grid grid-2">
              <Field label="Contact name" htmlFor="ecn" required><input id="ecn" className="input" value={f.ecName} onChange={set('ecName')} /></Field>
              <Field label="Contact phone" htmlFor="ecp" required><input id="ecp" type="tel" className="input" value={f.ecPhone} onChange={set('ecPhone')} /></Field>
              <Field label="Relationship" htmlFor="ecr"><input id="ecr" className="input" value={f.ecRelation} onChange={set('ecRelation')} /></Field>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h3>Medical history</h3>
            <Field label="Past conditions, surgeries, ongoing issues" htmlFor="hist" hint="One per line."><textarea id="hist" className="input" rows={6} value={f.history} onChange={set('history')} /></Field>
          </>
        )}
        {step === 3 && (
          <>
            <h3>Allergies &amp; current medicines</h3>
            <div className="grid grid-2">
              <Field label="Allergies" htmlFor="all" hint="One per line."><textarea id="all" className="input" rows={5} value={f.allergies} onChange={set('allergies')} /></Field>
              <Field label="Current medicines" htmlFor="meds" hint="One per line."><textarea id="meds" className="input" rows={5} value={f.medicines} onChange={set('medicines')} /></Field>
            </div>
          </>
        )}
        {step === 4 && (
          <>
            <h3>Insurance</h3>
            <p className="muted small">Optional. Leave blank if you are self-paying.</p>
            <div className="grid grid-2">
              <Field label="Insurance provider" htmlFor="ip"><input id="ip" className="input" value={f.insProvider} onChange={set('insProvider')} /></Field>
              <Field label="Policy number" htmlFor="ipn"><input id="ipn" className="input" value={f.insPolicy} onChange={set('insPolicy')} /></Field>
              <Field label="Policy holder" htmlFor="iph"><input id="iph" className="input" value={f.insHolder} onChange={set('insHolder')} /></Field>
            </div>
          </>
        )}
        {step === 5 && (
          <>
            <h3>Documents</h3>
            <p className="muted small">Add referral letters, ID or insurance documents. They are uploaded when you submit.</p>
            <FileUploader key={files.length} label="Add a document" onSelect={addFile} preview={false} />
            {files.length > 0 && (
              <ul className="file-list">{files.map((file, i) => (
                <li key={`${file.name}-${i}`} className="row between"><span>{file.name} <span className="muted small">({formatBytes(file.size)})</span></span>
                  <button type="button" className="icon-btn" onClick={() => setFiles((l) => l.filter((_, k) => k !== i))} aria-label={`Remove ${file.name}`}><Trash2 size={15} /></button></li>
              ))}</ul>
            )}
          </>
        )}
        {step === 6 && (
          <>
            <h3>Consent</h3>
            <p>I confirm the information provided is accurate to the best of my knowledge and I consent to the hospital reviewing it, and any documents I attach, to assess this admission request.</p>
            <label className="check"><input type="checkbox" checked={f.consent} onChange={set('consent')} /> <span>I agree and consent</span></label>
          </>
        )}
        {step === 7 && (
          <>
            <h3>Review &amp; submit</h3>
            <dl className="summary">
              <div><dt>Department</dt><dd>{dept?.name} {dept?.hospitalId?.name ? `· ${dept.hospitalId.name}` : ''}</dd></div>
              <div><dt>Reason</dt><dd>{f.reason}</dd></div>
              <div><dt>Patient</dt><dd>{f.fullName}{f.dateOfBirth ? ` · DOB ${f.dateOfBirth}` : ''}</dd></div>
              <div><dt>Emergency contact</dt><dd>{f.ecName} · {f.ecPhone}{f.ecRelation ? ` (${f.ecRelation})` : ''}</dd></div>
              <div><dt>Medical history</dt><dd>{lines(f.history).join(', ') || 'None provided'}</dd></div>
              <div><dt>Allergies</dt><dd>{lines(f.allergies).join(', ') || 'None provided'}</dd></div>
              <div><dt>Current medicines</dt><dd>{lines(f.medicines).join(', ') || 'None provided'}</dd></div>
              <div><dt>Insurance</dt><dd>{f.insProvider || 'None'}</dd></div>
              <div><dt>Documents</dt><dd>{files.length ? `${files.length} file(s)` : 'None'}</dd></div>
            </dl>
            <FormError error={error} />
            {uploadErrors.map((u) => <div key={u} className="field-error">{u}</div>)}
          </>
        )}
        <div className="row between wizard-nav">
          <button type="button" className="btn btn-ghost" disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}><ChevronLeft size={16} /> Back</button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn btn-primary" disabled={!valid[step]} onClick={() => setStep((s) => s + 1)}>Next <ChevronRight size={16} /></button>
          ) : (
            <button type="button" className="btn btn-primary btn-lg" disabled={busy || !valid.every(Boolean)} onClick={submit}><Send size={16} /> {busy ? 'Submitting…' : 'Submit request'}</button>
          )}
        </div>
      </section>
    </div>
  );
}
