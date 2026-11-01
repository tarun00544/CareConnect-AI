import { Link } from 'react-router-dom';
import { HeartPulse, ShieldCheck, Sparkles, Stethoscope } from 'lucide-react';
import { Brand } from '../../components/layout/Sidebar';

export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="auth-shell">
      <aside className="auth-aside" aria-hidden="true">
        <Brand />
        <div>
          <h2>One Platform.<br />Complete Healthcare Journey.</h2>
          <ul className="auth-points">
            <li><Stethoscope size={18} /> Book real doctors and consult online</li>
            <li><Sparkles size={18} /> AI guidance to find the right department</li>
            <li><HeartPulse size={18} /> Prescriptions, medicines and records in one place</li>
            <li><ShieldCheck size={18} /> Private, role-based access</li>
          </ul>
        </div>
        <p className="small">Not an emergency service. In an emergency, contact local emergency services.</p>
      </aside>
      <main className="auth-main" id="main">
        <div className="auth-card">
          <Link to="/" className="auth-home"><Brand /></Link>
          <h1>{title}</h1>
          <p className="muted">{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  );
}
