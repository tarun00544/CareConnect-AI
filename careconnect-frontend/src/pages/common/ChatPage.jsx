import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import ChatWindow from '../../components/chat/ChatWindow';
import EmptyState from '../../components/ui/EmptyState';
import DataState from '../../components/common/DataState';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { useAsync } from '../../hooks/useAsync';
import { useChatSocket } from '../../hooks/useChatSocket';
import { useDoctorDirectory } from '../../hooks/useDoctorDirectory';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { listConversations } from '../../services/chatService';
import { getMyPatients } from '../../services/doctorService';
import { doctorDisplayName } from '../../components/doctors/DoctorCard';
import { initials, refId, relativeTime } from '../../utils/format';
import { ROLES } from '../../constants';

/**
 * Shared by /patient/chat and /doctor/chat.
 * Backend note: conversations come back with patientId/doctorId populated as Patient/Doctor documents, which carry
 * no display names. Names are resolved from the public doctor list (patient view) or GET /doctors/me/patients (doctor view).
 */
export default function ChatPage() {
  const { user, role } = useAuth();
  const isDoctor = role === ROLES.DOCTOR;
  const base = isDoctor ? '/doctor' : '/patient';
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('c');
  const { unreadMessages, clearConversationUnread } = useNotifications();

  const convs = useAsync(() => listConversations(), []);
  const patients = useAsync(() => (isDoctor ? getMyPatients() : Promise.resolve([])), [isDoctor]);
  const dir = useDoctorDirectory();

  const patientMap = useMemo(() => Object.fromEntries((patients.data || []).map((p) => [p._id, p])), [patients.data]);

  const describe = (c) => {
    if (isDoctor) {
      const pid = refId(c.patientId);
      const p = patientMap[pid];
      const pObj = typeof c.patientId === 'object' ? c.patientId : null;
      return { name: p?.userId?.name || 'Patient', otherUserId: refId(p?.userId || pObj?.userId) };
    }
    const d = dir.getDoctor(c.doctorId);
    const dObj = typeof c.doctorId === 'object' ? c.doctorId : null;
    return { name: d ? doctorDisplayName(d) : 'Doctor', otherUserId: refId(d?.userId || dObj?.userId) };
  };

  const selected = (convs.data || []).find((c) => c._id === selectedId);
  const info = selected ? describe(selected) : null;
  const chat = useChatSocket({ conversationId: selected?._id, myUserId: user?.id, otherUserId: info?.otherUserId });

  const select = (id) => { setParams({ c: id }); clearConversationUnread(id); };

  return (
    <div className="stack-lg">
      <PageHeader title="Chat" subtitle="Messages with your care team, tied to your appointments." />
      <DataState loading={convs.loading} error={convs.error} data={convs.data} onRetry={convs.reload} skeleton={<SkeletonRows />}
        empty={<EmptyState icon={MessageSquare} title="No conversations yet" message="A conversation starts from an appointment. Open one and choose “Chat”." action={<Link to={`${base}/appointments`} className="btn btn-primary">Go to appointments</Link>} />}>
        <div className={`chat-layout ${selected ? 'has-selection' : ''}`}>
          <aside className="conv-list card" aria-label="Conversations">
            {(convs.data || []).map((c) => {
              const d = describe(c);
              const n = unreadMessages[c._id] || 0;
              return (
                <button key={c._id} type="button" className={`conv ${c._id === selectedId ? 'active' : ''}`} onClick={() => select(c._id)}>
                  <span className="avatar">{initials(d.name)}</span>
                  <span className="conv-meta">
                    <strong>{d.name}</strong>
                    <span className="muted small">{c.status === 'CLOSED' ? 'Closed · ' : ''}Updated {relativeTime(c.updatedAt)}</span>
                  </span>
                  {n > 0 && <span className="nav-badge">{n}</span>}
                </button>
              );
            })}
          </aside>
          <div className="chat-pane">
            {selected ? (
              <ChatWindow header={{ name: info.name, subtitle: `Appointment ${refId(selected.appointmentId) ? '' : ''}conversation` }} chat={chat} myUserId={user?.id} onBack={() => setParams({})} />
            ) : (
              <div className="card"><EmptyState icon={MessageSquare} title="Select a conversation" message="Choose a conversation on the left to read and send messages." /></div>
            )}
          </div>
        </div>
      </DataState>
    </div>
  );
}
