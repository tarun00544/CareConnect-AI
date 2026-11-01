import { Mic, MicOff, PhoneOff, Video, VideoOff, Camera } from 'lucide-react';

export default function CallControls({ started, micOn, camOn, onStart, onToggleMic, onToggleCam, onEnd }) {
  return (
    <div className="call-controls" role="toolbar" aria-label="Call controls">
      {!started ? (
        <button type="button" className="btn btn-primary" onClick={onStart}><Camera size={17} /> Start camera &amp; microphone</button>
      ) : (
        <>
          <button type="button" className={`ctrl ${micOn ? '' : 'off'}`} onClick={onToggleMic} aria-pressed={!micOn} aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}>
            {micOn ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          <button type="button" className={`ctrl ${camOn ? '' : 'off'}`} onClick={onToggleCam} aria-pressed={!camOn} aria-label={camOn ? 'Turn camera off' : 'Turn camera on'}>
            {camOn ? <Video size={20} /> : <VideoOff size={20} />}
          </button>
          <button type="button" className="ctrl ctrl-end" onClick={onEnd} aria-label="End call"><PhoneOff size={20} /></button>
        </>
      )}
    </div>
  );
}
