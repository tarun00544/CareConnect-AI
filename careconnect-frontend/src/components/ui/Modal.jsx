import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, footer, size = 'md', dismissible = true }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    const onKey = (e) => {
      if (e.key === 'Escape' && dismissible) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose, dismissible]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && dismissible && onClose?.()}>
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="modal-head">
          <h3>{title}</h3>
          {dismissible && (
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">
              <X size={18} />
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
