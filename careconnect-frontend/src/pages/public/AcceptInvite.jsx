import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import AuthShell from './AuthShell';
import Field from '../../components/ui/Field';
import FormError from '../../components/common/FormError';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorState from '../../components/ui/ErrorState';
import { useAsync } from '../../hooks/useAsync';
import { useToast } from '../../context/AppContext';
import { acceptInvitation, getInvitation } from '../../services/authService';
import { getFieldErrors } from '../../utils/response';

/** Doctor onboarding: the invitee sets their own password using the one-time link from a hospital admin. */
export default function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const toast = useToast();
  const invite = useAsync(() => (token ? getInvitation(token) : Promise.reject(new Error('This invitation link is incomplete.'))), [token]);
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [errs, setErrs] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const local = {};
    if (form.password.length < 8) local.password = 'Password must be at least 8 characters';
    if (form.password !== form.confirm) local.confirm = 'Passwords do not match';
    setErrs(local);
    if (Object.keys(local).length) return;
    setBusy(true); setError(null);
    try {
      await acceptInvitation({ token, password: form.password });
      toast.success('Your account is ready. Please sign in.');
      navigate('/login', { replace: true });
    } catch (err) { setError(err); setErrs(getFieldErrors(err)); setBusy(false); }
  };

  return (
    <AuthShell title="Activate your account" subtitle="Set a password to finish joining CareConnect AI.">
      {invite.loading ? <LoadingSpinner label="Checking your invitation…" /> : invite.error ? (
        <>
          <ErrorState error={invite.error} compact />
          <p className="auth-foot">Ask your hospital administrator for a new invitation, or <Link to="/login">sign in</Link>.</p>
        </>
      ) : (
        <form onSubmit={submit} className="stack" noValidate>
          <FormError error={error} />
          <p className="muted">Welcome, <strong>{invite.data?.name}</strong> ({invite.data?.email}).</p>
          <Field label="New password" htmlFor="ai-pw" required error={errs.password} hint="At least 8 characters">
            <div className="input-group">
              <input id="ai-pw" type={show ? 'text' : 'password'} className="input" autoComplete="new-password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} autoFocus />
              <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </div>
          </Field>
          <Field label="Confirm password" htmlFor="ai-pw2" required error={errs.confirm}>
            <input id="ai-pw2" type={show ? 'text' : 'password'} className="input" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))} />
          </Field>
          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}><KeyRound size={17} /> {busy ? 'Activating…' : 'Activate account'}</button>
          <p className="muted small">After you sign in, a hospital administrator verifies your credentials and activates your profile before patients can book you.</p>
        </form>
      )}
    </AuthShell>
  );
}
