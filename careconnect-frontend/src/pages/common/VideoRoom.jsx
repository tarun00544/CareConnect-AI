import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Info, AlertCircle, PhoneOff, ArrowLeft } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import VideoTile from '../../components/video/VideoTile';
import CallControls from '../../components/video/CallControls';
import ChatWindow from '../../components/chat/ChatWindow';
import DataState from '../../components/common/DataState';
import { useAsync } from '../../hooks/useAsync';
import { useWebRTC } from '../../hooks/useWebRTC';
import { useChatSocket } from '../../hooks/useChatSocket';
import { useAuth } from '../../context/AuthContext';
import { getVideoSession, endVideoSession } from '../../services/videoService';
import { createConversation } from '../../services/chatService';
import { ROLES } from '../../constants';

const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

const STATE_LABEL = {
  idle: 'Ready to connect',
  calling: 'Calling…',
  waiting: 'Waiting in room',
  connecting: 'Connecting…',
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
  failed: 'Connection failed',
  rejected: 'Call declined',
  ended: 'Consultation ended',
};

/**
 * CareConnect AI Real-Time WebRTC Video Consultation Room
 * Two-way audio/video stream exchange with STUN/TURN ICE negotiation,
 * Socket.IO signaling, and synchronized appointment-scoped chat.
 */
export default function VideoRoom() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const isDoctor = role === ROLES.DOCTOR;
  const base = isDoctor ? '/doctor' : '/patient';

  const session = useAsync(() => getVideoSession(id), [id]);

  const appointmentObj = session.data?.appointmentId;
  const resolvedAppointmentId =
    state?.appointmentId ||
    (typeof appointmentObj === 'object' ? appointmentObj?._id : appointmentObj);

  const rtc = useWebRTC({
    appointmentId: resolvedAppointmentId,
    iceServers: session.data?.iceServers,
    autoStart: true,
  });

  const [conversationId, setConversationId] = useState(null);
  useEffect(() => {
    if (!resolvedAppointmentId) return;
    createConversation(resolvedAppointmentId)
      .then((c) => setConversationId(c._id))
      .catch(() => {});
  }, [resolvedAppointmentId]);

  const chat = useChatSocket({ conversationId, myUserId: user?.id });

  const end = async () => {
    rtc.hangUp();
    if (resolvedAppointmentId) {
      try {
        await endVideoSession(resolvedAppointmentId);
      } catch {
        /* ignore */
      }
    }
    navigate(`${base}/video`);
  };

  // Participant naming
  const doctorName =
    appointmentObj?.doctorId?.userId?.name ||
    appointmentObj?.doctorId?.name ||
    'Doctor';
  const patientName = appointmentObj?.patientId?.name || 'Patient';
  const partnerName = isDoctor ? patientName : `Dr. ${doctorName.replace(/^Dr\.?\s*/i, '')}`;

  const getPlaceholderText = () => {
    switch (rtc.connectionState) {
      case 'calling':
        return `Calling ${partnerName}…`;
      case 'waiting':
        return `Waiting for ${partnerName} to join the consultation…`;
      case 'connecting':
        return 'Negotiating encrypted peer connection…';
      case 'connected':
        return null;
      case 'rejected':
        return `${partnerName} declined the consultation.`;
      case 'ended':
        return 'Consultation ended.';
      case 'failed':
        return 'Direct media connection failed.';
      default:
        return `Waiting for ${partnerName}…`;
    }
  };

  return (
    <div className="stack-lg">
      <PageHeader
        title="Video Consultation"
        subtitle={
          session.data
            ? `Appointment Room · ${session.data.roomName || id}`
            : undefined
        }
        actions={
          <div className="row gap-sm items-center">
            {session.data && <StatusBadge status={session.data.status} />}
            <Link to={`${base}/video`} className="btn btn-secondary btn-sm">
              <ArrowLeft size={15} /> All Consultations
            </Link>
          </div>
        }
      />

      <DataState
        loading={session.loading}
        error={session.error}
        data={session.data}
        onRetry={session.reload}
      >
        <div className="video-layout">
          <section className="video-stage">
            <div className="video-status row between">
              <div className="row gap-xs items-center">
                <span className={`chip chip-state status-${rtc.connectionState}`}>
                  {STATE_LABEL[rtc.connectionState] || rtc.connectionState}
                </span>
                {rtc.callStatusMessage && (
                  <span className="small opacity-80" style={{ color: '#fff' }}>
                    {rtc.callStatusMessage}
                  </span>
                )}
              </div>
              <span className="mono bold" aria-label="Call timer" style={{ color: '#fff' }}>
                {rtc.connectionState === 'connected' ? mmss(rtc.elapsed) : '00:00'}
              </span>
            </div>

            <div className="video-grid">
              <VideoTile
                stream={rtc.remoteStream}
                label={partnerName}
                placeholder={getPlaceholderText()}
              />
              <VideoTile
                stream={rtc.localStream}
                label="You"
                muted
                mirror
                camOn={rtc.camOn}
                micOn={rtc.micOn}
                placeholder={rtc.mediaError ? 'Camera unavailable' : 'Local Camera Preview'}
              />
            </div>

            {rtc.mediaError && (
              <div className="form-error" role="alert" style={{ margin: '8px 12px' }}>
                <div className="row gap-xs items-center">
                  <AlertCircle size={16} />
                  <span>{rtc.mediaError}</span>
                </div>
              </div>
            )}

            {rtc.connectionState === 'rejected' && (
              <div className="card-flat" style={{ margin: '12px', padding: '14px', background: 'rgba(239, 68, 68, 0.15)', color: '#fee2e2', borderRadius: '8px' }}>
                <div className="row gap-xs items-center">
                  <PhoneOff size={18} />
                  <strong>Consultation Declined</strong>
                </div>
                <p className="small" style={{ marginTop: '4px' }}>
                  {rtc.callStatusMessage || 'The doctor is currently occupied or unavailable. Please reschedule or leave a chat message.'}
                </p>
              </div>
            )}

            {rtc.connectionState === 'ended' && (
              <div className="card-flat" style={{ margin: '12px', padding: '14px', background: 'rgba(59, 130, 246, 0.15)', color: '#dbeafe', borderRadius: '8px' }}>
                <p className="small">
                  This consultation has concluded. The session and call duration have been recorded in your medical record.
                </p>
              </div>
            )}

            <CallControls
              started={!!rtc.localStream}
              micOn={rtc.micOn}
              camOn={rtc.camOn}
              onStart={rtc.startCall}
              onToggleMic={rtc.toggleMic}
              onToggleCam={rtc.toggleCamera}
              onEnd={end}
            />
          </section>

          <section className="video-chat">
            {conversationId ? (
              <ChatWindow
                header={{
                  name: `Consultation with ${partnerName}`,
                  subtitle: 'In-call encrypted messages are preserved for this appointment',
                }}
                chat={chat}
                myUserId={user?.id}
                compact
              />
            ) : (
              <div className="card stack-sm">
                <div className="row gap-xs">
                  <Info size={16} />
                  <strong>Consultation chat</strong>
                </div>
                <p className="muted small">
                  In-call chat is initializing for appointment{' '}
                  <code>{resolvedAppointmentId || id}</code>.
                </p>
              </div>
            )}
          </section>
        </div>
      </DataState>
    </div>
  );
}
