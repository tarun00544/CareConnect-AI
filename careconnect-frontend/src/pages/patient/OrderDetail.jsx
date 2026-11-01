import { Link, useParams } from 'react-router-dom';
import { Check, CreditCard } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import DataState from '../../components/common/DataState';
import { useAsync } from '../../hooks/useAsync';
import { usePayment } from '../../hooks/usePayment';
import { getOrder } from '../../services/orderService';
import { ORDER_FLOW } from '../../constants';
import { addressLine, formatCurrency, formatDateTime, shortId } from '../../utils/format';
import { statusMeta } from '../../constants/statusMeta';

export default function OrderDetail() {
  const { id } = useParams();
  const { data: o, loading, error, reload } = useAsync(() => getOrder(id), [id]);
  const { pay, busy, error: payError } = usePayment();
  const cancelled = o?.orderStatus === 'CANCELLED';
  const idx = o ? ORDER_FLOW.indexOf(o.orderStatus) : -1;
  return (
    <div className="stack-lg">
      <DataState loading={loading} error={error} data={o} onRetry={reload}>
        {o && (
          <>
            <PageHeader title={`Order #${shortId(o._id)}`} subtitle={`Placed ${formatDateTime(o.createdAt)}`} actions={<StatusBadge status={o.orderStatus} />} />
            <section className="card">
              <h3>Tracking</h3>
              {cancelled ? <p className="muted">This order was cancelled.</p> : (
                <ol className="track">
                  {ORDER_FLOW.map((s, i) => (
                    <li key={s} className={i < idx ? 'done' : i === idx ? 'current' : ''} aria-current={i === idx ? 'step' : undefined}>
                      <span className="track-dot">{i <= idx ? <Check size={13} /> : null}</span><span>{statusMeta(s).label}</span>
                    </li>
                  ))}
                </ol>
              )}
              <div className="row gap-xs wrap"><span className="muted small">Delivery:</span><StatusBadge status={o.deliveryStatus} size="sm" /></div>
            </section>
            <div className="grid grid-2 align-start">
              <section className="card">
                <h3>Items</h3>
                <table className="table table-plain"><tbody>
                  {o.items.map((i, k) => <tr key={k}><td>{i.name}{i.requiresPrescription && <span className="chip chip-soft" style={{ marginLeft: 8 }}>Rx</span>}</td><td>× {i.quantity}</td><td className="right">{formatCurrency(i.unitPrice * i.quantity)}</td></tr>)}
                </tbody></table>
                <div className="stack-sm" style={{ marginTop: 12 }}>
                  <div className="row between"><span>Subtotal</span><span>{formatCurrency(o.subtotal)}</span></div>
                  <div className="row between"><span>Delivery</span><span>{o.deliveryFee ? formatCurrency(o.deliveryFee) : 'Free'}</span></div>
                  <div className="row between summary-total"><strong>Total</strong><strong>{formatCurrency(o.total)}</strong></div>
                </div>
              </section>
              <section className="card stack">
                <div><h3>Payment</h3><StatusBadge status={o.paymentStatus} />
                  {o.paymentId && <div style={{ marginTop: 8 }}><Link to={`/patient/payments/${o.paymentId}`} className="small">View receipt</Link></div>}</div>
                {o.paymentStatus !== 'PAID' && !cancelled && (
                  <div>
                    <button type="button" className="btn btn-primary" disabled={busy} onClick={() => pay({ type: 'ORDER', referenceId: o._id, description: 'Medicine order', returnTo: `/patient/orders/${o._id}` })}><CreditCard size={16} /> {busy ? 'Opening payment…' : 'Pay now'}</button>
                    {payError && <div className="field-error">{payError.message}</div>}
                  </div>
                )}
                <div><h3>Delivery address</h3><p>{addressLine(o.shippingAddress) || '—'}</p>{o.shippingAddress?.phone && <p className="muted">{o.shippingAddress.phone}</p>}</div>
              </section>
            </div>
          </>
        )}
      </DataState>
    </div>
  );
}
