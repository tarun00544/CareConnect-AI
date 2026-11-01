import { ShieldAlert, Siren } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AI_DISCLAIMER, EMERGENCY_NOTICE } from '../../constants';

export function AIDisclaimer() {
  return (
    <div className="disclaimer" role="note">
      <ShieldAlert size={18} aria-hidden="true" />
      <p>{AI_DISCLAIMER}</p>
    </div>
  );
}

export function EmergencyBanner({ to = '/patient/emergency', message = EMERGENCY_NOTICE, showLink = true }) {
  return (
    <div className="emergency-banner" role="alert">
      <Siren size={20} aria-hidden="true" />
      <div>
        <strong>Emergency Assistance</strong>
        <p>{message}</p>
      </div>
      {showLink && <Link className="btn btn-danger btn-sm" to={to}>Emergency assistance</Link>}
    </div>
  );
}
