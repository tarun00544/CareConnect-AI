import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { localJson } from '../utils/tokenStorage';
import { STORAGE_KEYS } from '../constants';

const CartContext = createContext(null);

// The backend has no cart API — the cart is a client-side list of { medicine, quantity } snapshots.
// Authoritative prices/stock/prescription rules are re-checked by POST /api/orders at checkout.
export function CartProvider({ children }) {
  const [lines, setLines] = useState(() => localJson.get(STORAGE_KEYS.CART, []));

  useEffect(() => {
    localJson.set(STORAGE_KEYS.CART, lines);
  }, [lines]);

  const add = useCallback((medicine, qty = 1) => {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.medicine._id === medicine._id);
      const max = medicine.stock ?? Infinity;
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], medicine, quantity: Math.min(next[i].quantity + qty, max) };
        return next;
      }
      return [...prev, { medicine, quantity: Math.min(qty, max) }];
    });
  }, []);

  const setQty = useCallback((id, quantity) => {
    setLines((prev) =>
      prev
        .map((l) => (l.medicine._id === id ? { ...l, quantity: Math.max(1, Math.min(quantity, l.medicine.stock ?? Infinity)) } : l))
        .filter((l) => l.quantity > 0)
    );
  }, []);

  const remove = useCallback((id) => setLines((prev) => prev.filter((l) => l.medicine._id !== id)), []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + l.medicine.price * l.quantity, 0);
    return {
      lines,
      count: lines.reduce((s, l) => s + l.quantity, 0),
      subtotal,
      // Display estimate only — mirrors orderService (free above ₹500, else ₹40); the server total is authoritative.
      estimatedDeliveryFee: lines.length === 0 ? 0 : subtotal > 500 ? 0 : 40,
      add,
      setQty,
      remove,
      clear,
    };
  }, [lines, add, setQty, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
