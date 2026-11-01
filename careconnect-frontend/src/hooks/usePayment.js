import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPaymentOrder, loadRazorpay, verifyPayment } from '../services/paymentService';
import { useAuth } from '../context/AuthContext';

/**
 * Razorpay flow against the backend contract:
 *  1. POST /api/payments/create-order  → { payment, razorpayOrder, keyId }   (amount decided server-side)
 *  2. Open Razorpay Checkout with the PUBLIC keyId + order id
 *  3. On success POST /api/payments/verify with the three razorpay_* values (server checks the HMAC signature)
 *  4. Navigate to /payment/success (or /payment/failed). Success is only shown after the server verifies.
 */
export function usePayment() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const fail = useCallback(
    (message, extra = {}) => navigate('/payment/failed', { state: { message, ...extra }, replace: true }),
    [navigate]
  );

  const pay = useCallback(
    async ({ type, referenceId, description, returnTo }) => {
      setBusy(true);
      setError(null);
      let order;
      try {
        order = await createPaymentOrder({ type, referenceId });
      } catch (e) {
        setError(e);
        setBusy(false);
        return { ok: false, error: e };
      }

      let Razorpay;
      try {
        Razorpay = await loadRazorpay();
      } catch (e) {
        setError(e);
        setBusy(false);
        return { ok: false, error: e };
      }

      const { razorpayOrder, keyId, payment } = order;
      return new Promise((resolve) => {
        const rzp = new Razorpay({
          key: keyId,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency || 'INR',
          order_id: razorpayOrder.id,
          name: 'CareConnect AI',
          description: description || (type === 'APPOINTMENT' ? 'Consultation fee' : 'Medicine order'),
          prefill: { name: user?.name, email: user?.email, contact: user?.phone },
          theme: { color: '#0f766e' },
          modal: {
            ondismiss: () => {
              setBusy(false);
              const e = new Error('Payment was cancelled before completion. You can try again from the payments page.');
              setError(e);
              resolve({ ok: false, cancelled: true, error: e, payment });
            },
          },
          handler: async (response) => {
            try {
              const result = await verifyPayment(response);
              setBusy(false);
              navigate('/payment/success', { state: { ...result, returnTo }, replace: true });
              resolve({ ok: true, ...result });
            } catch (e) {
              setBusy(false);
              fail(e.message || 'We could not verify your payment.', { paymentId: payment?._id, returnTo });
              resolve({ ok: false, error: e });
            }
          },
        });
        rzp.on('payment.failed', (resp) => {
          setBusy(false);
          fail(resp?.error?.description || 'The payment failed.', { paymentId: payment?._id, returnTo });
          resolve({ ok: false });
        });
        rzp.open();
      });
    },
    [user, navigate, fail]
  );

  return { pay, busy, error, clearError: () => setError(null) };
}
