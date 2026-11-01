import { Link } from 'react-router-dom';
import { FileWarning, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import { MedicineImage } from '../../components/pharmacy/MedicineCard';
import { useCart } from '../../context/CartContext';
import { formatCurrency } from '../../utils/format';

export default function Cart() {
  const cart = useCart();
  if (cart.lines.length === 0) {
    return (
      <div className="stack-lg">
        <PageHeader title="Your cart" />
        <div className="card"><EmptyState icon={ShoppingCart} title="Your cart is empty" message="Browse the pharmacy to add medicines." action={<Link to="/patient/pharmacy" className="btn btn-primary">Browse pharmacy</Link>} /></div>
      </div>
    );
  }
  const total = cart.subtotal + cart.estimatedDeliveryFee;
  return (
    <div className="stack-lg">
      <PageHeader title="Your cart" subtitle={`${cart.count} item${cart.count === 1 ? '' : 's'}`} actions={<button className="btn btn-ghost" onClick={cart.clear}>Clear cart</button>} />
      <div className="grid cart-layout align-start">
        <div className="stack">
          {cart.lines.map(({ medicine: m, quantity }) => (
            <article key={m._id} className="card cart-line">
              <MedicineImage src={m.image} alt={m.name} />
              <div className="cart-info">
                <h3><Link to={`/patient/pharmacy/${m._id}`}>{m.name}</Link></h3>
                <div className="muted small">{formatCurrency(m.price)} each</div>
                {m.requiresPrescription && <div className="rx-tag"><FileWarning size={13} /> Prescription required</div>}
              </div>
              <div className="qty" role="group" aria-label={`Quantity for ${m.name}`}>
                <button type="button" className="icon-btn" onClick={() => cart.setQty(m._id, quantity - 1)} disabled={quantity <= 1} aria-label="Decrease"><Minus size={15} /></button>
                <span>{quantity}</span>
                <button type="button" className="icon-btn" onClick={() => cart.setQty(m._id, quantity + 1)} disabled={quantity >= m.stock} aria-label="Increase"><Plus size={15} /></button>
              </div>
              <strong>{formatCurrency(m.price * quantity)}</strong>
              <button type="button" className="icon-btn" onClick={() => cart.remove(m._id)} aria-label={`Remove ${m.name}`}><Trash2 size={16} /></button>
            </article>
          ))}
        </div>
        <aside className="card stack-sm">
          <h3>Summary</h3>
          <div className="row between"><span>Subtotal</span><span>{formatCurrency(cart.subtotal)}</span></div>
          <div className="row between"><span>Delivery (estimate)</span><span>{cart.estimatedDeliveryFee ? formatCurrency(cart.estimatedDeliveryFee) : 'Free'}</span></div>
          <div className="row between summary-total"><strong>Estimated total</strong><strong>{formatCurrency(total)}</strong></div>
          <p className="muted small">Final prices, stock and prescription rules are confirmed by the pharmacy at checkout.</p>
          <Link to="/patient/checkout" className="btn btn-primary btn-block">Proceed to checkout</Link>
        </aside>
      </div>
    </div>
  );
}
