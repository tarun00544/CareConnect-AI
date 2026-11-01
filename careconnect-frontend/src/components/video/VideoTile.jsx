import { useEffect, useRef } from 'react';
import { VideoOff, MicOff, UserRound } from 'lucide-react';

/** Binds a MediaStream to a <video>. Shows a clear placeholder when there is no stream. */
export default function VideoTile({ stream, label, muted = false, mirror = false, camOn = true, micOn = true, placeholder }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream || null;
  }, [stream]);
  const showVideo = !!stream && camOn;
  return (
    <div className="video-tile">
      <video ref={ref} autoPlay playsInline muted={muted} className={mirror ? 'mirror' : ''} style={{ display: showVideo ? 'block' : 'none' }} />
      {!showVideo && (
        <div className="video-placeholder">
          {stream && !camOn ? <VideoOff size={30} aria-hidden="true" /> : <UserRound size={34} aria-hidden="true" />}
          <span>{stream && !camOn ? 'Camera off' : placeholder || 'No video'}</span>
        </div>
      )}
      <div className="video-label">
        {label}
        {stream && !micOn && <MicOff size={13} aria-label="Muted" />}
      </div>
    </div>
  );
}
