import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Pill, ShoppingCart } from 'lucide-react';
import MedicineCard from './MedicineCard';
import SearchBar from '../ui/SearchBar';
import FilterPanel from '../ui/FilterPanel';
import Pagination from '../ui/Pagination';
import EmptyState from '../ui/EmptyState';
import DataState from '../common/DataState';
import { SkeletonCards } from '../ui/Skeleton';
import { useAsync } from '../../hooks/useAsync';
import { useDebounce } from '../../hooks/useDebounce';
import { listMedicines } from '../../services/pharmacyService';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/AppContext';

const LIMIT = 12;

/**
 * Medicine catalogue. `detailBase` links to a detail page; when `shop` is true (patient area) each card gets
 * "Add to cart". On the public site the same cards route people to sign in first.
 */
export default function MedicineCatalog({ detailBase, shop = false }) {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounce(q, 350);
  const cart = useCart();
  const toast = useToast();
  const { isAuthenticated, role } = useAuth();
  const navigate = useNavigate();

  const res = useAsync(() => listMedicines({ search: dq.trim() || undefined, category: category || undefined, page, limit: LIMIT }), [dq, category, page]);
  // Category options come from the catalogue itself (there is no categories endpoint).
  const cats = useAsync(() => listMedicines({ limit: 100 }), []);
  const categories = useMemo(() => [...new Set((cats.data?.items || []).map((m) => m.category).filter(Boolean))].sort().map((c) => ({ value: c, label: c })), [cats.data]);

  const onAdd = (m) => {
    if (!isAuthenticated || role !== 'PATIENT') {
      navigate('/login', { state: { from: '/patient/pharmacy' } });
      return;
    }
    cart.add(m, 1);
    toast.success(`${m.name} added to cart`);
  };

  return (
    <div className="stack">
      <div className="toolbar">
        <SearchBar value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search medicines by name or generic name" label="Search medicines" />
        {shop && (
          <Link to="/patient/cart" className="btn btn-secondary"><ShoppingCart size={16} /> Cart{cart.count ? ` (${cart.count})` : ''}</Link>
        )}
      </div>
      <FilterPanel
        filters={[{ key: 'category', label: 'Categories', value: category, onChange: (v) => { setCategory(v); setPage(1); }, options: categories }]}
        onReset={category || q ? () => { setCategory(''); setQ(''); setPage(1); } : undefined}
      />
      <DataState
        loading={res.loading}
        error={res.error}
        data={res.data}
        isEmpty={(d) => d.items.length === 0}
        onRetry={res.reload}
        skeleton={<SkeletonCards count={6} height={110} />}
        empty={<EmptyState icon={Pill} title="No medicines found" message="Try a different search term or category." />}
      >
        <div className="grid grid-cards">
          {res.data?.items.map((m) => (
            <MedicineCard key={m._id} medicine={m} to={detailBase ? `${detailBase}/${m._id}` : undefined} onAdd={onAdd} />
          ))}
        </div>
        <Pagination pagination={res.data?.pagination} onPage={setPage} />
      </DataState>
    </div>
  );
}
