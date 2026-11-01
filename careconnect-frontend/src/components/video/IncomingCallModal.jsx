import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Phone, PhoneOff, User, Calendar, Clock } from 'lucide-react';
import Modal from '../ui/Modal';
import { getSocket } from '../../services/socket';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/AppContext';
import { createVideoSession } from '../../services/videoService';
import { ROLES } from '../../constants';

export default function IncomingCallModal() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [incomingCall, setIncomingCall] = useState(null);
  const [answering, setAnswering] = useState(false);

  useEffect(() => {
    // Only doctors (and admins) receive incoming consultation call prompts
    if (role !== ROLES.DOCTOR && role !== ROLES.SUPER_ADMIN) return undefined;

    const socket = getSocket();
    if (!socket) return undefined;

    const onIncomingCall = (callData) => {
      // Prevent duplicate dialogs for the same appointment call
      setIncomingCall((prev) => {
        if (prev?.appointmentId === callData.appointmentId) return prev;
        return callData;
      });
    };

    const onCallEnded = ({ appointmentId }) => {
      setIncomingCall((prev) => (prev?.appointmentId === appointmentId ? null : prev));
    };

    socket.on('video:incoming-call', onIncomingCall);
    socket.on('video:ended', onCallEnded);
    socket.on('video:call-rejected', onCallEnded);

    return () => {
      socket.off('video:incoming-call', onIncomingCall);
      socket.off('video:ended', onCallEnded);
      socket.off('video:call-rejected', onCallEnded);
    };
  }, [role]);

  const handleAccept = async () => {
    if (!incomingCall) return;
    setAnswering(true);
    try {
      const session = await createVideoSession(incomingCall.appointmentId);
      const targetApptId = incomingCall.appointmentId;
      setIncomingCall(null);
      navigate(`/doctor/video/${session.id}`, { state: { appointmentId: targetApptId } });
    } catch (err) {
      toast.error(err.message || 'Failed to connect to video consultation');
    } finally {
      setAnswering(false);
    }
  };

  const handleReject = () => {
    if (!incomingCall) return;
    const socket = getSocket();
    if (socket) {
      socket.emit('video:reject', {
        appointmentId: incomingCall.appointmentId,
        reason: 'Doctor is currently unavailable or attending to another patient',
      });
    }
    setIncomingCall(null);
  };

  if (!incomingCall) return null;

  return (
    <Modal
      open={!!incomingCall}
      onClose={handleReject}
      title="Incoming Video Consultation"
      size="md"
      footer={
        <div className="row gap-sm justify-end w-full">
          <button
            type="button"
            className="btn btn-danger-outline row center gap-xs"
            onClick={handleReject}
            disabled={answering}
          >
            <PhoneOff size={16} /> Decline
          </button>
          <button
            type="button"
            className="btn btn-primary row center gap-xs"
            onClick={handleAccept}
            disabled={answering}
          >
            <Video size={16} /> {answering ? 'Connecting…' : 'Accept & Join'}
          </button>
        </div>
      }
    >
      <div className="stack text-center items-center py-md">
        <div
          className="pulse-badge rounded-full p-md inline-flex items-center justify-center mb-sm"
          style={{
            background: 'var(--teal-50, #f0fdf4)',
            color: 'var(--teal-600, #0d9488)',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            margin: '0 auto',
          }}
        >
          <Video size={32} className="animate-pulse" />
        </div>

        <h3 style={{ margin: '0 0 4px 0', fontSize: '1.25rem' }}>
          {incomingCall.patientName || 'Patient'} is calling
        </h3>
        <p className="small muted" style={{ margin: 0 }}>
          Video consultation session initiated
        </p>

        <div className="card-soft p-sm rounded mt-md w-full text-left stack-xs">
          <div className="row gap-xs center small">
            <User size={14} className="muted" />
            <span><strong>Patient:</strong> {incomingCall.patientName}</span>
          </div>
          {incomingCall.date && (
            <div className="row gap-xs center small">
              <Calendar size={14} className="muted" />
              <span><strong>Appointment Date:</strong> {new Date(incomingCall.date).toLocaleDateString()}</span>
            </div>
          )}
          {incomingCall.startTime && (
            <div className="row gap-xs center small">
              <Clock size={14} className="muted" />
              <span><strong>Scheduled Time:</strong> {incomingCall.startTime}</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
