import { useState, useEffect } from 'react';
import {
  Compass, Sparkles, CheckCircle2, Edit3, Save, Share2, Eye,
  Calendar, ClipboardList, FlaskConical, AlertTriangle, Pill, User
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import { getMyPatients } from '../../services/doctorService';
import {
  getPatientNavigation,
  generateAISummary,
  updateAndApproveSummary
} from '../../services/continuityService';
import { useToast } from '../../context/AppContext';
import { formatDate } from '../../utils/format';

export default function DoctorPatientNavigationPage() {
  const toast = useToast();
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [navData, setNavData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Active Summary Editing state
  const [activeSummary, setActiveSummary] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedFields, setEditedFields] = useState({
    patientOverview: '',
    previousConsultationSummary: '',
    currentConcerns: '',
    relevantMedicalHistory: '',
    recentReportComparisonSummary: '',
    pendingFollowUpTasks: '',
    clinicalObservations: '',
  });

  useEffect(() => {
    async function loadPatients() {
      try {
        setLoading(true);
        const list = await getMyPatients();
        setPatients(list || []);
        if (list?.length > 0) {
          setSelectedPatientId(list[0]._id);
        }
      } catch (err) {
        toast.error('Failed to load doctor patients');
      } finally {
        setLoading(false);
      }
    }
    loadPatients();
  }, []);

  const loadPatientNav = async (pid) => {
    if (!pid) return;
    try {
      setLoading(true);
      const data = await getPatientNavigation(pid);
      setNavData(data);
      if (data?.latestApprovedSummary) {
        setActiveSummary(data.latestApprovedSummary);
        populateEditor(data.latestApprovedSummary);
      } else {
        setActiveSummary(null);
      }
    } catch (err) {
      toast.error('Failed to load patient navigation data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPatientId) {
      loadPatientNav(selectedPatientId);
    }
  }, [selectedPatientId]);

  const populateEditor = (summary) => {
    const draft = summary?.doctorDraft || summary?.aiGenerated || {};
    setEditedFields({
      patientOverview: draft.patientOverview || '',
      previousConsultationSummary: draft.previousConsultationSummary || '',
      currentConcerns: draft.currentConcerns || '',
      relevantMedicalHistory: draft.relevantMedicalHistory || '',
      recentReportComparisonSummary: draft.recentReportComparisonSummary || '',
      pendingFollowUpTasks: draft.pendingFollowUpTasks || '',
      clinicalObservations: draft.clinicalObservations || '',
    });
  };

  const handleGenerateSummary = async () => {
    if (!selectedPatientId) return;
    try {
      setGenerating(true);
      const summary = await generateAISummary({ patientId: selectedPatientId });
      toast.success('AI structured patient summary generated!');
      setActiveSummary(summary);
      populateEditor(summary);
      setIsEditing(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to generate AI summary');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveSummary = async (approve = false, share = false) => {
    if (!activeSummary) return;
    try {
      setSaving(true);
      const updated = await updateAndApproveSummary(activeSummary._id, {
        draftUpdates: editedFields,
        approve,
        shareWithPatient: share,
      });
      setActiveSummary(updated);
      setIsEditing(false);
      toast.success(
        share
          ? 'Summary approved and shared with patient!'
          : approve
          ? 'Summary approved as official clinical record!'
          : 'Summary draft saved successfully.'
      );
      await loadPatientNav(selectedPatientId);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save summary');
    } finally {
      setSaving(false);
    }
  };

  if (loading && patients.length === 0) {
    return <LoadingSpinner label="Opening Patient Care Navigation portal…" />;
  }

  const patient = navData?.patient;

  return (
    <div className="stack-lg">
      <PageHeader
        title="AI Patient Care Navigation"
        subtitle="360° patient clinical history, longitudinal care coordination, and doctor-approved intelligence briefs."
      />

      {/* Patient Selector */}
      <section className="card p-sm row between wrap gap-sm">
        <div className="row gap-xs">
          <strong>Select Patient:</strong>
          <select
            className="select"
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            style={{ minWidth: '260px' }}
          >
            {patients.map((p) => (
              <option key={p._id} value={p._id}>
                {p.userId?.name || 'Patient'} ({p.gender || 'N/A'}, Blood: {p.bloodGroup || 'N/A'})
              </option>
            ))}
          </select>
        </div>

        <div className="row gap-xs">
          <button
            type="button"
            className="btn btn-primary row center gap-xs"
            disabled={generating}
            onClick={handleGenerateSummary}
          >
            <Sparkles size={16} />
            <span>{generating ? 'Synthesizing Journey…' : 'Generate AI Summary'}</span>
          </button>
        </div>
      </section>

      {/* 360 Patient Summary Cards */}
      {patient && (
        <section className="card stack">
          <div className="row between wrap gap-sm">
            <div className="row gap-xs">
              <User size={20} color="var(--teal-600)" />
              <h3>{patient.userId?.name || 'Patient'} — Clinical Profile</h3>
            </div>
            <span className="badge badge-teal">CareConnect Patient ID: {patient._id?.slice(-6)}</span>
          </div>

          <div className="grid grid-3 gap-md">
            <div>
              <div className="muted small">Demographics</div>
              <strong>{patient.gender || 'N/A'} · Blood Group: {patient.bloodGroup || 'Unknown'}</strong>
            </div>
            <div>
              <div className="muted small">Emergency Contact</div>
              <strong>{patient.emergencyContact?.name || 'None listed'} ({patient.emergencyContact?.relation || ''})</strong>
            </div>
            <div>
              <div className="muted small">Phone / Email</div>
              <strong>{patient.userId?.phone || 'N/A'} · {patient.userId?.email || 'N/A'}</strong>
            </div>
          </div>

          <div className="grid grid-2 gap-md" style={{ borderTop: '1px solid var(--gray-200)', paddingTop: '12px' }}>
            <div>
              <div className="muted small row gap-xs">
                <AlertTriangle size={14} color="var(--red-600)" />
                <span>Documented Drug Allergies</span>
              </div>
              <div className="mt-xs">
                {patient.allergies?.length ? (
                  <div className="row wrap gap-xs">
                    {patient.allergies.map((a, i) => (
                      <span key={i} className="badge badge-danger">{a}</span>
                    ))}
                  </div>
                ) : (
                  <span className="small text-success">No allergies documented.</span>
                )}
              </div>
            </div>

            <div>
              <div className="muted small row gap-xs">
                <Pill size={14} color="var(--teal-600)" />
                <span>Current Medications</span>
              </div>
              <div className="mt-xs">
                {patient.currentMedicines?.length ? (
                  <div className="row wrap gap-xs">
                    {patient.currentMedicines.map((m, i) => (
                      <span key={i} className="badge badge-info">{m}</span>
                    ))}
                  </div>
                ) : (
                  <span className="small muted">None documented.</span>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Structured AI Patient Summary Workspace */}
      <section
        className="card stack"
        style={{
          border: '2px solid var(--teal-500)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div className="row between wrap gap-sm">
          <div className="row gap-xs">
            <Compass size={22} color="var(--teal-600)" />
            <div>
              <h3 style={{ margin: 0 }}>Structured Clinical Patient Summary</h3>
              <span className="muted small">
                {activeSummary?.isApproved
                  ? `Approved Clinical Record (Certified on ${formatDate(activeSummary.approvedAt)})`
                  : activeSummary
                  ? 'AI Draft — Doctor Review & Certification Required'
                  : 'Click "Generate AI Summary" above to synthesize complete patient history.'}
              </span>
            </div>
          </div>

          {activeSummary && (
            <div className="row gap-xs wrap">
              {!isEditing ? (
                <button
                  type="button"
                  className="btn btn-sm btn-secondary row gap-xs"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit3 size={14} /> <span>Edit Summary</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost row gap-xs"
                  onClick={() => setIsEditing(false)}
                >
                  <Eye size={14} /> <span>Review Summary</span>
                </button>
              )}

              <button
                type="button"
                className="btn btn-sm btn-secondary row gap-xs"
                disabled={saving}
                onClick={() => handleSaveSummary(false, false)}
              >
                <Save size={14} /> <span>Save Draft</span>
              </button>

              <button
                type="button"
                className="btn btn-sm btn-primary row gap-xs"
                disabled={saving}
                onClick={() => handleSaveSummary(true, false)}
              >
                <CheckCircle2 size={14} /> <span>Approve Summary</span>
              </button>

              <button
                type="button"
                className="btn btn-sm btn-teal row gap-xs"
                disabled={saving || !activeSummary.isApproved}
                title={!activeSummary.isApproved ? 'Must approve before sharing' : 'Share with patient'}
                onClick={() => handleSaveSummary(true, true)}
              >
                <Share2 size={14} /> <span>Share With Patient</span>
              </button>
            </div>
          )}
        </div>

        {activeSummary ? (
          <div className="grid gap-md mt-sm">
            {/* 1. Patient Overview */}
            <div>
              <label className="field-label">1. Patient Clinical Overview</label>
              {isEditing ? (
                <textarea
                  className="input"
                  rows={3}
                  value={editedFields.patientOverview}
                  onChange={(e) => setEditedFields({ ...editedFields, patientOverview: e.target.value })}
                />
              ) : (
                <div className="card p-sm small" style={{ background: 'var(--gray-50)' }}>
                  {editedFields.patientOverview}
                </div>
              )}
            </div>

            {/* 2. Previous Consultation Summary */}
            <div>
              <label className="field-label">2. Previous Consultation Brief</label>
              {isEditing ? (
                <textarea
                  className="input"
                  rows={3}
                  value={editedFields.previousConsultationSummary}
                  onChange={(e) => setEditedFields({ ...editedFields, previousConsultationSummary: e.target.value })}
                />
              ) : (
                <div className="card p-sm small" style={{ background: 'var(--gray-50)' }}>
                  {editedFields.previousConsultationSummary}
                </div>
              )}
            </div>

            {/* 3. Current Patient-Reported Concerns */}
            <div>
              <label className="field-label">3. Current Patient Concerns</label>
              {isEditing ? (
                <textarea
                  className="input"
                  rows={2}
                  value={editedFields.currentConcerns}
                  onChange={(e) => setEditedFields({ ...editedFields, currentConcerns: e.target.value })}
                />
              ) : (
                <div className="card p-sm small" style={{ background: 'var(--gray-50)' }}>
                  {editedFields.currentConcerns}
                </div>
              )}
            </div>

            {/* 4. Relevant Medical History */}
            <div>
              <label className="field-label">4. Relevant Medical History</label>
              {isEditing ? (
                <textarea
                  className="input"
                  rows={2}
                  value={editedFields.relevantMedicalHistory}
                  onChange={(e) => setEditedFields({ ...editedFields, relevantMedicalHistory: e.target.value })}
                />
              ) : (
                <div className="card p-sm small" style={{ background: 'var(--gray-50)' }}>
                  {editedFields.relevantMedicalHistory}
                </div>
              )}
            </div>

            {/* 5. Recent Report Comparison Summary */}
            <div>
              <label className="field-label">5. Recent Report Comparison Summary</label>
              {isEditing ? (
                <textarea
                  className="input"
                  rows={3}
                  value={editedFields.recentReportComparisonSummary}
                  onChange={(e) => setEditedFields({ ...editedFields, recentReportComparisonSummary: e.target.value })}
                />
              ) : (
                <div className="card p-sm small" style={{ background: 'var(--gray-50)' }}>
                  {editedFields.recentReportComparisonSummary}
                </div>
              )}
            </div>

            {/* 6. Pending Follow-up Tasks */}
            <div>
              <label className="field-label">6. Pending Follow-Up Tasks</label>
              {isEditing ? (
                <textarea
                  className="input"
                  rows={2}
                  value={editedFields.pendingFollowUpTasks}
                  onChange={(e) => setEditedFields({ ...editedFields, pendingFollowUpTasks: e.target.value })}
                />
              ) : (
                <div className="card p-sm small" style={{ background: 'var(--gray-50)', whiteSpace: 'pre-line' }}>
                  {editedFields.pendingFollowUpTasks}
                </div>
              )}
            </div>

            {/* 7. Questions Doctor May Consider Asking */}
            <div className="card p-sm" style={{ background: 'rgba(234, 242, 254, 0.4)', border: '1px solid var(--blue-200, #bfdbfe)' }}>
              <strong>7. High-Yield Questions to Consider During Consultation:</strong>
              <ul className="small muted mt-xs" style={{ listStyle: 'disc', paddingLeft: '20px' }}>
                {(activeSummary.doctorDraft?.suggestedQuestions || activeSummary.aiGenerated?.suggestedDoctorQuestions || []).map((q, i) => (
                  <li key={i} style={{ marginBottom: '4px' }}>{q}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Compass}
            title="No Active Summary Draft"
            message="Click 'Generate AI Summary' above to assemble an intelligent overview of this patient's records."
          />
        )}
      </section>

      {/* Historical Data Collateral Grid */}
      <div className="grid grid-2 align-start">
        {/* Previous Consultations */}
        <section className="card stack-sm">
          <div className="row gap-xs">
            <Calendar size={18} color="var(--teal-600)" />
            <h4>Past Consultations ({navData?.pastAppointments?.length || 0})</h4>
          </div>
          {navData?.pastAppointments?.length ? (
            <div className="stack-xs">
              {navData.pastAppointments.slice(0, 4).map((a) => (
                <div key={a._id} className="card p-sm row between">
                  <div>
                    <strong>{formatDate(a.date)}</strong> ({a.consultationType})
                    <div className="small muted">Notes: {a.notes || 'Routine consultation'}</div>
                  </div>
                  <span className="badge badge-ghost">{a.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">No previous consultations.</p>
          )}
        </section>

        {/* Medical Reports */}
        <section className="card stack-sm">
          <div className="row gap-xs">
            <FlaskConical size={18} color="var(--blue-600)" />
            <h4>Medical Reports ({navData?.medicalRecords?.length || 0})</h4>
          </div>
          {navData?.medicalRecords?.length ? (
            <div className="stack-xs">
              {navData.medicalRecords.slice(0, 4).map((r) => (
                <div key={r._id} className="card p-sm row between">
                  <div>
                    <strong>{r.title}</strong>
                    <div className="small muted">{formatDate(r.createdAt)} · {r.type}</div>
                  </div>
                  {r.fileUrl && (
                    <a href={r.fileUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost">
                      View
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">No reports uploaded.</p>
          )}
        </section>
      </div>
    </div>
  );
}
