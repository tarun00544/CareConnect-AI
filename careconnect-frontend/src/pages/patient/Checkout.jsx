import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { CreditCard, FileWarning } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Field from '../../components/ui/Field';
import FormError from '../../components/common/FormError';
import { useCart } from '../../context/CartContext';
import { useAsync } from '../../hooks/useAsync';
import { usePayment } from '../../hooks/usePayment';
import { getMyPrescriptions, getMyProfile } from '../../services/patientService';
import { createOrder } from '../../services/orderService';
import { useToast } from '../../context/AppContext';
import { formatCurrency, formatDay } from '../../utils/format';
import { getFieldErrors } from '../../utils/response';

// Body per orderController/orderService: { items:[{medicineId, quantity, prescriptionId?}], shippingAddress:{line1,line2,city,state,pincode,phone} }
export default function Checkout() {
  const cart = useCart();
  const navigate = useNavigate();
  const toast = useToast();
  const { pay, busy: paying, error: payError } = usePayment();
  const rx = useAsync(() => getMyPrescriptions(), []);
  const profile = useAsync(() => getMyProfile(), []);
  const [addr, setAddr] = useState({ line1: '', line2: '', city: '', state: '', pincode: '', phone: '' });
  const [rxMap, setRxMap] = useState({}); // medicineId -> prescriptionId
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [placed, setPlaced] = useState(null);
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    if (prefilled || !profile.data) return;
    const a = profile.data.address || {};
    setAddr((cur) => ({ ...cur, line1: a.line1 || '', line2: a.line2 || '', city: a.city || '', state: a.state || '', pincode: a.pincode || '' }));
    setPrefilled(true);
  }, [profile.data, prefilled]);

  const needsRx = useMemo(() => cart.lines.filter((l) => l.medicine.requiresPrescription), [cart.lines]);
  const missingRx = needsRx.some((l) => !rxMap[l.medicine._id]);
  const set = (k) => (e) => setAddr((a) => ({ ...a, [k]: e.target.value }));
  const fe = getFieldErrors(error);

  if (cart.lines.length === 0 && !placed) return <Navigate to="/patient/cart" replace />;
  const total = cart.subtotal + cart.estimatedDeliveryFee;
  const addrOk = addr.line1.trim() && addr.city.trim() && addr.state.trim() && addr.pincode.trim() && addr.phone.trim();

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      const order = placed || (await createOrder({
        items: cart.lines.map((l) => ({ medicineId: l.medicine._id, quantity: l.quantity, ...(rxMap[l.medicine._id] ? { prescriptionId: rxMap[l.medicine._id] } : {}) })),
        shippingAddress: Object.fromEntries(Object.entries(addr).map(([k, v]) => [k, v.trim()])),
      }));
      if (!placed) { setPlaced(order); cart.clear(); toast.success('Order placed — complete payment to confirm it.'); }
      setSubmitting(false);
      await pay({ type: 'ORDER', referenceId: order._id, description: 'Medicine order', returnTo: `/patient/orders/${order._id}` });
    } catch (err) { setError(err); setSubmitting(false); }
  };

  return (
    <div className="stack-lg">
      <PageHeader title="Checkout" subtitle="Delivery details, prescriptions and payment." />
      <form className="grid cart-layout align-start" onSubmit={submit}>
        <div className="stack">
          {needsRx.length > 0 && (
            <section className="card stack">
              <h3><FileWarning size={18} /> Prescriptions required</h3>
              <p className="muted small">Choose one of your prescriptions for each prescription-only medicine. The pharmacy verifies that it belongs to you.</p>
              {rx.loading ? <p className="muted">Loading your prescriptions…</p> : rx.error ? <div className="field-error">{rx.error.message} <button type="button" className="link-btn" onClick={rx.reload}>Retry</button></div> : (rx.data || []).length === 0 ? (
                <div className="form-error"><div>You have no prescriptions on file, so prescription-only items can't be ordered. Remove them or <Link to="/patient/appointments/book">book a consultation</Link>.</div></div>
              ) : needsRx.map((l) => (
                <Field key={l.medicine._id} label={l.medicine.name} htmlFor={`rx-${l.medicine._id}`} required>
                  <select id={`rx-${l.medicine._id}`} className="select" value={rxMap[l.medicine._id] || ''} onChange={(e) => setRxMap((m) => ({ ...m, [l.medicine._id]: e.target.value }))} disabled={!!placed}>
                    <option value="">Select a prescription…</option>
                    {rx.data.map((p) => <option key={p._id} value={p._id}>{formatDay(p.createdAt)} — {(p.medicines || []).map((x) => x.name).join(', ')}</option>)}
                  </select>
                </Field>
              ))}
            </section>
          )}
          <section className="card stack">
            <h3>Delivery address</h3>
            <Field label="Address line 1" htmlFor="l1" required error={fe['shippingAddress.line1']}><input id="l1" className="input" value={addr.line1} onChange={set('line1')} autoComplete="address-line1" disabled={!!placed} /></Field>
            <Field label="Address line 2" htmlFor="l2"><input id="l2" className="input" value={addr.line2} onChange={set('line2')} autoComplete="address-line2" disabled={!!placed} /></Field>
            <div className="grid grid-2">
              <Field label="City" htmlFor="city" required><input id="city" className="input" value={addr.city} onChange={set('city')} autoComplete="address-level2" disabled={!!placed} /></Field>
              <Field label="State" htmlFor="state" required><input id="state" className="input" value={addr.state} onChange={set('state')} autoComplete="address-level1" disabled={!!placed} /></Field>
              <Field label="Pincode" htmlFor="pin" required><input id="pin" className="input" inputMode="numeric" value={addr.pincode} onChange={set('pincode')} autoComplete="postal-code" disabled={!!placed} /></Field>
              <Field label="Phone" htmlFor="ph" required><input id="ph" type="tel" className="input" value={addr.phone} onChange={set('phone')} autoComplete="tel" disabled={!!placed} /></Field>
            </div>
          </section>
        </div>
        <aside className="card stack-sm">
          <h3>Order summary</h3>
          {placed ? (
            <>
              <p className="small">Order placed. Total {formatCurrency(placed.total)}.</p>
              <p className="muted small">Complete the payment to confirm it. You can also pay later from <Link to={`/patient/orders/${placed._id}`}>the order page</Link>.</p>
            </>
          ) : (
            <>
              {cart.lines.map((l) => <div key={l.medicine._id} className="row between small"><span>{l.medicine.name} × {l.quantity}</span><span>{formatCurrency(l.medicine.price * l.quantity)}</span></div>)}
              <div className="row between"><span>Delivery (estimate)</span><span>{cart.estimatedDeliveryFee ? formatCurrency(cart.estimatedDeliveryFee) : 'Free'}</span></div>
              <div className="row between summary-total"><strong>Estimated total</strong><strong>{formatCurrency(total)}</strong></div>
            </>
          )}
          <FormError error={error} />
          {payError && !error && <div className="field-error">{payError.message}</div>}
          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={submitting || paying || (!placed && (!addrOk || missingRx))}>
            <CreditCard size={17} /> {submitting ? 'Placing order…' : paying ? 'Opening payment…' : placed ? 'Retry payment' : 'Place order & pay'}
          </button>
          <p className="muted small">The total is calculated by the pharmacy from current prices.</p>
        </aside>
      </form>
    </div>
  );
}
