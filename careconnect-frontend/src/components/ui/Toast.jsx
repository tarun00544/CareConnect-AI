import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

const ICONS = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle };

export function ToastViewport({ toasts, onDismiss }) {
  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => {
        const Icon = ICONS[t.tone] || Info;
        return (
          <div key={t.id} className={`toast toast-${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
            <Icon size={18} aria-hidden="true" className="toast-icon" />
            <div className="toast-body">
              {t.title && <strong>{t.title}</strong>}
              <span>{t.message}</span>
            </div>
            <button type="button" className="icon-btn icon-btn-sm" onClick={() => onDismiss(t.id)} aria-label="Dismiss notification">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
export default ToastViewport;
