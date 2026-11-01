import { Link } from 'react-router-dom';
import { FileWarning, Pill, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { formatCurrency } from '../../utils/format';

export function MedicineImage({ src, alt }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className="med-img med-img-fallback"><Pill size={28} aria-hidden="true" /></span>;
  return <img className="med-img" src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}

export function stockState(m) {
  if (m.status && m.status !== 'ACTIVE') return { key: 'unavailable', label: m.status === 'OUT_OF_STOCK' ? 'Out of stock' : 'Unavailable', tone: 'danger' };
  if (m.stock <= 0) return { key: 'out', label: 'Out of stock', tone: 'danger' };
  if (m.stock <= 10) return { key: 'low', label: `Only ${m.stock} left`, tone: 'warning' };
  return { key: 'in', label: 'In stock', tone: 'success' };
}

export default function MedicineCard({ medicine: m, to, onAdd, adding }) {
  const s = stockState(m);
  const disabled = s.key === 'out' || s.key === 'unavailable';
  return (
    <article className="card med-card">
      <MedicineImage src={m.image} alt={m.name} />
      <div className="med-body">
        <div className="row between gap-sm">
          <span className="chip chip-soft">{m.category || 'General'}</span>
          <span className={`stock stock-${s.tone}`}>{s.label}</span>
        </div>
        <h3>{to ? <Link to={to}>{m.name}</Link> : m.name}</h3>
        {m.genericName && <div className="muted small">{m.genericName}{m.manufacturer ? ` · ${m.manufacturer}` : ''}</div>}
        {m.requiresPrescription && (
          <div className="rx-tag"><FileWarning size={14} aria-hidden="true" /> Prescription required</div>
        )}
        <div className="row between">
          <strong className="price">{formatCurrency(m.price)}</strong>
          {onAdd && (
            <button type="button" className="btn btn-primary btn-sm" disabled={disabled || adding} onClick={() => onAdd(m)}>
              <ShoppingCart size={15} /> Add
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

