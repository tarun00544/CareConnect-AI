import { useState, useEffect } from 'react';
import {
  Bot, Sparkles, FileText, CheckCircle2, AlertTriangle, Copy,
  Send, Stethoscope, Share2, CalendarCheck, HelpCircle, Edit3
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { AIDisclaimer } from '../../components/medical/DisclaimerBanner';
import { getMyPatients } from '../../services/doctorService';
import { runCopilotTask } from '../../services/continuityService';
import { useToast } from '../../context/AppContext';

const COPILOT_MODES = [
  { id: 'CONSULTATION_DRAFT', label: 'Consultation Draft (SOAP)', icon: Stethoscope },
  { id: 'PREVIOUS_CONSULTATION_SUMMARY', label: 'Summarize Consultations', icon: FileText },
  { id: 'FOLLOW_UP_DRAFT', label: 'Prepare Follow-up Plan', icon: CalendarCheck },
  { id: 'REFERRAL_SUMMARY', label: 'Generate Referral Letter', icon: Share2 },
  { id: 'PATIENT_EXPLANATION', label: 'Patient-Friendly Explanation', icon: HelpCircle },
  { id: 'MISSING_INFO_CHECK', label: 'Audit Missing Clinical Info', icon: AlertTriangle },
];

export default function DoctorAICopilotPage() {
  const toast = useToast();
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [activeMode, setActiveMode] = useState('CONSULTATION_DRAFT');
  const [loadingPatients, setLoadingPatients] = useState(true);

  // Input fields for the Copilot
  const [symptoms, setSymptoms] = useState('');
  const [findings, setFindings] = useState('');
  const [notes, setNotes] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [vitals, setVitals] = useState('');

  // Execution state
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [editableContent, setEditableContent] = useState('');
  const [isApproved, setIsApproved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoadingPatients(true);
        const list = await getMyPatients();
        setPatients(list || []);
        if (list?.length > 0) {
          setSelectedPatientId(list[0]._id);
        }
      } catch (err) {
        toast.error('Failed to load patient records');
      } finally {
        setLoadingPatients(false);
      }
    }
    load();
  }, []);

  const handleRunCopilot = async (e) => {
    e.preventDefault();
    setRunning(true);
    setError(null);
    setResult(null);
    setIsApproved(false);

    try {
      const res = await runCopilotTask({
        taskType: activeMode,
        contextData: {
          patientId: selectedPatientId,
          symptoms,
          examination: findings,
          notes,
          specialty,
          vitals,
          condition: symptoms || notes,
          reason: notes || symptoms,
          clinicalText: notes || findings,
        },
      });
      setResult(res);
      setEditableContent(res.content || '');
      toast.success('Clinical Copilot draft generated. Review and edit below.');
    } catch (err) {
      setError(err?.response?.data?.message || 'External AI provider unavailable. User inputs are preserved.');
      toast.error('AI provider error. Please review your inputs.');
    } finally {
      setRunning(false);
    }
  };

  const handleCopy = () => {
    if (!editableContent) return;
    navigator.clipboard.writeText(editableContent);
    toast.success('Draft copied to clipboard!');
  };

  const handleApprove = () => {
    setIsApproved(true);
    toast.success('Clinical draft certified by doctor. Ready for record insertion.');
  };

  return (
    <div className="stack-lg">
      <PageHeader
        title="Doctor AI Clinical Copilot"
        subtitle="Intelligent clinical draft generation, consultation auditing, and communication synthesis with physician-in-the-loop controls."
      />

      <AIDisclaimer />

      {/* Task Selection Mode Tabs */}
      <section className="card p-sm">
        <div className="row wrap gap-xs">
          {COPILOT_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`btn btn-sm ${activeMode === m.id ? 'btn-primary' : 'btn-ghost'} row gap-xs`}
              onClick={() => {
                setActiveMode(m.id);
                setResult(null);
                setIsApproved(false);
              }}
            >
              <m.icon size={15} /> <span>{m.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Input workspace + Output Workspace */}
      <div className="grid grid-2 align-start">
        {/* Left: Clinical Context Inputs */}
        <section className="card stack">
          <div className="row gap-xs">
            <Bot size={20} color="var(--teal-600)" />
            <h3>Clinical Context & Inputs</h3>
          </div>
          <p className="muted small">
            Provide patient observations. The Copilot strictly generates drafts for professional review.
          </p>

          <form className="stack-sm" onSubmit={handleRunCopilot}>
            <div>
              <label className="field-label">Target Patient (Optional)</label>
              <select
                className="select"
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
              >
                <option value="">-- General / No Specific Patient Selected --</option>
                {patients.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.userId?.name || 'Patient'}
                  </option>
                ))}
              </select>
            </div>

            {(activeMode === 'CONSULTATION_DRAFT' || activeMode === 'FOLLOW_UP_DRAFT' || activeMode === 'MISSING_INFO_CHECK') && (
              <div>
                <label className="field-label">Reported Symptoms & Chief Complaints</label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="e.g., Shortness of breath on exertion for 2 weeks, dry cough, evening fatigue..."
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                />
              </div>
            )}

            {(activeMode === 'CONSULTATION_DRAFT' || activeMode === 'MISSING_INFO_CHECK') && (
              <div>
                <label className="field-label">Vitals & Objective Findings</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., BP: 138/88 mmHg, HR: 82 bpm, SpO2: 98% on room air"
                  value={vitals}
                  onChange={(e) => setVitals(e.target.value)}
                />
              </div>
            )}

            {activeMode === 'REFERRAL_SUMMARY' && (
              <div>
                <label className="field-label">Referred Specialty</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., Pulmonology / Respiratory Medicine"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="field-label">
                {activeMode === 'PATIENT_EXPLANATION'
                  ? 'Clinical Findings / Jargon to Translate'
                  : activeMode === 'REFERRAL_SUMMARY'
                  ? 'Reason for Referral'
                  : 'Provisional Notes & Examination'}
              </label>
              <textarea
                className="input"
                rows={4}
                placeholder="Enter clinical notes, diagnostic impressions, or medication adjustments..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary row center gap-xs"
              disabled={running}
            >
              <Sparkles size={16} />
              <span>{running ? 'Copilot Synthesizing…' : 'Generate Clinical Draft'}</span>
            </button>
          </form>
        </section>

        {/* Right: Editable Draft & Certification Box */}
        <section className="card stack">
          <div className="row between wrap gap-sm">
            <div className="row gap-xs">
              <Edit3 size={18} color="var(--teal-600)" />
              <h3>Copilot Draft Workspace</h3>
            </div>
            {isApproved && (
              <span className="badge badge-success row gap-xs">
                <CheckCircle2 size={12} /> Doctor Certified
              </span>
            )}
          </div>

          {error && (
            <div className="alert alert-danger small">
              <AlertTriangle size={16} /> <span>{error}</span>
            </div>
          )}

          {result ? (
            <div className="stack-sm">
              <div className="muted small">
                {result.title} — <em>All output is editable by the doctor before clinical certification.</em>
              </div>

              <div>
                <label className="field-label">Editable Draft Content:</label>
                <textarea
                  className="input"
                  rows={9}
                  value={editableContent}
                  onChange={(e) => {
                    setEditableContent(e.target.value);
                    setIsApproved(false);
                  }}
                  style={{ lineHeight: 1.6 }}
                />
              </div>

              {result.missingItems?.length > 0 && (
                <div className="card p-sm stack-xs" style={{ background: 'var(--amber-50)', border: '1px solid var(--amber-600)' }}>
                  <strong className="small" style={{ color: 'var(--amber-600)' }}>
                    Missing Information Audit:
                  </strong>
                  <ul className="small muted" style={{ listStyle: 'disc', paddingLeft: '20px' }}>
                    {result.missingItems.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.recommendations?.length > 0 && (
                <div className="card p-sm stack-xs" style={{ background: 'var(--gray-50)' }}>
                  <strong className="small">Clinical Recommendations:</strong>
                  <ul className="small muted" style={{ listStyle: 'disc', paddingLeft: '20px' }}>
                    {result.recommendations.map((rec, idx) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="row gap-xs wrap mt-sm">
                <button
                  type="button"
                  className="btn btn-primary btn-sm row gap-xs"
                  onClick={handleApprove}
                >
                  <CheckCircle2 size={14} /> <span>Certify Clinical Draft</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm row gap-xs"
                  onClick={handleCopy}
                >
                  <Copy size={14} /> <span>Copy to Clipboard</span>
                </button>
              </div>

              <div className="small muted mt-xs" style={{ fontStyle: 'italic' }}>
                {result.disclaimer}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 muted small">
              Fill in clinical context on the left and click "Generate Clinical Draft".
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
