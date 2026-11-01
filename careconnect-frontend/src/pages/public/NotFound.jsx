import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="fullscreen-center">
      <div className="state-box">
        <div className="state-icon"><Compass size={28} aria-hidden="true" /></div>
        <h1 style={{ fontSize: 22 }}>Page not found</h1>
        <p className="muted">The page you're looking for doesn't exist or has moved.</p>
        <div className="state-action"><Link to="/" className="btn btn-primary">Back to home</Link></div>
      </div>
    </div>
  );
}
