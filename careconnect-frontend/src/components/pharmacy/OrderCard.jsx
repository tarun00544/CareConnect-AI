import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';
import { formatCurrency, formatDay, shortId } from '../../utils/format';

export default function OrderCard({ order: o, to }) {
  const count = (o.items || []).reduce((s, i) => s + i.quantity, 0);
  return (
    <article className="card order-card">
      <div className="row between gap-sm wrap">
        <div className="row gap-sm">
          <span className="round-icon"><Package size={18} aria-hidden="true" /></span>
          <div>
            <h3>{to ? <Link to={to}>Order #{shortId(o._id)}</Link> : `Order #${shortId(o._id)}`}</h3>
            <div className="muted small">Placed {formatDay(o.createdAt)} · {count} item{count === 1 ? '' : 's'}</div>
          </div>
        </div>
        <strong>{formatCurrency(o.total)}</strong>
      </div>
      <div className="row gap-xs wrap">
        <StatusBadge status={o.orderStatus} size="sm" />
        <StatusBadge status={o.deliveryStatus} size="sm" />
        <StatusBadge status={o.paymentStatus} label={`Payment ${String(o.paymentStatus || '').toLowerCase()}`} size="sm" />
      </div>
      <div className="muted small clamp">{(o.items || []).map((i) => `${i.name} × ${i.quantity}`).join(', ')}</div>
    </article>
  );
}
