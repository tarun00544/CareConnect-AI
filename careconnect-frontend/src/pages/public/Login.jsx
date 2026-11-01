import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Field from '../../components/ui/Field';
import FormError from '../../components/common/FormError';
import AuthShell from './AuthShell';
import { ROLE_BASE, ROLE_HOME } from '../../constants';
import { getFieldErrors } from '../../utils/response';

// Seed accounts from backend/seed/seed.js — shown only in development builds to speed up demos.
const DEMO = [
  ['Patient', 'patient@careconnect.example'],
  ['Doctor', 'doctor@careconnect.example'],
  ['Hospital admin', 'hospitaladmin@careconnect.example'],
  ['Pharmacy admin', 'pharmacyadmin@careconnect.example'],
  ['Super admin', 'superadmin@careconnect.example'],
];

export default function Login() {
  const { login, isAuthenticated, homePath } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (isAuthenticated) return <Navigate to={homePath} replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const fieldErrors = getFieldErrors(error);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await login({ email: form.email.trim(), password: form.password });
      // Return to the page that triggered sign-in only if this role may open it; otherwise use the role's dashboard.
      const from = location.state?.from;
      const base = ROLE_BASE[user.role];
      navigate(from && base && from.startsWith(base) ? from : ROLE_HOME[user.role], { replace: true });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to continue your care journey.">
      <form onSubmit={submit} className="stack" noValidate>
        <FormError error={error} />
        <Field label="Email" htmlFor="email" error={fieldErrors.email} required>
          <input id="email" type="email" className="input" autoComplete="email" value={form.email} onChange={set('email')} required autoFocus />
        </Field>
        <Field label="Password" htmlFor="password" error={fieldErrors.password} required>
          <div className="input-group">
            <input id="password" type={show ? 'text' : 'password'} className="input" autoComplete="current-password" value={form.password} onChange={set('password')} required />
            <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>
          </div>
        </Field>
        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy || !form.email || !form.password}>
          <LogIn size={17} /> {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="auth-foot">New to CareConnect AI? <Link to="/register">Create a patient account</Link></p>
      {import.meta.env.DEV && (
        <details className="demo-box">
          <summary>Demo accounts (development seed data)</summary>
          <p className="muted small">Password for all seeded accounts: <code>Password@123</code>. Click to fill the email.</p>
          <div className="chips">
            {DEMO.map(([label, email]) => (
              <button key={email} type="button" className="chip chip-btn" onClick={() => setForm({ email, password: 'Password@123' })}>{label}</button>
            ))}
          </div>
        </details>
      )}
    </AuthShell>
  );
}
