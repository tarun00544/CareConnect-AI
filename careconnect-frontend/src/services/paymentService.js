import api from './api';
import { unwrap, toList } from '../utils/response';
import { RAZORPAY_SCRIPT } from '../utils/env';

// POST /api/payments/create-order body: { type: 'APPOINTMENT'|'ORDER', referenceId }
//   → { payment, razorpayOrder:{ id, amount(paise), currency, ... }, keyId }   (keyId is Razorpay's PUBLIC key id)
// The amount is derived server-side (doctor.consultationFee or order.total) — never sent from the client.
export const createPaymentOrder = async ({ type, referenceId }) => unwrap(await api.post('/api/payments/create-order', { type, referenceId }));

// POST /api/payments/verify body: { razorpay_order_id, razorpay_payment_id, razorpay_signature } → { payment, receipt }
export const verifyPayment = async ({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) =>
  unwrap(await api.post('/api/payments/verify', { razorpay_order_id, razorpay_payment_id, razorpay_signature }));

// GET /api/payments/my → Payment[]  ·  GET /api/payments/:id → Payment
export const getMyPayments = async () => toList(unwrap(await api.get('/api/payments/my')));
export const getPayment = async (id) => unwrap(await api.get(`/api/payments/${id}`));

// ---- Razorpay Checkout (browser SDK) ------------------------------
let scriptPromise = null;
export function loadRazorpay() {
  if (typeof window !== 'undefined' && window.Razorpay) return Promise.resolve(window.Razorpay);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = RAZORPAY_SCRIPT;
      s.async = true;
      s.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error('Razorpay failed to initialise')));
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error('Could not load the Razorpay checkout script. Check your connection or ad-blocker.'));
      };
      document.body.appendChild(s);
    });
  }
  return scriptPromise;
}
