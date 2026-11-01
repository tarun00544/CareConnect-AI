import { ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import DataState from '../../components/common/DataState';
import OrderCard from '../../components/pharmacy/OrderCard';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { useAsync } from '../../hooks/useAsync';
import { getMyOrders } from '../../services/orderService';

export default function Orders() {
  const { data, loading, error, reload } = useAsync(() => getMyOrders(), []);
  return (
    <div className="stack-lg">
      <PageHeader title="Orders" subtitle="Track your medicine orders." />
      <DataState loading={loading} error={error} data={data} onRetry={reload} skeleton={<SkeletonRows />}
        empty={<EmptyState icon={ShoppingBag} title="No orders yet" message="Orders you place will show up here." action={<Link to="/patient/pharmacy" className="btn btn-primary">Browse pharmacy</Link>} />}>
        <div className="stack">{(data || []).map((o) => <OrderCard key={o._id} order={o} to={`/patient/orders/${o._id}`} />)}</div>
      </DataState>
    </div>
  );
}
