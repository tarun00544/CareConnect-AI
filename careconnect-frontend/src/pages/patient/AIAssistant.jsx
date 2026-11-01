import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Mic, MicOff, Send, Sparkles, User } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Field from '../../components/ui/Field';
import AIResult from '../../components/medical/AIResult';
import { AIDisclaimer } from '../../components/medical/DisclaimerBanner';
import FormError from '../../components/common/FormError';
import { runAssessment } from '../../services/aiService';
import { listDepartments } from '../../services/departmentService';
import { useAsync } from '../../hooks/useAsync';
import { useSpeechInput } from '../../hooks/useSpeechInput';
import { getFieldErrors } from '../../utils/response';

// The backend endpoint is stateless and structured: { symptoms[], duration?, age?, additionalInfo? }.
// The chat UI collects those fields, and every reply is the backend's structured triage result — the UI never
// authors medical statements itself.
const SAMPLE = ['Headache and fever', 'Chest tightness when walking', 'Persistent cough', 'Stomach pain after meals'];
const split = (t) => t.split(/[,;\n]+|\band\b/i).map((s) => s.trim()).filter(Boolean);

export default function AIAssistant() {
  const depts = useAsync(() => listDepartments(), []);
  const [text, setText] = useState('');
  const [duration, setDuration] = useState('');
  const [age, setAge] = useState('');
  const [extra, setExtra] = useState('');
  const [thread, setThread] = useState([]); // {role:'user'|'ai', text?, result?}
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [symptoms, setSymptoms] = useState([]);
  const endRef = useRef(null);
  const speech = useSpeechInput((t) => setText((prev) => (prev ? `${prev}, ${t}` : t)));

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [thread, busy]);
  const fe = getFieldErrors(error);

  const submit = async (e, override) => {
    e?.preventDefault();
    if (busy) return;
    const raw = (override ?? text).trim();
    const list = raw ? [...symptoms, ...split(raw)] : symptoms;
    if (!list.length) return;
    setBusy(true);
    setError(null);
    setThread((t) => [...t, { role: 'user', text: raw || list.join(', ') }]);
    setText('');
    setSymptoms(list);
    try {
      const result = await runAssessment({ symptoms: list, duration: duration.trim(), age, additionalInfo: extra.trim() });
      setThread((t) => [...t, { role: 'ai', result }]);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => { if (busy) return; setThread([]); setSymptoms([]); setError(null); setText(''); };

  return (
    <div className="stack-lg">
      <PageHeader
        title="AI Health Assistant"
        subtitle="Describe how you feel. I'll summarise it and suggest departments that may be appropriate for further evaluation."
        actions={<Link to="/patient/ai/report-analysis" className="btn btn-secondary">Explain a report</Link>}
      />
      <AIDisclaimer />
      <div className="grid ai-layout align-start">
        <section className="card chat ai-chat" aria-label="AI conversation">
          <div className="chat-body">
            {thread.length === 0 && (
              <div className="ai-welcome">
                <span className="round-icon round-icon-lg"><Sparkles size={24} aria-hidden="true" /></span>
                <h3>What symptoms are you experiencing?</h3>
                <p className="muted">Separate several symptoms with commas. Add how long, your age and anything else on the right for a better summary.</p>
                <div className="chips">{SAMPLE.map((s) => <button key={s} type="button" className="chip chip-btn" disabled={busy} onClick={() => submit(null, s)}>{s}</button>)}</div>
              </div>
            )}
            {thread.map((m, i) => (
              <div key={i} className={`bubble-row ${m.role === 'user' ? 'mine' : 'theirs'}`}>
                <span className={`avatar avatar-sm ${m.role === 'ai' ? 'avatar-ai' : ''}`}>{m.role === 'ai' ? <Bot size={15} /> : <User size={15} />}</span>
                <div className={`bubble ${m.role === 'user' ? 'bubble-mine' : 'bubble-theirs bubble-wide'}`}>
                  {m.role === 'user' ? <p>{m.text}</p> : (
                    <AIResult result={m.result} departments={depts.data || []} onPickQuestion={(q) => setExtra((x) => (x ? `${x}\n${q}: ` : `${q}: `))} />
                  )}
                </div>
              </div>
            ))}
            {busy && <div className="typing" aria-live="polite"><span /><span /><span /> <em className="muted small">Preparing a summary…</em></div>}
            <div ref={endRef} />
          </div>
          <FormError error={error} />
          <form className="chat-input" onSubmit={submit}>
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={thread.length ? 'Add another symptom…' : 'e.g. fever, sore throat'} aria-label="Describe your symptoms" disabled={busy} />
            {speech.supported && (
              <button type="button" className={`btn btn-secondary ${speech.listening ? 'btn-live' : ''}`} onClick={speech.listening ? speech.stop : speech.start} aria-pressed={speech.listening} aria-label={speech.listening ? 'Stop voice input' : 'Start voice input'}>
                {speech.listening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            )}
            <button type="submit" className="btn btn-primary" disabled={busy || (!text.trim() && !symptoms.length)}><Send size={16} /><span className="hide-sm"> {thread.length ? 'Update' : 'Send'}</span></button>
          </form>
          {speech.error && <div className="field-error chat-error">{speech.error}</div>}
        </section>

        <aside className="card stack">
          <h3>Optional details</h3>
          <Field label="How long?" htmlFor="duration" error={fe.duration}><input id="duration" className="input" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 3 days" /></Field>
          <Field label="Age" htmlFor="age" error={fe.age}><input id="age" type="number" min="0" max="130" className="input" value={age} onChange={(e) => setAge(e.target.value)} /></Field>
          <Field label="Anything else?" htmlFor="extra" error={fe.additionalInfo}><textarea id="extra" className="input" rows={3} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Existing conditions, medicines, allergies…" /></Field>
          {symptoms.length > 0 && (
            <div>
              <div className="muted small">Symptoms in this assessment</div>
              <div className="chips">{symptoms.map((s) => <span key={s} className="chip">{s}</span>)}</div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={reset} style={{ marginTop: 8 }}>Start over</button>
            </div>
          )}
          <p className="muted small">Requests are limited to 10 per minute.</p>
        </aside>
      </div>
    </div>
  );
}
