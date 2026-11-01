import api from './api';
import { unwrap, toList } from '../utils/response';

// POST /api/orders (PATIENT) body: { items:[{ medicineId, quantity, prescriptionId? }],
//   shippingAddress:{ line1, line2, city, state, pincode, phone } } → Order
// Prices/totals are computed server-side; Rx-only medicines require a prescriptionId owned by the patient.
export const createOrder = async ({ items, shippingAddress }) =>
  unwrap(await api.post('/api/orders', { items, shippingAddress }));

// GET /api/orders/my (PATIENT) → Order[] (plain array, not paginated)
export const getMyOrders = async () => toList(unwrap(await api.get('/api/orders/my')));

// GET /api/orders (PHARMACY_ADMIN | SUPER_ADMIN)
export const listOrders = async ({ page = 1, limit = 20, orderStatus, paymentStatus, deliveryStatus, q } = {}) => {
  const params = { page, limit };
  if (orderStatus) params.orderStatus = orderStatus;
  if (paymentStatus) params.paymentStatus = paymentStatus;
  if (deliveryStatus) params.deliveryStatus = deliveryStatus;
  if (q) params.q = q;
  const res = unwrap(await api.get('/api/orders', { params }));
  return {
    items: toList(res),
    pagination: res?.pagination || { page, limit, total: 0, totalPages: 1 },
  };
};

// GET /api/orders/:id (patients may only read their own; PHARMACY_ADMIN and SUPER_ADMIN have full access)
export const getOrder = async (id) => unwrap(await api.get(`/api/orders/${id}`));

// PATCH /api/orders/:id/status (PHARMACY_ADMIN | SUPER_ADMIN) body: { orderStatus }
export const updateOrderStatus = async (id, orderStatus) =>
  unwrap(await api.patch(`/api/orders/${id}/status`, { orderStatus }));

// PATCH /api/orders/:id/delivery (PHARMACY_ADMIN | SUPER_ADMIN) body: { deliveryStatus: NOT_DISPATCHED|IN_TRANSIT|DELIVERED }
export const updateDeliveryStatus = async (id, deliveryStatus) =>
  unwrap(await api.patch(`/api/orders/${id}/delivery`, { deliveryStatus }));
