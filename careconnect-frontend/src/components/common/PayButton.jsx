import { CreditCard } from 'lucide-react';
import { usePayment } from '../../hooks/usePayment';
import { formatCurrency } from '../../utils/format';

/** Starts the Razorpay flow for an appointment or order. Renders backend errors inline. */
export default function PayButton({ type, referenceId, amount, label, returnTo, className = 'btn btn-primary', description }) {
  const { pay, busy, error } = usePayment();
  return (
    <div className="stack-sm">
      <button type="button" className={className} disabled={busy} onClick={() => pay({ type, referenceId, returnTo, description })}>
        <CreditCard size={16} /> {busy ? 'Opening payment…' : label || `Pay${amount != null ? ` ${formatCurrency(amount)}` : ''}`}
      </button>
      {error && <div className="field-error" role="alert">{error.message}</div>}
    </div>
  );
}
