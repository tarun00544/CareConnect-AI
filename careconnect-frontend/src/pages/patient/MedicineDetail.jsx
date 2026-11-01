import { Link, useParams } from 'react-router-dom';
import { FileWarning, Minus, Plus, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import PageHeader from '../../components/ui/PageHeader';
import DataState from '../../components/common/DataState';
import { MedicineImage, stockState } from '../../components/pharmacy/MedicineCard';
import { useAsync } from '../../hooks/useAsync';
import { getMedicine } from '../../services/pharmacyService';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/AppContext';
import { formatCurrency } from '../../utils/format';

export default function MedicineDetail() {
  const { id } = useParams();
  const { data: m, loading, error, reload } = useAsync(() => getMedicine(id), [id]);
  const cart = useCart();
  const toast = useToast();
  const [qty, setQty] = useState(1);
  const s = m ? stockState(m) : null;
  const unavailable = s && (s.key === 'out' || s.key === 'unavailable');
  return (
    <div className="stack-lg">
      <DataState loading={loading} error={error} data={m} onRetry={reload}>
        {m && (
          <>
            <PageHeader title={m.name} subtitle={[m.genericName, m.manufacturer].filter(Boolean).join(' · ')} />
            <div className="grid grid-2 align-start">
              <section className="card center"><MedicineImage src={m.image} alt={m.name} /></section>
              <section className="card stack">
                <div className="row between"><span className="chip chip-soft">{m.category || 'General'}</span><span className={`stock stock-${s.tone}`}>{s.label}</span></div>
                <div className="price price-lg">{formatCurrency(m.price)}</div>
                {m.description && <p>{m.description}</p>}
                {m.requiresPrescription && <div className="rx-tag"><FileWarning size={15} /> Prescription required — you'll select one of your prescriptions at checkout.</div>}
                <div className="row gap-sm wrap">
                  <div className="qty" role="group" aria-label="Quantity">
                    <button type="button" className="icon-btn" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity"><Minus size={15} /></button>
                    <span aria-live="polite">{qty}</span>
                    <button type="button" className="icon-btn" onClick={() => setQty((q) => Math.min(m.stock, q + 1))} aria-label="Increase quantity" disabled={qty >= m.stock}><Plus size={15} /></button>
                  </div>
                  <button type="button" className="btn btn-primary" disabled={unavailable} onClick={() => { cart.add(m, qty); toast.success(`${m.name} added to cart`); }}><ShoppingCart size={16} /> Add to cart</button>
                  <Link to="/patient/cart" className="btn btn-secondary">View cart</Link>
                </div>
              </section>
            </div>
          </>
        )}
      </DataState>
    </div>
  );
}
