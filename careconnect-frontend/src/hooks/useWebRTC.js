import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '../services/socket';

const DEFAULT_ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: ['stun:global.stun.twilio.com:3478'] },
];

export function useWebRTC({ appointmentId, iceServers = null, autoStart = false, onCallEnded = null } = {}) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [mediaError, setMediaError] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [connectionState, setConnectionState] = useState('idle'); // idle | calling | waiting | connecting | connected | reconnecting | failed | ended | rejected
  const [callStatusMessage, setCallStatusMessage] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [remoteParticipant, setRemoteParticipant] = useState(null);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const timerRef = useRef(null);
  const iceCandidateQueueRef = useRef([]);
  const hasRemoteDescriptionRef = useRef(false);

  // Timer logic - only increments while state is 'connected'
  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    const t0 = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - t0) / 1000));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 1. Local Media Capture
  const startLocalMedia = useCallback(async () => {
    setMediaError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      const err = 'Your browser does not support camera/microphone access (or the site is not running over HTTPS/localhost).';
      setMediaError(err);
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setMicOn(true);
      setCamOn(true);
      return stream;
    } catch (err) {
      const denied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError';
      const msg = denied
        ? 'Camera/microphone permission was denied. Please allow access in your browser settings to join the consultation.'
        : err?.name === 'NotFoundError'
        ? 'No camera or microphone was detected on this device.'
        : 'Could not access your camera or microphone. Please check your system settings.';
      setMediaError(msg);
      setConnectionState('failed');
      return null;
    }
  }, []);

  const stopLocalMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
  }, []);

  const toggleMic = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  }, []);

  const toggleCamera = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
    }
  }, []);

  // 2. WebRTC Peer Connection Factory
  const createPeerConnection = useCallback((socket, apptId, rtcIceServers) => {
    if (pcRef.current) {
      try { pcRef.current.close(); } catch { /* ignore */ }
    }

    const config = {
      iceServers: rtcIceServers && rtcIceServers.length > 0 ? rtcIceServers : DEFAULT_ICE_SERVERS,
    };

    const pc = new RTCPeerConnection(config);
    pcRef.current = pc;
    hasRemoteDescriptionRef.current = false;
    iceCandidateQueueRef.current = [];

    // Add local media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle incoming remote media
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    // Forward local ICE candidate to remote peer via socket
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('video:ice-candidate', {
          appointmentId: apptId,
          candidate: event.candidate,
        });
      }
    };

    // Connection state observer
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        setConnectionState('connected');
        setCallStatusMessage('Connected');
        startTimer();
      } else if (state === 'connecting') {
        setConnectionState('connecting');
        setCallStatusMessage('Establishing encrypted peer connection…');
      } else if (state === 'disconnected') {
        setConnectionState('reconnecting');
        setCallStatusMessage('Network connection interrupted. Reconnecting…');
      } else if (state === 'failed') {
        setConnectionState('failed');
        setCallStatusMessage('Direct media connection failed. Please check network/firewall.');
        stopTimer();
      } else if (state === 'closed') {
        setConnectionState('ended');
        stopTimer();
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        try { pc.restartIce(); } catch { /* ignore */ }
      }
    };

    return pc;
  }, [startTimer, stopTimer]);

  // 3. Initiate Video Call / Join Room
  const startCall = useCallback(async () => {
    if (!appointmentId) return;

    let stream = localStreamRef.current;
    if (!stream) {
      stream = await startLocalMedia();
      if (!stream) return;
    }

    const socket = getSocket();
    if (!socket || !socket.connected) {
      setConnectionState('failed');
      setCallStatusMessage('Signaling server is disconnected. Retrying socket connection…');
      return;
    }

    setConnectionState('calling');
    setCallStatusMessage('Connecting to consultation room…');

    socket.emit('video:join', { appointmentId }, (response) => {
      if (response?.error) {
        setConnectionState('failed');
        setCallStatusMessage(response.error);
      }
    });
  }, [appointmentId, startLocalMedia]);

  // 4. Hang up / End Consultation
  const hangUp = useCallback(() => {
    stopTimer();
    const socket = getSocket();
    if (socket && appointmentId) {
      socket.emit('video:ended', { appointmentId });
      socket.emit('video:leave', { appointmentId });
    }

    if (pcRef.current) {
      try { pcRef.current.close(); } catch { /* ignore */ }
      pcRef.current = null;
    }

    stopLocalMedia();
    setRemoteStream(null);
    setConnectionState('ended');
    setCallStatusMessage('Consultation call ended');
    onCallEnded?.();
  }, [appointmentId, stopLocalMedia, stopTimer, onCallEnded]);

  // 5. Secure Socket.IO Signaling Listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !appointmentId) return undefined;

    // A. Waiting in room
    const onWaiting = ({ message, partnerName }) => {
      setConnectionState('waiting');
      setCallStatusMessage(message || `Waiting for ${partnerName || 'doctor'} to join…`);
    };

    // B. Participant joined
    const onParticipantJoined = (participant) => {
      setRemoteParticipant(participant);
      setCallStatusMessage(`${participant.name || 'Participant'} joined the room`);
    };

    // C. Both participants ready -> initiate WebRTC negotiation
    const onReady = async ({ callerSocketId }) => {
      setConnectionState('connecting');
      setCallStatusMessage('Both participants present. Negotiating WebRTC peer connection…');

      const isCaller = socket.id === callerSocketId;
      const pc = createPeerConnection(socket, appointmentId, iceServers);

      if (isCaller) {
        try {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await pc.setLocalDescription(offer);
          socket.emit('video:offer', { appointmentId, offer });
        } catch (err) {
          setConnectionState('failed');
          setCallStatusMessage('Failed to create WebRTC offer: ' + err.message);
        }
      }
    };

    // D. Incoming offer -> respond with answer
    const onOffer = async ({ offer }) => {
      setConnectionState('connecting');
      setCallStatusMessage('Received connection offer. Creating answer…');

      const pc = pcRef.current || createPeerConnection(socket, appointmentId, iceServers);

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        hasRemoteDescriptionRef.current = true;

        // Flush any ICE candidates queued before remote description was ready
        while (iceCandidateQueueRef.current.length > 0) {
          const cand = iceCandidateQueueRef.current.shift();
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('video:answer', { appointmentId, answer });
      } catch (err) {
        setConnectionState('failed');
        setCallStatusMessage('Failed to handle connection offer: ' + err.message);
      }
    };

    // E. Incoming answer -> set remote description
    const onAnswer = async ({ answer }) => {
      const pc = pcRef.current;
      if (!pc) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        hasRemoteDescriptionRef.current = true;

        // Flush any queued candidates
        while (iceCandidateQueueRef.current.length > 0) {
          const cand = iceCandidateQueueRef.current.shift();
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        }
      } catch (err) {
        setConnectionState('failed');
        setCallStatusMessage('Failed to set remote answer: ' + err.message);
      }
    };

    // F. Incoming ICE Candidate
    const onIceCandidate = async ({ candidate }) => {
      const pc = pcRef.current;
      if (!pc || !candidate) return;

      try {
        if (hasRemoteDescriptionRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          iceCandidateQueueRef.current.push(candidate);
        }
      } catch (err) {
        console.warn('Error adding ICE candidate:', err);
      }
    };

    // G. Call rejected
    const onCallRejected = ({ reason }) => {
      stopTimer();
      setConnectionState('rejected');
      setCallStatusMessage(reason || 'Doctor is currently unavailable. Please try again or reschedule.');
    };

    // H. Participant left
    const onParticipantLeft = ({ role }) => {
      setRemoteStream(null);
      setConnectionState('waiting');
      setCallStatusMessage(`${role === 'DOCTOR' ? 'Doctor' : 'Patient'} has left the room. Waiting for reconnection…`);
    };

    // I. Call ended
    const onEnded = () => {
      stopTimer();
      if (pcRef.current) {
        try { pcRef.current.close(); } catch { /* ignore */ }
        pcRef.current = null;
      }
      setRemoteStream(null);
      setConnectionState('ended');
      setCallStatusMessage('Consultation ended by participant');
      onCallEnded?.();
    };

    socket.on('video:waiting', onWaiting);
    socket.on('video:participant-joined', onParticipantJoined);
    socket.on('video:ready', onReady);
    socket.on('video:offer', onOffer);
    socket.on('video:answer', onAnswer);
    socket.on('video:ice-candidate', onIceCandidate);
    socket.on('video:call-rejected', onCallRejected);
    socket.on('video:participant-left', onParticipantLeft);
    socket.on('video:ended', onEnded);

    return () => {
      socket.off('video:waiting', onWaiting);
      socket.off('video:participant-joined', onParticipantJoined);
      socket.off('video:ready', onReady);
      socket.off('video:offer', onOffer);
      socket.off('video:answer', onAnswer);
      socket.off('video:ice-candidate', onIceCandidate);
      socket.off('video:call-rejected', onCallRejected);
      socket.off('video:participant-left', onParticipantLeft);
      socket.off('video:ended', onEnded);
    };
  }, [appointmentId, iceServers, createPeerConnection, onCallEnded, stopTimer]);

  // Auto-start media if requested
  useEffect(() => {
    if (autoStart) {
      startCall();
    }
    return () => {
      stopTimer();
      stopLocalMedia();
      if (pcRef.current) {
        try { pcRef.current.close(); } catch { /* ignore */ }
        pcRef.current = null;
      }
    };
  }, [autoStart, startCall, stopLocalMedia, stopTimer]);

  return {
    localStream,
    remoteStream,
    mediaError,
    micOn,
    camOn,
    connectionState,
    callStatusMessage,
    elapsed,
    remoteParticipant,
    startCall,
    startLocalMedia,
    stopLocalMedia,
    toggleMic,
    toggleCamera,
    hangUp,
  };
}
