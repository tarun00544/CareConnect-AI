import { AlertCircle } from 'lucide-react';
import { getDetailMessages } from '../../utils/response';

/** Banner for a failed submit: friendly message + any per-field validation details from the backend. */
export default function FormError({ error }) {
  if (!error) return null;
  const details = getDetailMessages(error);
  return (
    <div className="form-error" role="alert">
      <AlertCircle size={18} aria-hidden="true" />
      <div>
        <strong>{error.message}</strong>
        {details.length > 0 && <ul>{details.slice(0, 6).map((d) => <li key={d}>{d}</li>)}</ul>}
      </div>
    </div>
  );
}
