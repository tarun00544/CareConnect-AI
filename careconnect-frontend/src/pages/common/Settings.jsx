import { LogOut } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import IntegrationPending from '../../components/common/IntegrationPending';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { API_URL } from '../../utils/env';
import { ROLE_LABEL } from '../../constants';

export default function Settings() {
  const { user, role, logout } = useAuth();
  const { socketStatus } = useNotifications();
  return (
    <div className="stack-lg">
      <PageHeader title="Settings" />
      <section className="card">
        <h3>Account</h3>
        <dl className="summary">
          <div><dt>Signed in as</dt><dd>{user?.email}</dd></div>
          <div><dt>Role</dt><dd>{ROLE_LABEL[role]}</dd></div>
          <div><dt>Real-time connection</dt><dd>{socketStatus}</dd></div>
          {import.meta.env.DEV && <div><dt>API</dt><dd className="mono">{API_URL}</dd></div>}
        </dl>
      </section>
      <section className="card stack">
        <h3>Session</h3>
        <p className="muted">Signing out revokes your refresh tokens on the server, ending sessions on all your devices.</p>
        <div><button className="btn btn-secondary" onClick={logout}><LogOut size={16} /> Sign out everywhere</button></div>
      </section>
      <IntegrationPending title="Password change" missing="No password-change endpoint in backend/routes/authRoutes.js">Changing your password isn't supported by the backend yet.</IntegrationPending>
    </div>
  );
}
