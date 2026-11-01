import { Link, Navigate, useLocation } from 'react-router-dom';
import { CheckCircle2, Printer, XCircle } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../../utils/format';

/** /payment/success — only reachable with the receipt returned by POST /api/payments/verify (router state). */
export function PaymentSuccess() {
  const { state } = useLocation();
  if (!state?.receipt) return <Navigate to="/patient/payments" replace />;
  const r = state.receipt;
  return (
    <div className="fullscreen-center">
      <div className="card receipt result-card">
        <div className="state-icon state-icon-success"><CheckCircle2 size={30} aria-hidden="true" /></div>
        <h1>Payment successful</h1>
        <p className="muted">Your payment was verified by our servers.</p>
        <dl className="summary">
          <div><dt>Receipt</dt><dd className="mono">{r.receiptId}</dd></div>
          <div><dt>Transaction ID</dt><dd className="mono">{r.transactionId}</dd></div>
          <div><dt>For</dt><dd>{r.type === 'ORDER' ? 'Medicine order' : 'Consultation'}</dd></div>
          <div><dt>Amount</dt><dd>{formatCurrency(r.amount, r.currency)}</dd></div>
          <div><dt>Date</dt><dd>{formatDateTime(r.date)}</dd></div>
        </dl>
        <div className="row gap-sm wrap center">
          {state.returnTo && <Link to={state.returnTo} className="btn btn-primary">{r.type === 'ORDER' ? 'Track order' : 'View appointment'}</Link>}
          <button type="button" className="btn btn-secondary" onClick={() => window.print()}><Printer size={16} /> Print</button>
          <Link to="/patient/payments" className="btn btn-ghost">All payments</Link>
        </div>
      </div>
    </div>
  );
}

export function PaymentFailed() {
  const { state } = useLocation();
  return (
    <div className="fullscreen-center">
      <div className="card result-card">
        <div className="state-icon state-icon-danger"><XCircle size={30} aria-hidden="true" /></div>
        <h1>Payment not completed</h1>
        <p className="muted">{state?.message || 'The payment did not go through.'}</p>
        <div className="row gap-sm wrap center">
          {state?.returnTo && <Link to={state.returnTo} className="btn btn-primary">Try again</Link>}
          <Link to="/patient/payments" className="btn btn-secondary">View payments</Link>
          <Link to="/patient/dashboard" className="btn btn-ghost">Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
