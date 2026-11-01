import { useEffect, useState } from 'react';
import { Mail, Phone, ShieldCheck } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Field from '../../components/ui/Field';
import StatusBadge from '../../components/ui/StatusBadge';
import DataState from '../../components/common/DataState';
import FormError from '../../components/common/FormError';
import IntegrationPending from '../../components/common/IntegrationPending';
import FileUploader from '../../components/ui/FileUploader';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/AppContext';
import { useAsync } from '../../hooks/useAsync';
import { getMyProfile, updateMyProfile } from '../../services/patientService';
import { findMyDoctorProfile } from '../../services/doctorService';
import { uploadProfileImage } from '../../services/uploadService';
import { BLOOD_GROUPS, GENDERS, ROLES, ROLE_LABEL } from '../../constants';
import { ageFromDob, formatCurrency, initials, titleCase } from '../../utils/format';
import { doctorDisplayName } from '../../components/doctors/DoctorCard';

const list = (t) => t.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
const dobInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

function AccountCard({ user, role }) {
  return (
    <section className="card">
      <div className="row gap-sm"><span className="avatar avatar-xl">{initials(user?.name)}</span>
        <div><h2>{user?.name}</h2><div className="row gap-xs"><span className="chip">{ROLE_LABEL[role]}</span><StatusBadge status={user?.status} size="sm" /></div></div></div>
      <ul className="meta-list" style={{ marginTop: 14 }}>
        <li><Mail size={15} /> {user?.email}</li>
        {user?.phone && <li><Phone size={15} /> {user.phone}</li>}
        <li><ShieldCheck size={15} /> Role-based access: {ROLE_LABEL[role]}</li>
      </ul>
    </section>
  );
}

function PatientProfileForm() {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => getMyProfile(), []);
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saveErr, setSaveErr] = useState(null);
  useEffect(() => {
    if (!data) return;
    const a = data.address || {}; const ec = data.emergencyContact || {};
    setF({ dateOfBirth: dobInput(data.dateOfBirth), gender: data.gender || '', bloodGroup: data.bloodGroup || 'UNKNOWN',
      line1: a.line1 || '', line2: a.line2 || '', city: a.city || '', state: a.state || '', pincode: a.pincode || '',
      ecName: ec.name || '', ecPhone: ec.phone || '', ecRelation: ec.relation || '',
      allergies: (data.allergies || []).join('\n'), medicalHistory: (data.medicalHistory || []).join('\n'), currentMedicines: (data.currentMedicines || []).join('\n') });
  }, [data]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault(); setBusy(true); setSaveErr(null);
    try {
      const payload = {
        bloodGroup: f.bloodGroup,
        address: { line1: f.line1, line2: f.line2, city: f.city, state: f.state, pincode: f.pincode },
        emergencyContact: { name: f.ecName, phone: f.ecPhone, relation: f.ecRelation },
        allergies: list(f.allergies), medicalHistory: list(f.medicalHistory), currentMedicines: list(f.currentMedicines),
      };
      if (f.dateOfBirth) payload.dateOfBirth = f.dateOfBirth;
      if (f.gender) payload.gender = f.gender;
      await updateMyProfile(payload);
      toast.success('Profile updated'); reload();
    } catch (err) { setSaveErr(err); } finally { setBusy(false); }
  };

  return (
    <DataState loading={loading} error={error} data={data} onRetry={reload}>
      {f && (
        <form className="card stack" onSubmit={save}>
          <h3>Health profile {ageFromDob(data.dateOfBirth) != null && <span className="muted small">· {ageFromDob(data.dateOfBirth)} years</span>}</h3>
          <div className="grid grid-3">
            <Field label="Date of birth" htmlFor="pdob"><input id="pdob" type="date" className="input" value={f.dateOfBirth} onChange={set('dateOfBirth')} max={new Date().toISOString().slice(0, 10)} /></Field>
            <Field label="Gender" htmlFor="pg"><select id="pg" className="select" value={f.gender} onChange={set('gender')}><option value="">Not set</option>{GENDERS.map((g) => <option key={g} value={g}>{titleCase(g)}</option>)}</select></Field>
            <Field label="Blood group" htmlFor="pbg"><select id="pbg" className="select" value={f.bloodGroup} onChange={set('bloodGroup')}>{BLOOD_GROUPS.map((b) => <option key={b}>{b}</option>)}</select></Field>
          </div>
          <h4>Address</h4>
          <div className="grid grid-2">
            <Field label="Line 1" htmlFor="pl1"><input id="pl1" className="input" value={f.line1} onChange={set('line1')} /></Field>
            <Field label="Line 2" htmlFor="pl2"><input id="pl2" className="input" value={f.line2} onChange={set('line2')} /></Field>
            <Field label="City" htmlFor="pc"><input id="pc" className="input" value={f.city} onChange={set('city')} /></Field>
            <Field label="State" htmlFor="ps"><input id="ps" className="input" value={f.state} onChange={set('state')} /></Field>
            <Field label="Pincode" htmlFor="pp"><input id="pp" className="input" value={f.pincode} onChange={set('pincode')} /></Field>
          </div>
          <h4>Emergency contact</h4>
          <div className="grid grid-3">
            <Field label="Name" htmlFor="en"><input id="en" className="input" value={f.ecName} onChange={set('ecName')} /></Field>
            <Field label="Phone" htmlFor="ep"><input id="ep" type="tel" className="input" value={f.ecPhone} onChange={set('ecPhone')} /></Field>
            <Field label="Relationship" htmlFor="er"><input id="er" className="input" value={f.ecRelation} onChange={set('ecRelation')} /></Field>
          </div>
          <div className="grid grid-3">
            <Field label="Allergies" htmlFor="pa" hint="One per line"><textarea id="pa" className="input" rows={4} value={f.allergies} onChange={set('allergies')} /></Field>
            <Field label="Medical history" htmlFor="pm" hint="One per line"><textarea id="pm" className="input" rows={4} value={f.medicalHistory} onChange={set('medicalHistory')} /></Field>
            <Field label="Current medicines" htmlFor="pcm" hint="One per line"><textarea id="pcm" className="input" rows={4} value={f.currentMedicines} onChange={set('currentMedicines')} /></Field>
          </div>
          <FormError error={saveErr} />
          <div><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button></div>
        </form>
      )}
    </DataState>
  );
}

function DoctorProfileCard({ userId }) {
  const { data, loading, error, reload } = useAsync(() => findMyDoctorProfile(userId), [userId]);
  return (
    <DataState loading={loading} error={error} data={error || loading ? null : data ?? false} onRetry={reload}>
      {data ? (
        <section className="card">
          <h3>Professional profile</h3>
          <dl className="summary">
            <div><dt>Display name</dt><dd>{doctorDisplayName(data)}</dd></div>
            <div><dt>Specialization</dt><dd>{data.specialization || '—'}</dd></div>
            <div><dt>Qualification</dt><dd>{data.qualification || '—'}</dd></div>
            <div><dt>Experience</dt><dd>{data.experience ?? 0} years</dd></div>
            <div><dt>Department</dt><dd>{data.departmentId?.name || '—'}{data.hospitalId?.name ? ` · ${data.hospitalId.name}` : ''}</dd></div>
            <div><dt>Consultation fee</dt><dd>{formatCurrency(data.consultationFee)}</dd></div>
            {data.bio && <div><dt>Bio</dt><dd>{data.bio}</dd></div>}
            <div><dt>Status</dt><dd><StatusBadge status={data.status} size="sm" /></dd></div>
          </dl>
          <IntegrationPending title="Profile editing pending backend endpoint" missing="PATCH /api/doctors/me (not implemented)">Only availability can be edited today (see Availability). Other profile fields are managed by an administrator.</IntegrationPending>
        </section>
      ) : <div className="card"><p className="muted">No doctor profile is linked to this account yet. Ask an administrator to create one.</p></div>}
    </DataState>
  );
}

export default function Profile() {
  const { user, role } = useAuth();
  const toast = useToast();
  return (
    <div className="stack-lg">
      <PageHeader title="Profile" />
      <AccountCard user={user} role={role} />
      {role === ROLES.PATIENT && <PatientProfileForm />}
      {role === ROLES.DOCTOR && <DoctorProfileCard userId={user?.id} />}
      <section className="card stack">
        <h3>Profile photo</h3>
        <FileUploader label="Upload a profile image" accept={['image/jpeg', 'image/png', 'image/webp']} hint="JPG, PNG or WebP · up to 10 MB" onUpload={async (f, p) => { const r = await uploadProfileImage(f, p); return r; }} onUploaded={() => toast.success('Image uploaded')} />
        <IntegrationPending title="Photo is stored but not yet linked to your profile" missing="No profile-image field on User/Patient/Doctor models">The upload endpoint saves the file, but the backend has no field that attaches it to your account, so it isn't displayed.</IntegrationPending>
      </section>
      <IntegrationPending title="Name, email and phone editing" missing="No PATCH /api/auth/me or /api/users endpoint">Your account details are read-only until the backend adds an endpoint for updating them.</IntegrationPending>
    </div>
  );
}
