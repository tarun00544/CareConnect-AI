import { Link, useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import DataState from '../../components/common/DataState';
import { useAsync } from '../../hooks/useAsync';
import { getPayment } from '../../services/paymentService';
import { formatCurrency, formatDateTime, paiseToRupees, shortId } from '../../utils/format';

export default function PaymentDetail() {
  const { id } = useParams();
  const { data: p, loading, error, reload } = useAsync(() => getPayment(id), [id]);
  const target = p ? (p.type === 'ORDER' ? `/patient/orders/${p.referenceId}` : `/patient/appointments/${p.referenceId}`) : null;
  return (
    <div className="stack-lg">
      <DataState loading={loading} error={error} data={p} onRetry={reload}>
        {p && (
          <>
            <PageHeader title={`Payment #${shortId(p._id)}`} actions={<button className="btn btn-secondary" onClick={() => window.print()}><Printer size={16} /> Print receipt</button>} />
            <section className="card receipt">
              <dl className="summary">
                <div><dt>Status</dt><dd><StatusBadge status={p.status} /></dd></div>
                <div><dt>For</dt><dd>{p.type === 'ORDER' ? 'Medicine order' : 'Consultation'} · <Link to={target}>view</Link></dd></div>
                <div><dt>Amount</dt><dd>{formatCurrency(paiseToRupees(p.amount), p.currency)}</dd></div>
                <div><dt>Razorpay order</dt><dd className="mono">{p.razorpayOrderId}</dd></div>
                {p.razorpayPaymentId && <div><dt>Transaction ID</dt><dd className="mono">{p.razorpayPaymentId}</dd></div>}
                <div><dt>Created</dt><dd>{formatDateTime(p.createdAt)}</dd></div>
                {p.verifiedAt && <div><dt>Verified</dt><dd>{formatDateTime(p.verifiedAt)}</dd></div>}
              </dl>
            </section>
          </>
        )}
      </DataState>
    </div>
  );
}
