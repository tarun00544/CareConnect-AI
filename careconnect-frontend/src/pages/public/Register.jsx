import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Field from '../../components/ui/Field';
import FormError from '../../components/common/FormError';
import AuthShell from './AuthShell';
import { ROLE_HOME } from '../../constants';
import { getFieldErrors } from '../../utils/response';

// Self-registration creates a PATIENT account. The backend lets a client send role=DOCTOR, but it does not create a
// Doctor profile for it, so the account would be unusable — doctors/admins are provisioned by administrators.
export default function Register() {
  const { register, isAuthenticated, homePath } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [localErrors, setLocalErrors] = useState({});

  if (isAuthenticated) return <Navigate to={homePath} replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const fieldErrors = { ...getFieldErrors(error), ...localErrors };

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (form.password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (form.password !== form.confirm) errs.confirm = 'Passwords do not match';
    setLocalErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    setError(null);
    try {
      const user = await register({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || undefined, password: form.password });
      navigate(ROLE_HOME[user.role], { replace: true });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Start your healthcare journey as a patient.">
      <form onSubmit={submit} className="stack" noValidate>
        <FormError error={error} />
        <Field label="Full name" htmlFor="name" error={fieldErrors.name} required>
          <input id="name" className="input" autoComplete="name" value={form.name} onChange={set('name')} required autoFocus />
        </Field>
        <Field label="Email" htmlFor="email" error={fieldErrors.email} required>
          <input id="email" type="email" className="input" autoComplete="email" value={form.email} onChange={set('email')} required />
        </Field>
        <Field label="Phone (optional)" htmlFor="phone" error={fieldErrors.phone} hint="Include your country code, e.g. +91…">
          <input id="phone" type="tel" className="input" autoComplete="tel" value={form.phone} onChange={set('phone')} />
        </Field>
        <div className="grid grid-2">
          <Field label="Password" htmlFor="password" error={fieldErrors.password} hint="At least 8 characters" required>
            <div className="input-group">
              <input id="password" type={show ? 'text' : 'password'} className="input" autoComplete="new-password" value={form.password} onChange={set('password')} required />
              <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </div>
          </Field>
          <Field label="Confirm password" htmlFor="confirm" error={fieldErrors.confirm} required>
            <input id="confirm" type={show ? 'text' : 'password'} className="input" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} required />
          </Field>
        </div>
        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
          <UserPlus size={17} /> {busy ? 'Creating account…' : 'Create account'}
        </button>
        <p className="muted small">Doctor, hospital and pharmacy accounts are set up by an administrator.</p>
      </form>
      <p className="auth-foot">Already have an account? <Link to="/login">Sign in</Link></p>
    </AuthShell>
  );
}
