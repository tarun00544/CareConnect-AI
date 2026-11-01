import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Unauthorized() {
  const { isAuthenticated, homePath } = useAuth();
  return (
    <div className="fullscreen-center">
      <div className="state-box" role="alert">
        <div className="state-icon state-icon-danger"><ShieldAlert size={28} aria-hidden="true" /></div>
        <h1 style={{ fontSize: 22 }}>You don't have access to this page</h1>
        <p className="muted">Your account role does not permit this area. If you think this is a mistake, contact your administrator.</p>
        <div className="state-action row gap-sm">
          {isAuthenticated ? <Link to={homePath} className="btn btn-primary">Go to my dashboard</Link> : <Link to="/login" className="btn btn-primary">Sign in</Link>}
          <Link to="/" className="btn btn-secondary">Home</Link>
        </div>
      </div>
    </div>
  );
}
