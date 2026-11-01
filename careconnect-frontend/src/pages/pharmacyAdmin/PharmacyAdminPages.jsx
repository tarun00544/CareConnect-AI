import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Ban, Boxes, Eye, FileWarning, Package, Pencil, Pill, Plus, RefreshCw, Search, ShoppingBag } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import Field from '../../components/ui/Field';
import SearchBar from '../../components/ui/SearchBar';
import Pagination from '../../components/ui/Pagination';
import EmptyState from '../../components/ui/EmptyState';
import DataState from '../../components/common/DataState';
import DataTable from '../../components/common/DataTable';
import FormError from '../../components/common/FormError';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { stockState } from '../../components/pharmacy/MedicineCard';
import { useAsync } from '../../hooks/useAsync';
import { useDebounce } from '../../hooks/useDebounce';
import { useConfirm, useToast } from '../../context/AppContext';
import { createMedicine, discontinueMedicine, listMedicines, updateMedicine } from '../../services/pharmacyService';
import { getOrder, listOrders, updateDeliveryStatus, updateOrderStatus } from '../../services/orderService';
import { DELIVERY_STATUS, ORDER_STATUS } from '../../constants';
import { addressLine, formatCurrency, formatDateTime, shortId, titleCase } from '../../utils/format';
import { getFieldErrors } from '../../utils/response';

const LOW = 10;

/* ---------------------------------------------------------------- Dashboard */
export function PharmacyDashboard() {
  const { data: medData, loading: medLoading, error: medError, reload: reloadMeds } = useAsync(() => listMedicines({ limit: 100 }), []);
  const { data: orderData, loading: orderLoading, reload: reloadOrders } = useAsync(() => listOrders({ limit: 10 }), []);

  const items = medData?.items || [];
  const low = items.filter((m) => m.stock > 0 && m.stock <= LOW);
  const out = items.filter((m) => m.stock <= 0);

  const orders = orderData?.items || [];
  const pendingOrders = orders.filter((o) => ['PLACED', 'CONFIRMED', 'PROCESSING'].includes(o.orderStatus));

  const reload = () => {
    reloadMeds();
    reloadOrders();
  };

  const loading = medLoading || orderLoading;

  return (
    <div className="stack-lg">
      <PageHeader
        title="Pharmacy Dashboard"
        subtitle="Catalogue, stock levels, and active medicine orders."
        actions={
          <button className="btn btn-secondary" onClick={reload} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
          </button>
        }
      />

      <DataState loading={medLoading} error={medError} data={medData} onRetry={reload} skeleton={<SkeletonRows />}>
        <div className="grid grid-stats">
          <StatCard label="Active medicines" value={medData?.pagination?.total ?? items.length} icon={Pill} />
          <StatCard
            label="Pending Orders"
            value={pendingOrders.length}
            icon={ShoppingBag}
            tone="teal"
            hint={`${orders.length} total recent`}
          />
          <StatCard label="Low stock" value={low.length} icon={AlertTriangle} tone="amber" hint={`≤ ${LOW} units`} />
          <StatCard label="Out of stock" value={out.length} icon={Ban} tone="red" />
        </div>

        {orders.length > 0 && (
          <section className="card stack">
            <div className="row between">
              <h3>Recent Medicine Orders</h3>
              <Link to="/pharmacy-admin/orders" className="btn btn-secondary btn-sm">
                View all orders
              </Link>
            </div>
            <table className="table table-plain">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Delivery</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 5).map((o) => (
                  <tr key={o._id}>
                    <td>
                      <Link to="/pharmacy-admin/orders" className="font-semibold">
                        #{shortId(o._id)}
                      </Link>
                    </td>
                    <td>{o.patientId?.userId?.name || o.shippingAddress?.phone || 'Patient'}</td>
                    <td>{formatCurrency(o.total)}</td>
                    <td><StatusBadge status={o.orderStatus} /></td>
                    <td><StatusBadge status={o.deliveryStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {(low.length > 0 || out.length > 0) && (
          <section className="card">
            <h3>Needs restocking</h3>
            <table className="table table-plain">
              <tbody>
                {[...out, ...low].slice(0, 8).map((m) => (
                  <tr key={m._id}>
                    <td>{m.name}</td>
                    <td><span className={`stock stock-${stockState(m).tone}`}>{stockState(m).label}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Link to="/pharmacy-admin/inventory" className="btn btn-secondary btn-sm" style={{ marginTop: 10 }}>
              Open inventory
            </Link>
          </section>
        )}

        <div className="grid grid-actions">
          <Link to="/pharmacy-admin/orders" className="action-tile">
            <ShoppingBag size={22} />
            <span>Manage Orders</span>
          </Link>
          <Link to="/pharmacy-admin/medicines" className="action-tile">
            <Pill size={22} />
            <span>Manage medicines</span>
          </Link>
          <Link to="/pharmacy-admin/inventory" className="action-tile">
            <Boxes size={22} />
            <span>Inventory</span>
          </Link>
        </div>
      </DataState>
    </div>
  );
}

/* ---------------------------------------------------------------- Medicines (CRUD) */
const EMPTY = { name: '', genericName: '', category: '', manufacturer: '', description: '', price: '', stock: '', image: '', requiresPrescription: false, status: 'ACTIVE' };

function MedicineForm({ medicine, onClose, onSaved }) {
  const toast = useToast();
  const editing = !!medicine?._id;
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  useEffect(() => { setF(medicine ? { ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, medicine[k] ?? EMPTY[k]])) } : EMPTY); setErr(null); }, [medicine]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const ok = f.name.trim() && f.price !== '' && Number(f.price) >= 0 && f.stock !== '' && Number(f.stock) >= 0;
  const fe = getFieldErrors(err);

  const save = async () => {
    setBusy(true); setErr(null);
    const payload = { name: f.name.trim(), genericName: f.genericName.trim(), category: f.category.trim(), manufacturer: f.manufacturer.trim(), description: f.description.trim(), price: Number(f.price), stock: Math.floor(Number(f.stock)), requiresPrescription: !!f.requiresPrescription, status: f.status };
    if (f.image.trim()) payload.image = f.image.trim();
    try { editing ? await updateMedicine(medicine._id, payload) : await createMedicine(payload); toast.success(editing ? 'Medicine updated' : 'Medicine added'); onSaved(); }
    catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <Modal open={medicine !== null} onClose={onClose} size="lg" title={editing ? `Edit ${medicine.name}` : 'Add medicine'} footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!ok || busy} onClick={save}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add medicine'}</button></>}>
      <div className="stack">
        <div className="grid grid-2">
          <Field label="Name" htmlFor="mname" required error={fe.name}><input id="mname" className="input" value={f.name} onChange={set('name')} /></Field>
          <Field label="Generic name" htmlFor="mgen"><input id="mgen" className="input" value={f.genericName} onChange={set('genericName')} /></Field>
          <Field label="Category" htmlFor="mcat"><input id="mcat" className="input" value={f.category} onChange={set('category')} placeholder="e.g. Antibiotic" /></Field>
          <Field label="Manufacturer" htmlFor="mman"><input id="mman" className="input" value={f.manufacturer} onChange={set('manufacturer')} /></Field>
          <Field label="Price (₹)" htmlFor="mprice" required><input id="mprice" type="number" min="0" step="0.01" className="input" value={f.price} onChange={set('price')} /></Field>
          <Field label="Stock (units)" htmlFor="mstock" required><input id="mstock" type="number" min="0" step="1" className="input" value={f.stock} onChange={set('stock')} /></Field>
          <Field label="Image URL" htmlFor="mimg" hint="Optional link to an image"><input id="mimg" type="url" className="input" value={f.image} onChange={set('image')} /></Field>
          <Field label="Status" htmlFor="mstat"><select id="mstat" className="select" value={f.status} onChange={set('status')}>{['ACTIVE', 'OUT_OF_STOCK', 'DISCONTINUED'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</select></Field>
        </div>
        <Field label="Description" htmlFor="mdesc"><textarea id="mdesc" className="input" rows={3} value={f.description} onChange={set('description')} /></Field>
        <label className="check"><input type="checkbox" checked={f.requiresPrescription} onChange={set('requiresPrescription')} /> <span>Requires a prescription</span></label>
        <FormError error={err} />
      </div>
    </Modal>
  );
}

export function PharmacyMedicines() {
  const toast = useToast();
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 350);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null); // null closed | {} new | medicine
  const { data, loading, error, reload } = useAsync(() => listMedicines({ search: dq.trim() || undefined, page, limit: 15 }), [dq, page]);

  const discontinue = async (m) => {
    if (!(await confirm({ title: `Discontinue ${m.name}?`, message: 'It will disappear from the patient catalogue. Existing orders are unaffected.', confirmLabel: 'Discontinue', tone: 'danger' }))) return;
    try { await discontinueMedicine(m._id); toast.success('Medicine discontinued'); reload(); } catch (e) { toast.error(e.message); }
  };
  return (
    <div className="stack-lg">
      <PageHeader title="Medicines" subtitle="Add, edit and discontinue catalogue items." actions={<button className="btn btn-primary" onClick={() => setEditing({})}><Plus size={16} /> Add medicine</button>} />
      <SearchBar value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search by name or generic name" label="Search medicines" />
      <DataState loading={loading} error={error} data={data} onRetry={reload} skeleton={<SkeletonRows />} isEmpty={(d) => !d.items.length} empty={<EmptyState icon={Pill} title="No medicines found" />}>
        <DataTable caption="Medicines" rows={data?.items || []} columns={[
          { key: 'name', header: 'Medicine', render: (m) => <><strong>{m.name}</strong><div className="muted small">{m.genericName}</div></> },
          { key: 'cat', header: 'Category', render: (m) => m.category || '—' },
          { key: 'price', header: 'Price', render: (m) => formatCurrency(m.price) },
          { key: 'stock', header: 'Stock', render: (m) => <span className={`stock stock-${stockState(m).tone}`}>{m.stock}</span> },
          { key: 'rx', header: 'Rx', render: (m) => (m.requiresPrescription ? <span className="chip chip-soft">Required</span> : '—') },
          { key: 'act', header: '', render: (m) => (
            <div className="row gap-xs"><button className="btn btn-secondary btn-sm" onClick={() => setEditing(m)}><Pencil size={14} /> Edit</button><button className="btn btn-danger-outline btn-sm" onClick={() => discontinue(m)}>Discontinue</button></div>
          ) },
        ]} />
        <Pagination pagination={data?.pagination} onPage={setPage} />
      </DataState>
      <p className="muted small">The backend lists only ACTIVE medicines, so discontinued or out-of-stock-status items disappear from this view once saved.</p>
      <MedicineForm medicine={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
    </div>
  );
}

/* ---------------------------------------------------------------- Inventory (stock edits) */
export function PharmacyInventory() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [draft, setDraft] = useState({});
  const [busyId, setBusyId] = useState(null);
  const { data, loading, error, reload } = useAsync(() => listMedicines({ page, limit: 20 }), [page]);
  const items = useMemo(() => (data?.items || []).filter((m) => filter === 'all' || (filter === 'low' && m.stock > 0 && m.stock <= LOW) || (filter === 'out' && m.stock <= 0)), [data, filter]);

  const saveStock = async (m) => {
    const v = Math.floor(Number(draft[m._id]));
    if (!(v >= 0)) return toast.error('Enter a valid stock quantity.');
    setBusyId(m._id);
    try { await updateMedicine(m._id, { stock: v }); toast.success(`${m.name} stock set to ${v}`); setDraft(({ [m._id]: _d, ...r }) => r); reload(); }
    catch (e) { toast.error(e.message); } finally { setBusyId(null); }
  };
  return (
    <div className="stack-lg">
      <PageHeader title="Inventory" subtitle="Update stock levels." />
      <div className="filter-panel"><select className="select" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Stock filter"><option value="all">All stock levels</option><option value="low">Low stock (≤ {LOW})</option><option value="out">Out of stock</option></select></div>
      <DataState loading={loading} error={error} data={data} onRetry={reload} skeleton={<SkeletonRows />} isEmpty={() => items.length === 0} empty={<EmptyState icon={Boxes} title="Nothing matches this filter" />}>
        <DataTable caption="Inventory" rows={items} columns={[
          { key: 'name', header: 'Medicine', render: (m) => <strong>{m.name}</strong> },
          { key: 'cat', header: 'Category', render: (m) => m.category || '—' },
          { key: 'state', header: 'Level', render: (m) => <span className={`stock stock-${stockState(m).tone}`}>{stockState(m).label}</span> },
          { key: 'stock', header: 'Stock', render: (m) => (
            <div className="row gap-xs"><input type="number" min="0" step="1" className="input input-sm" aria-label={`Stock for ${m.name}`} value={draft[m._id] ?? m.stock} onChange={(e) => setDraft((d) => ({ ...d, [m._id]: e.target.value }))} />
              <button className="btn btn-primary btn-sm" disabled={busyId === m._id || draft[m._id] === undefined || Number(draft[m._id]) === m.stock} onClick={() => saveStock(m)}>Save</button></div>
          ) },
        ]} />
        <Pagination pagination={data?.pagination} onPage={setPage} />
      </DataState>
    </div>
  );
}

/* ---------------------------------------------------------------- Orders Management */
export function PharmacyOrders() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 350);
  const [orderStatus, setOrderStatus] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [working, setWorking] = useState(false);

  const { data, loading, error, reload } = useAsync(
    () =>
      listOrders({
        page,
        limit: 15,
        orderStatus: orderStatus || undefined,
        deliveryStatus: deliveryStatus || undefined,
        q: dq.trim() || undefined,
      }),
    [page, orderStatus, deliveryStatus, dq]
  );

  const upd = async (fn, msg) => {
    setWorking(true);
    try {
      const updated = await fn();
      toast.success(msg);
      setSelectedOrder(updated);
      reload();
    } catch (x) {
      toast.error(x.message);
    } finally {
      setWorking(false);
    }
  };

  const getCustomerName = (o) => {
    if (o.patientId?.userId?.name) return o.patientId.userId.name;
    if (o.shippingAddress?.phone) return `Patient (${o.shippingAddress.phone})`;
    return 'Patient';
  };

  return (
    <div className="stack-lg">
      <PageHeader
        title="Medicine Orders"
        subtitle="Manage and fulfill patient medicine orders with live status tracking."
        actions={
          <button className="btn btn-secondary" onClick={reload} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
          </button>
        }
      />

      <div className="card row gap-sm wrap between">
        <div style={{ flex: 1, minWidth: 260 }}>
          <SearchBar
            value={q}
            onChange={(v) => { setQ(v); setPage(1); }}
            placeholder="Search by 24-char Order ID..."
            label="Search orders"
          />
        </div>
        <div className="row gap-xs wrap">
          <select
            className="select"
            value={orderStatus}
            onChange={(e) => { setOrderStatus(e.target.value); setPage(1); }}
            aria-label="Filter by order status"
          >
            <option value="">All Order Statuses</option>
            {Object.values(ORDER_STATUS).map((s) => (
              <option key={s} value={s}>{titleCase(s)}</option>
            ))}
          </select>

          <select
            className="select"
            value={deliveryStatus}
            onChange={(e) => { setDeliveryStatus(e.target.value); setPage(1); }}
            aria-label="Filter by delivery status"
          >
            <option value="">All Delivery Statuses</option>
            {Object.values(DELIVERY_STATUS).map((s) => (
              <option key={s} value={s}>{titleCase(s)}</option>
            ))}
          </select>
        </div>
      </div>

      <DataState
        loading={loading}
        error={error}
        data={data}
        onRetry={reload}
        skeleton={<SkeletonRows />}
        isEmpty={(d) => !d.items || d.items.length === 0}
        empty={
          <EmptyState
            icon={ShoppingBag}
            title="No orders found"
            description="No orders match your search criteria or filters."
          />
        }
      >
        <DataTable
          caption="Medicine Orders"
          rows={data?.items || []}
          columns={[
            {
              key: 'id',
              header: 'Order #',
              render: (o) => (
                <div>
                  <strong>#{shortId(o._id)}</strong>
                  <div className="muted small">{formatDateTime(o.createdAt)}</div>
                </div>
              ),
            },
            {
              key: 'customer',
              header: 'Customer',
              render: (o) => (
                <div>
                  <strong>{getCustomerName(o)}</strong>
                  <div className="muted small">{o.shippingAddress?.phone || o.patientId?.userId?.phone || '—'}</div>
                </div>
              ),
            },
            {
              key: 'items',
              header: 'Items',
              render: (o) => (
                <div>
                  <span>{o.items?.length || 0} item{(o.items?.length || 0) > 1 ? 's' : ''}</span>
                  <div className="muted small ellipsis" style={{ maxWidth: 180 }}>
                    {o.items?.map((i) => i.name).join(', ')}
                  </div>
                </div>
              ),
            },
            {
              key: 'total',
              header: 'Total',
              render: (o) => <strong>{formatCurrency(o.total)}</strong>,
            },
            {
              key: 'orderStatus',
              header: 'Order Status',
              render: (o) => <StatusBadge status={o.orderStatus} />,
            },
            {
              key: 'deliveryStatus',
              header: 'Delivery',
              render: (o) => <StatusBadge status={o.deliveryStatus} />,
            },
            {
              key: 'paymentStatus',
              header: 'Payment',
              render: (o) => (
                <StatusBadge status={o.paymentStatus} label={o.paymentStatus} />
              ),
            },
            {
              key: 'actions',
              header: '',
              render: (o) => (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSelectedOrder(o)}
                >
                  <Eye size={14} /> Manage
                </button>
              ),
            },
          ]}
        />
        <Pagination pagination={data?.pagination} onPage={setPage} />
      </DataState>

      {selectedOrder && (
        <Modal
          open={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          size="lg"
          title={`Order #${shortId(selectedOrder._id)}`}
          footer={
            <button className="btn btn-primary" onClick={() => setSelectedOrder(null)}>
              Done
            </button>
          }
        >
          <div className="stack">
            <div className="row between wrap gap-sm border-b pb-sm">
              <div>
                <strong>Customer: {getCustomerName(selectedOrder)}</strong>
                <div className="muted small">Placed {formatDateTime(selectedOrder.createdAt)}</div>
              </div>
              <div className="row gap-xs">
                <StatusBadge status={selectedOrder.orderStatus} />
                <StatusBadge status={selectedOrder.deliveryStatus} />
                <StatusBadge status={selectedOrder.paymentStatus} label={`Payment ${selectedOrder.paymentStatus}`} />
              </div>
            </div>

            <div>
              <h4 className="mb-xs">Order Items</h4>
              <table className="table table-plain">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th className="right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items.map((i, k) => (
                    <tr key={k}>
                      <td>
                        <strong>{i.name}</strong>
                        {i.requiresPrescription && (
                          <span className="chip chip-soft" style={{ marginLeft: 8 }}>
                            Rx
                          </span>
                        )}
                      </td>
                      <td>× {i.quantity}</td>
                      <td>{formatCurrency(i.unitPrice)}</td>
                      <td className="right">{formatCurrency(i.unitPrice * i.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="right muted">Delivery Fee:</td>
                    <td className="right">{formatCurrency(selectedOrder.deliveryFee || 0)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="right"><strong>Total:</strong></td>
                    <td className="right"><strong>{formatCurrency(selectedOrder.total)}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="card-soft p-sm rounded">
              <strong>Delivery Address:</strong>
              <div>{addressLine(selectedOrder.shippingAddress) || '—'}</div>
              {selectedOrder.shippingAddress?.phone && (
                <div className="muted small">Contact: {selectedOrder.shippingAddress.phone}</div>
              )}
            </div>

            <div className="grid grid-2 gap-md border-t pt-md">
              <Field label="Update Order Status" htmlFor="modal-os">
                <select
                  id="modal-os"
                  className="select"
                  value={selectedOrder.orderStatus}
                  disabled={working}
                  onChange={(e) =>
                    upd(
                      () => updateOrderStatus(selectedOrder._id, e.target.value),
                      'Order status updated'
                    )
                  }
                >
                  {Object.values(ORDER_STATUS).map((s) => (
                    <option key={s} value={s}>
                      {titleCase(s)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Update Delivery Status" htmlFor="modal-ds">
                <select
                  id="modal-ds"
                  className="select"
                  value={selectedOrder.deliveryStatus}
                  disabled={working}
                  onChange={(e) =>
                    upd(
                      () => updateDeliveryStatus(selectedOrder._id, e.target.value),
                      'Delivery status updated'
                    )
                  }
                >
                  {Object.values(DELIVERY_STATUS).map((s) => (
                    <option key={s} value={s}>
                      {titleCase(s)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <p className="muted small">
              Status updates trigger real-time Socket.IO and persistent notifications to the patient.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
