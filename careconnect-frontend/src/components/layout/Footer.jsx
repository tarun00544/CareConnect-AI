import { Link } from 'react-router-dom';
import { Brand } from './Sidebar';
import { EMERGENCY_NOTICE } from '../../constants';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <Brand />
          <p className="muted small" style={{ marginTop: 10, maxWidth: 320 }}>One Platform. Complete Healthcare Journey.</p>
        </div>
        <div>
          <h4>Platform</h4>
          <Link to="/doctors">Find a doctor</Link>
          <Link to="/departments">Departments</Link>
          <Link to="/pharmacy">Pharmacy</Link>
          <Link to="/services">Services</Link>
        </div>
        <div>
          <h4>Account</h4>
          <Link to="/login">Sign in</Link>
          <Link to="/register">Create account</Link>
          <Link to="/about">About</Link>
        </div>
      </div>
      <div className="container footer-note">
        <p className="small"><strong>Emergency?</strong> {EMERGENCY_NOTICE}</p>
        <p className="small muted">AI features provide general guidance only and are not a medical diagnosis. © {new Date().getFullYear()} CareConnect AI.</p>
      </div>
    </footer>
  );
}
