import { Link } from 'react-router-dom';
import { CreditCard } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import DataState from '../../components/common/DataState';
import DataTable from '../../components/common/DataTable';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { useAsync } from '../../hooks/useAsync';
import { getMyPayments } from '../../services/paymentService';
import { formatCurrency, formatDateTime, paiseToRupees, shortId } from '../../utils/format';

export default function Payments() {
  const { data, loading, error, reload } = useAsync(() => getMyPayments(), []);
  return (
    <div className="stack-lg">
      <PageHeader title="Payments" subtitle="Consultation and medicine order payments." />
      <DataState loading={loading} error={error} data={data} onRetry={reload} skeleton={<SkeletonRows />} empty={<EmptyState icon={CreditCard} title="No payments yet" message="Payments for appointments and orders will appear here." />}>
        <DataTable caption="Payments" rows={data || []} columns={[
          { key: 'ref', header: 'Payment', render: (p) => <Link to={`/patient/payments/${p._id}`}>#{shortId(p._id)}</Link> },
          { key: 'type', header: 'For', render: (p) => (p.type === 'ORDER' ? 'Medicine order' : 'Consultation') },
          { key: 'amount', header: 'Amount', render: (p) => formatCurrency(paiseToRupees(p.amount), p.currency) },
          { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} size="sm" /> },
          { key: 'date', header: 'Date', render: (p) => formatDateTime(p.verifiedAt || p.createdAt) },
        ]} />
      </DataState>
    </div>
  );
}
