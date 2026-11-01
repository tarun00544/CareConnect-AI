import { useEffect, useState } from 'react';
import { LocateFixed, RefreshCw, Siren } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Field from '../../components/ui/Field';
import StatusBadge from '../../components/ui/StatusBadge';
import FormError from '../../components/common/FormError';
import { EmergencyBanner } from '../../components/medical/DisclaimerBanner';
import { useAsync } from '../../hooks/useAsync';
import { useConfirm, useToast } from '../../context/AppContext';
import { createEmergency, getEmergency } from '../../services/emergencyService';
import { EMERGENCY_STATUS, STORAGE_KEYS } from '../../constants';
import { localJson } from '../../utils/tokenStorage';
import { formatDateTime } from '../../utils/format';
import { useNotifications } from '../../context/NotificationContext';

const TYPES = ['Chest pain', 'Difficulty breathing', 'Severe bleeding', 'Stroke symptoms', 'Accident / injury', 'Unconsciousness', 'Other'];
const STEPS = ['REQUESTED', 'DISPATCHED', 'DEPARTMENT_ASSIGNED', 'DOCTOR_ASSIGNED', 'BED_ASSIGNED', 'RESOLVED'];

// Backend: POST /api/emergency { emergencyType, location:{lat,lng,address} }. Prototype coordination only —
// the backend states it is NOT integrated with real emergency dispatch.
export default function Emergency() {
  const confirm = useConfirm();
  const toast = useToast();
  const { notifications } = useNotifications();
  const [type, setType] = useState(TYPES[0]);
  const [other, setOther] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState(null);
  const [locBusy, setLocBusy] = useState(false);
  const [locError, setLocError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [lastId, setLastId] = useState(() => localJson.getRaw(STORAGE_KEYS.LAST_EMERGENCY));

  const current = useAsync(() => (lastId ? getEmergency(lastId) : Promise.resolve(null)), [lastId]);
  // Refresh when a live EMERGENCY_UPDATE notification arrives.
  const latestUpdate = notifications.find((n) => n.type === 'EMERGENCY_UPDATE')?.id;
  useEffect(() => { if (latestUpdate && lastId) current.reload(); }, [latestUpdate]); // eslint-disable-line react-hooks/exhaustive-deps

  const locate = () => {
    if (!navigator.geolocation) { setLocError('Location is not supported by this browser.'); return; }
    setLocBusy(true); setLocError('');
    navigator.geolocation.getCurrentPosition(
      (p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocBusy(false); },
      () => { setLocError('Could not get your location. You can type your address instead.'); setLocBusy(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    const emergencyType = type === 'Other' ? other.trim() : type;
    if (!emergencyType) return;
    const ok = await confirm({ title: 'Send emergency request?', message: 'This alerts a hospital coordinator. It does NOT call an ambulance or emergency services — if this is life-threatening, contact local emergency services now.', confirmLabel: 'Send request', tone: 'danger' });
    if (!ok) return;
    setBusy(true); setError(null);
    try {
      const location = coords || address.trim() ? { ...(coords || {}), ...(address.trim() ? { address: address.trim() } : {}) } : undefined;
      const c = await createEmergency({ emergencyType, location });
      localJson.setRaw(STORAGE_KEYS.LAST_EMERGENCY, c._id);
      setLastId(c._id);
      toast.warning('Emergency request sent to the hospital coordinator.', { duration: 8000 });
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  const c = current.data;
  const idx = c ? STEPS.indexOf(c.status) : -1;
  return (
    <div className="stack-lg">
      <PageHeader title="Emergency Assistance" />
      <div className="emergency-hero" role="alert">
        <Siren size={28} aria-hidden="true" />
        <div><strong>Emergency Assistance</strong><p>If this is a life-threatening emergency, seek immediate in-person medical care or contact local emergency services.</p></div>
      </div>
      <div className="grid grid-2 align-start">
        <form className="card stack emergency-form" onSubmit={submit}>
          <h3>Alert a hospital coordinator</h3>
          <Field label="What is the emergency?" htmlFor="etype" required>
            <select id="etype" className="select" value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
          </Field>
          {type === 'Other' && <Field label="Describe briefly" htmlFor="eother" required><input id="eother" className="input" value={other} onChange={(e) => setOther(e.target.value)} maxLength={120} /></Field>}
          <Field label="Where are you? (optional)" htmlFor="eaddr">
            <input id="eaddr" className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address or landmark" />
          </Field>
          <div className="row gap-sm wrap">
            <button type="button" className="btn btn-secondary btn-sm" onClick={locate} disabled={locBusy}><LocateFixed size={15} /> {locBusy ? 'Locating…' : coords ? 'Location captured' : 'Use my location'}</button>
            {coords && <span className="muted small">{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</span>}
          </div>
          {locError && <div className="field-error">{locError}</div>}
          <FormError error={error} />
          <button type="submit" className="btn btn-danger btn-lg" disabled={busy || (type === 'Other' && !other.trim())}><Siren size={18} /> {busy ? 'Sending…' : 'Send emergency request'}</button>
          <p className="muted small">This prototype notifies a hospital coordinator only. It is not connected to ambulance or emergency dispatch services.</p>
        </form>

        <section className="card stack">
          <div className="row between"><h3>Latest request</h3>{lastId && <button className="icon-btn" onClick={current.reload} aria-label="Refresh status"><RefreshCw size={16} /></button>}</div>
          {!lastId ? <p className="muted">You haven't sent an emergency request from this browser.</p> : current.loading && !c ? <p className="muted">Loading…</p> : current.error ? (
            <div className="field-error">{current.error.message}</div>
          ) : c && (
            <>
              <div className="row between wrap gap-sm"><strong>{c.emergencyType}</strong><StatusBadge status={c.status} /></div>
              <div className="muted small">Sent {formatDateTime(c.createdAt)}{c.hospitalId?.name ? ` · ${c.hospitalId.name}` : ''}</div>
              {c.status === EMERGENCY_STATUS.CANCELLED ? <p className="muted">This request was cancelled.</p> : (
                <ol className="track track-v">{STEPS.map((s, i) => <li key={s} className={i < idx ? 'done' : i === idx ? 'current' : ''}><span className="track-dot" /><StatusBadge status={s} size="sm" /></li>)}</ol>
              )}
              {c.doctorId && <p className="small">A doctor has been assigned to your case.</p>}
            </>
          )}
        </section>
      </div>
      <EmergencyBanner showLink={false} message="Do not wait for a response here if you or someone else is in danger." />
    </div>
  );
}
