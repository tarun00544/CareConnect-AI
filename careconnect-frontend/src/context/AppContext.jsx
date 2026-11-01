import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { ToastViewport } from '../components/ui/Toast';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const AppContext = createContext(null);
let toastSeq = 0;

// App-wide UI services: toasts and an imperative confirm dialog.
export function AppProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const confirmResolver = useRef(null);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (tone, message, opts = {}) => {
      toastSeq += 1;
      const id = toastSeq;
      setToasts((t) => [...t.slice(-3), { id, tone, message, title: opts.title }]);
      const ms = opts.duration ?? (tone === 'error' ? 7000 : 4500);
      if (ms > 0) setTimeout(() => dismiss(id), ms);
      return id;
    },
    [dismiss]
  );

  const toast = useMemo(
    () => ({
      success: (m, o) => push('success', m, o),
      error: (m, o) => push('error', m, o),
      info: (m, o) => push('info', m, o),
      warning: (m, o) => push('warning', m, o),
      dismiss,
    }),
    [push, dismiss]
  );

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        confirmResolver.current = resolve;
        setConfirmState({ title: 'Are you sure?', confirmLabel: 'Confirm', tone: 'primary', ...options });
      }),
    []
  );

  const settle = (result) => {
    confirmResolver.current?.(result);
    confirmResolver.current = null;
    setConfirmState(null);
  };

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <AppContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
      <ConfirmDialog
        open={!!confirmState}
        {...(confirmState || {})}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
export const useToast = () => useApp().toast;
export const useConfirm = () => useApp().confirm;
