import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Field from '../ui/Field';
import StatusBadge from '../ui/StatusBadge';
import FormError from '../common/FormError';
import DataState from '../common/DataState';
import { SkeletonRows } from '../ui/Skeleton';
import { useAsync } from '../../hooks/useAsync';
import { useToast } from '../../context/AppContext';
import * as admin from '../../services/adminService';
import { ROLES, ROLE_LABEL } from '../../constants';
import { formatDateTime } from '../../utils/format';
import { getFieldErrors } from '../../utils/response';

const STAFF = [ROLES.HOSPITAL_ADMIN, ROLES.PHARMACY_ADMIN, ROLES.SUPER_ADMIN];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9][0-9\s-]{7,16}$/;

/** Read-only view of a user plus linked profile information. */
export function UserDetailModal({ userId, open, onClose }) {
  const { data: u, loading, error, reload } = useAsync(() => (userId ? admin.getUser(userId) : Promise.resolve(null)), [userId, open], { immediate: !!userId });
  return (
    <Modal open={open} onClose={onClose} title="User details" size="md" footer={<button type="button" className="btn btn-primary" onClick={onClose}>Close</button>}>
      <DataState loading={loading} error={error} data={u} onRetry={reload} skeleton={<SkeletonRows />}>
        {u && (
          <dl className="summary">
            <div><dt>Name</dt><dd>{u.name}</dd></div>
            <div><dt>Email</dt><dd>{u.email}{u.emailVerified ? ' (verified)' : ''}</dd></div>
            <div><dt>Phone</dt><dd>{u.phone || '—'}</dd></div>
            <div><dt>Role</dt><dd>{ROLE_LABEL[u.role] || u.role}</dd></div>
            <div><dt>Status</dt><dd><StatusBadge status={u.status} size="sm" />{u.pendingInvitation ? ' · invitation pending' : ''}</dd></div>
            {u.hospital && <div><dt>Hospital</dt><dd>{u.hospital.name}</dd></div>}
            {u.doctorProfile && <div><dt>Doctor profile</dt><dd>{u.doctorProfile.specialization} · {u.doctorProfile.department} · verification {String(u.doctorProfile.verification || '').toLowerCase()}</dd></div>}
            {u.role === ROLES.PATIENT && <div><dt>Patient profile</dt><dd>{u.hasPatientProfile ? 'Yes' : 'No'}</dd></div>}
            <div><dt>Joined</dt><dd>{formatDateTime(u.createdAt)}</dd></div>
            <div><dt>Last login</dt><dd>{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never'}</dd></div>
            {u.deletedAt && <div><dt>Deleted</dt><dd>{formatDateTime(u.deletedAt)}</dd></div>}
          </dl>
        )}
      </DataState>
    </Modal>
  );
}

/** Edit form pre-filled from the server. Role changes are only offered between staff roles. */
export function UserEditModal({ user, open, onClose, onSaved, currentUserId, hospitals }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: '', hospitalId: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && user) {
      setForm({ name: user.name || '', email: user.email || '', phone: user.phone || '', role: user.role, hospitalId: user.hospitalId || '' });
      setErrors({}); setFormError(null); setBusy(false);
    }
  }, [open, user]);

  if (!user) return null;
  const isSelf = String(user._id) === String(currentUserId);
  const canChangeRole = STAFF.includes(user.role) && !isSelf;
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };

  const submit = async (ev) => {
    ev.preventDefault();
    if (busy) return;
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Name must be at least 2 characters';
    if (!EMAIL_RE.test(form.email.trim())) e.email = 'Enter a valid email address';
    if (form.phone.trim() && !PHONE_RE.test(form.phone.trim())) e.phone = 'Enter a valid phone number';
    if (form.role === ROLES.HOSPITAL_ADMIN && !form.hospitalId) e.hospitalId = 'Hospital admins need a hospital';
    if (Object.keys(e).length) { setErrors(e); return; }
    const payload = { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() };
    if (canChangeRole && form.role !== user.role) payload.role = form.role;
    if (form.role === ROLES.HOSPITAL_ADMIN) payload.hospitalId = form.hospitalId;
    setBusy(true); setFormError(null);
    try {
      await admin.updateUser(user._id, payload);
      toast.success('User updated.');
      onSaved?.();
      onClose();
    } catch (err) { setErrors(getFieldErrors(err)); setFormError(err); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} dismissible={!busy} title="Edit user" size="md"
      footer={<><button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" form="user-form" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></>}>
      <form id="user-form" onSubmit={submit} noValidate>
        <FormError error={formError} />
        <Field label="Full name" htmlFor="u-name" required error={errors.name}><input id="u-name" className="input" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={100} /></Field>
        <Field label="Email" htmlFor="u-email" required error={errors.email}><input id="u-email" type="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Phone" htmlFor="u-phone" error={errors.phone}><input id="u-phone" type="tel" className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Role" htmlFor="u-role" error={errors.role}
          hint={isSelf ? 'You cannot change your own role.' : canChangeRole ? 'Role changes take effect immediately.' : 'Patient and Doctor accounts own clinical profiles, so their role cannot be changed.'}>
          <select id="u-role" className="select" value={form.role} disabled={!canChangeRole} onChange={(e) => set('role', e.target.value)}>
            {(canChangeRole ? STAFF : [user.role]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r] || r}</option>)}
          </select>
        </Field>
        {form.role === ROLES.HOSPITAL_ADMIN && (
          <Field label="Hospital" htmlFor="u-hosp" required error={errors.hospitalId}>
            <select id="u-hosp" className="select" value={form.hospitalId} onChange={(e) => set('hospitalId', e.target.value)} disabled={!canChangeRole}>
              <option value="">Select hospital…</option>{(hospitals || []).map((h) => <option key={h._id} value={h._id}>{h.name}</option>)}
            </select>
          </Field>
        )}
      </form>
    </Modal>
  );
}

/** Safe deletion: anonymises the account and requires the user's email as typed confirmation. */
export function UserDeleteDialog({ user, open, onClose, onDeleted }) {
  const toast = useToast();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { if (open) { setTyped(''); setError(null); setBusy(false); } }, [open]);
  if (!user) return null;
  const match = typed.trim().toLowerCase() === String(user.email).toLowerCase();

  const confirm = async () => {
    if (busy || !match) return;
    setBusy(true); setError(null);
    try {
      const r = await admin.deleteUser(user._id, typed.trim());
      const kept = Object.entries(r.retained || {}).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
      toast.success(`User deleted.${kept.length ? ` Retained: ${kept.join(', ')}.` : ''}`, { duration: 8000 });
      onDeleted?.();
      onClose();
    } catch (e) { setError(e); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} dismissible={!busy} title="Delete user?" size="sm"
      footer={<><button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button><button type="button" className="btn btn-danger" onClick={confirm} disabled={!match || busy}>{busy ? 'Deleting…' : 'Delete user'}</button></>}>
      <div className="stack-sm">
        <FormError error={error} />
        <p>This removes <strong>{user.name}</strong>&apos;s ability to sign in and anonymises their name, email and phone. <strong>Appointments, billing and clinical records are kept</strong>, unlinked from their identity, because healthcare history must be retained. This cannot be undone.</p>
        <Field label={`Type ${user.email} to confirm`} htmlFor="del-confirm">
          <input id="del-confirm" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </Field>
      </div>
    </Modal>
  );
}
