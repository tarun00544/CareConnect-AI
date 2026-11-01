import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellOff, CheckCheck, Trash2 } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { ROLE_BASE } from '../../constants';
import { relativeTime } from '../../utils/format';

// Deep-link a notification to the relevant screen using the ids the backend puts in `metadata`.
export function notificationLink(n, role) {
  const base = ROLE_BASE[role] || '';
  const m = n.metadata || {};
  if (m.appointmentId) return `${base}/appointments/${m.appointmentId}`;
  if (m.prescriptionId) return `${base}/prescriptions/${m.prescriptionId}`;
  if (m.admissionId) return `${base}/admission/${m.admissionId}`;
  if (m.orderId) return role === 'PHARMACY_ADMIN' ? `${base}/orders` : `${base}/orders/${m.orderId}`;
  if (m.medicineId && role === 'PHARMACY_ADMIN') return `${base}/inventory`;
  if (m.paymentId) return `${base}/payments/${m.paymentId}`;
  if (m.emergencyId) return `${base}/emergency`;
  if (m.conversationId) return `${base}/chat`;
  if (m.bedId) return `${base}/admission`;
  if (m.followUpId) return `${base}/continuity/follow-ups`;
  if (m.referralId) return `${base}/continuity/referrals`;
  if (m.summaryId) return `${base}/continuity/summary`;
  if (m.comparisonId) return `${base}/continuity/reports`;
  return null;
}

export function NotificationList({ limit, onNavigate }) {
  const { notifications, markRead } = useNotifications();
  const { role } = useAuth();
  const list = limit ? notifications.slice(0, limit) : notifications;
  if (list.length === 0) {
    return (
      <div className="np-empty">
        <BellOff size={22} aria-hidden="true" />
        <p className="muted small">No notifications received yet in this session. New updates appear here in real time.</p>
      </div>
    );
  }
  return (
    <ul className="np-list">
      {list.map((n) => {
        const to = notificationLink(n, role);
        const content = (
          <>
            <span className={`np-dot ${n.read ? '' : 'unread'}`} aria-hidden="true" />
            <div>
              <div className="np-title">{n.title}</div>
              <div className="muted small">{n.message}</div>
              <div className="np-time">{relativeTime(n.createdAt || n.receivedAt)}</div>
            </div>
          </>
        );
        return (
          <li key={n.id} className={n.read ? '' : 'unread'}>
            {to ? (
              <Link to={to} className="np-item" onClick={() => { markRead(n.id); onNavigate?.(); }}>{content}</Link>
            ) : (
              <button type="button" className="np-item" onClick={() => markRead(n.id)}>{content}</button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function NotificationPanel({ open, onClose, anchorRef }) {
  const { unreadCount, markAllRead, clearAll, socketStatus } = useNotifications();
  const { role } = useAuth();
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || anchorRef?.current?.contains(e.target)) return;
      onClose();
    };
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;
  const hasPage = Boolean(role && ROLE_BASE[role]);
  return (
    <div className="np" ref={ref} role="dialog" aria-label="Notifications">
      <div className="np-head">
        <strong><Bell size={15} aria-hidden="true" /> Notifications</strong>
        <div className="row gap-xs">
          <button type="button" className="icon-btn icon-btn-sm" onClick={markAllRead} aria-label="Mark all as read" disabled={unreadCount === 0}><CheckCheck size={15} /></button>
          <button type="button" className="icon-btn icon-btn-sm" onClick={clearAll} aria-label="Clear notifications"><Trash2 size={15} /></button>
        </div>
      </div>
      <NotificationList limit={8} onNavigate={onClose} />
      <div className="np-foot">
        <span className={`live-dot live-${socketStatus}`} aria-hidden="true" />
        <span className="muted small">{socketStatus === 'connected' ? 'Live updates on' : socketStatus === 'connecting' ? 'Connecting…' : 'Live updates offline'}</span>
        {hasPage && <Link to={`${ROLE_BASE[role]}/notifications`} className="small" onClick={onClose}>View all</Link>}
      </div>
    </div>
  );
}
