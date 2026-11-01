import { CheckCheck, Trash2, RefreshCw } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { NotificationList } from '../../components/layout/NotificationPanel';
import { useNotifications } from '../../context/NotificationContext';

export default function Notifications() {
  const { unreadCount, markAllRead, clearAll, socketStatus, loading, fetchHistory } = useNotifications();

  return (
    <div className="stack-lg">
      <PageHeader
        title="Notifications"
        subtitle="Real-time and persistent updates across your entire healthcare journey."
        actions={
          <div className="row gap-xs">
            <button
              className="btn btn-ghost"
              onClick={fetchHistory}
              disabled={loading}
              title="Refresh notifications"
            >
              <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
            </button>
            <button
              className="btn btn-secondary"
              onClick={markAllRead}
              disabled={!unreadCount}
            >
              <CheckCheck size={16} /> Mark all read
            </button>
            <button className="btn btn-ghost" onClick={clearAll}>
              <Trash2 size={16} /> Clear all
            </button>
          </div>
        }
      />
      <section className="card">
        <div className="row between mb-md pb-xs border-b">
          <div className="small muted">
            Real-time delivery:{' '}
            <strong className={socketStatus === 'connected' ? 'text-success' : 'text-warning'}>
              {socketStatus === 'connected' ? 'Active (Live)' : socketStatus}
            </strong>
          </div>
          {unreadCount > 0 && (
            <span className="badge badge-primary">{unreadCount} unread</span>
          )}
        </div>
        <NotificationList />
      </section>
    </div>
  );
}
