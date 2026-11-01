import { useState, useEffect } from 'react';
import { GitCompare, CheckCircle2, UserCheck, AlertCircle, FileText, Send, Sparkles } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import ComparisonChart from '../../components/medical/ComparisonChart';
import { AIDisclaimer } from '../../components/medical/DisclaimerBanner';
import { getMyPatients } from '../../services/doctorService';
import { getPatientComparisons, reviewComparison, compareReports, getPatientNavigation } from '../../services/continuityService';
import { useToast } from '../../context/AppContext';
import { formatDate } from '../../utils/format';

export default function DoctorReportComparisonPage() {
  const toast = useToast();
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [comparisons, setComparisons] = useState([]);
  const [activeComparison, setActiveComparison] = useState(null);
  const [loading, setLoading] = useState(true);

  // Review & Approval state
  const [doctorNotes, setDoctorNotes] = useState('');
  const [nextConsultNotes, setNextConsultNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);

  // New comparison creation state for doctor
  const [patientRecords, setPatientRecords] = useState([]);
  const [baselineId, setBaselineId] = useState('');
  const [currentId, setCurrentId] = useState('');
  const [comparing, setComparing] = useState(false);
  const [showCompareForm, setShowCompareForm] = useState(false);

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
        toast.error('Failed to load patient directory');
      } finally {
        setLoading(false);
      }
    }
    loadPatients();
  }, []);

  useEffect(() => {
    if (!selectedPatientId) return;
    async function loadPatientComparisons() {
      try {
        setLoading(true);
        const [comps, nav] = await Promise.all([
          getPatientComparisons(selectedPatientId),
          getPatientNavigation(selectedPatientId).catch(() => null),
        ]);
        setComparisons(comps || []);
        setPatientRecords(nav?.medicalRecords || []);
        if (comps?.length > 0) {
          setActiveComparison(comps[0]);
          setDoctorNotes(comps[0].doctorObservation?.notes || '');
          setNextConsultNotes(comps[0].doctorObservation?.nextConsultationNotes || '');
        } else {
          setActiveComparison(null);
          setDoctorNotes('');
          setNextConsultNotes('');
        }
      } catch (err) {
        toast.error('Failed to load patient comparisons');
      } finally {
        setLoading(false);
      }
    }
    loadPatientComparisons();
  }, [selectedPatientId]);

  const handleCreateComparison = async () => {
    if (!baselineId || !currentId) {
      toast.error('Please select both baseline and current reports.');
      return;
    }
    if (baselineId === currentId) {
      toast.error('Please choose two different reports to compare.');
      return;
    }
    try {
      setComparing(true);
      const res = await compareReports({ baselineRecordId: baselineId, currentRecordId: currentId });
      toast.success('Report comparison generated!');
      setShowCompareForm(false);
      setActiveComparison(res);
      const comps = await getPatientComparisons(selectedPatientId);
      setComparisons(comps || []);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to generate comparison');
    } finally {
      setComparing(false);
    }
  };

  const handleReview = async (approved) => {
    if (!activeComparison) return;
    try {
      setReviewing(true);
      const updated = await reviewComparison(activeComparison._id, {
        notes: doctorNotes,
        nextConsultationNotes: nextConsultNotes,
        approved,
      });
      toast.success(approved ? 'Report comparison approved and certified!' : 'Review saved as clinical draft.');
      setActiveComparison(updated);
      // Refresh comparison list
      const comps = await getPatientComparisons(selectedPatientId);
      setComparisons(comps || []);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to submit review');
    } finally {
      setReviewing(false);
    }
  };

  if (loading && patients.length === 0) {
    return <LoadingSpinner label="Loading clinical report review portal…" />;
  }

  const selectedPatient = patients.find((p) => p._id === selectedPatientId);

  return (
    <div className="stack-lg">
      <PageHeader
        title="Clinical Medical Report Evolution Tracker"
        subtitle="Review longitudinal biomarker changes, certify parameter extractions, and record doctor-approved clinical observations."
      />

      <AIDisclaimer />

      {/* Patient Selector */}
      <section className="card p-sm row between wrap gap-sm">
        <div className="row gap-xs">
          <strong>Select Patient:</strong>
          <select
            className="select"
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            style={{ minWidth: '240px' }}
          >
            {patients.map((p) => (
              <option key={p._id} value={p._id}>
                {p.userId?.name || 'Patient'} ({p.gender || 'N/A'}, Blood: {p.bloodGroup || 'Unknown'})
              </option>
            ))}
          </select>
        </div>

        {selectedPatient && (
          <div className="row gap-sm wrap align-center">
            <span className="small muted">
              Allergies: <strong>{selectedPatient.allergies?.join(', ') || 'None documented'}</strong>
            </span>
            <button
              type="button"
              className="btn btn-sm btn-secondary row gap-xs"
              onClick={() => setShowCompareForm(!showCompareForm)}
            >
              <GitCompare size={14} />
              <span>{showCompareForm ? 'Close Form' : 'Compare Two Reports'}</span>
            </button>
          </div>
        )}
      </section>

      {/* Doctor Report Comparison Generator Box */}
      {showCompareForm && (
        <section className="card stack-sm" style={{ border: '1.5px solid var(--teal-500)' }}>
          <div className="row gap-xs">
            <Sparkles size={18} color="var(--teal-600)" />
            <h4>Generate Report Evolution for {selectedPatient?.userId?.name || 'Patient'}</h4>
          </div>
          {patientRecords.length >= 2 ? (
            <div className="grid grid-2 gap-sm align-start mt-xs">
              <div>
                <label className="field-label">1. Baseline (Earlier) Report</label>
                <select
                  className="select"
                  value={baselineId}
                  onChange={(e) => setBaselineId(e.target.value)}
                >
                  <option value="">-- Choose Baseline Report --</option>
                  {patientRecords.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.title} ({formatDate(r.createdAt)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="field-label">2. Current (Later) Report</label>
                <select
                  className="select"
                  value={currentId}
                  onChange={(e) => setCurrentId(e.target.value)}
                >
                  <option value="">-- Choose Latest Report --</option>
                  {patientRecords.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.title} ({formatDate(r.createdAt)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-xs">
                <button
                  type="button"
                  className="btn btn-primary btn-sm row gap-xs"
                  disabled={comparing || !baselineId || !currentId || baselineId === currentId}
                  onClick={handleCreateComparison}
                >
                  <Sparkles size={14} />
                  <span>{comparing ? 'Extracting & Comparing…' : 'Generate Evolution Curve'}</span>
                </button>
              </div>
            </div>
          ) : (
            <p className="small muted">
              This patient has {patientRecords.length} report(s) on file. At least two reports are required for chronological evolution tracking.
            </p>
          )}
        </section>
      )}

      {/* Comparisons for this patient */}
      {comparisons.length > 0 && (
        <section className="card p-sm row between wrap gap-sm">
          <div className="row gap-xs wrap">
            <span className="small muted">Comparisons on file:</span>
            {comparisons.map((c, i) => (
              <button
                key={c._id}
                type="button"
                className={`btn btn-sm ${activeComparison?._id === c._id ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => {
                  setActiveComparison(c);
                  setDoctorNotes(c.doctorObservation?.notes || '');
                  setNextConsultNotes(c.doctorObservation?.nextConsultationNotes || '');
                }}
              >
                <span>Comparison #{i + 1} ({formatDate(c.createdAt)})</span>
                {c.doctorObservation?.approved && (
                  <span className="badge badge-success" style={{ padding: '1px 5px', fontSize: '0.68rem' }}>
                    Certified
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Active Comparison & Doctor Review Workspace */}
      {activeComparison ? (
        <div className="stack-lg">
          {/* Status Header */}
          <div className="card row between wrap gap-sm">
            <div>
              <div className="row gap-xs">
                <h3>Report Evolution Analysis</h3>
                {activeComparison.doctorObservation?.approved ? (
                  <span className="badge badge-success row gap-xs">
                    <UserCheck size={14} /> Doctor Certified
                  </span>
                ) : (
                  <span className="badge badge-warning row gap-xs">
                    <AlertCircle size={14} /> Pending Doctor Certification
                  </span>
                )}
              </div>
              <p className="muted small" style={{ marginTop: '4px' }}>
                Baseline: <strong>{activeComparison.baselineRecordId?.title || 'Baseline'}</strong> vs Current:{' '}
                <strong>{activeComparison.currentRecordId?.title || 'Latest'}</strong>
              </p>
            </div>
            <div className="text-right small muted">
              Created: {formatDate(activeComparison.createdAt)}
            </div>
          </div>

          {/* Interactive Chart */}
          <section className="card">
            <ComparisonChart parameters={activeComparison.parameters || []} />
          </section>

          {/* Detailed Parameter Matrix */}
          <section className="card stack">
            <div className="row between wrap gap-sm">
              <h4>Extracted Laboratory Metrics</h4>
              <span className="small muted">{activeComparison.parameters?.length || 0} parameter(s) matched</span>
            </div>

            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Biomarker</th>
                    <th>Standard Range</th>
                    <th>Baseline</th>
                    <th>Latest Value</th>
                    <th>Absolute Delta</th>
                    <th>% Shift</th>
                    <th>Range Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeComparison.parameters || []).map((p, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td className="muted small">{p.referenceRange}</td>
                      <td>{p.baselineValue} {p.unit}</td>
                      <td style={{ fontWeight: 700 }}>{p.currentValue} {p.unit}</td>
                      <td>
                        <span style={{ color: p.delta > 0 ? 'var(--red-600)' : 'var(--teal-600)' }}>
                          {p.delta > 0 ? `+${p.delta}` : p.delta} {p.unit}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-ghost">
                          {p.percentChange > 0 ? `+${p.percentChange}%` : `${p.percentChange}%`}
                        </span>
                      </td>
                      <td>
                        {p.currentFlag === 'NORMAL' ? (
                          <span className="badge badge-success">Normal</span>
                        ) : p.currentFlag === 'HIGH' ? (
                          <span className="badge badge-danger">High</span>
                        ) : (
                          <span className="badge badge-warning">Low</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* AI Draft Narrative Review */}
          <section className="card stack-sm">
            <div className="row gap-xs">
              <Sparkles size={18} color="var(--teal-600)" />
              <h4>AI Draft Explanation</h4>
            </div>
            <p className="small" style={{ lineHeight: 1.6 }}>
              {activeComparison.aiDraftAnalysis?.summary}
            </p>
            {activeComparison.aiDraftAnalysis?.significantChanges?.length > 0 && (
              <div style={{ marginTop: '6px' }}>
                <strong className="small">Noted Shifts:</strong>
                <ul className="small muted" style={{ listStyle: 'disc', paddingLeft: '20px' }}>
                  {activeComparison.aiDraftAnalysis.significantChanges.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Clinical Observation Form & Certification Gate */}
          <section
            className="card stack"
            style={{
              border: '2px solid var(--teal-500, #14b8a6)',
              background: 'rgba(230, 247, 245, 0.3)',
            }}
          >
            <div className="row gap-xs">
              <UserCheck size={20} color="var(--teal-600)" />
              <h3>Doctor Clinical Observations & Action Plan</h3>
            </div>
            <p className="small muted">
              Provide your clinical correlation before certifying these observations for patient view.
            </p>

            <div className="stack-sm">
              <div>
                <label className="field-label" htmlFor="doc-obs">
                  Clinical Observations & Diagnostic Correlation:
                </label>
                <textarea
                  id="doc-obs"
                  className="input"
                  rows={4}
                  placeholder="Record your clinical interpretation of these shifts (e.g., 'Metabolic parameters demonstrate stabilizing trend on current metformin regimen...')"
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                />
              </div>

              <div>
                <label className="field-label" htmlFor="doc-next">
                  Notes & Action Plan for Next Consultation:
                </label>
                <textarea
                  id="doc-next"
                  className="input"
                  rows={3}
                  placeholder="Items to address in follow-up consultation (e.g., 'Repeat renal profile in 6 weeks, evaluate exercise tolerability...')"
                  value={nextConsultNotes}
                  onChange={(e) => setNextConsultNotes(e.target.value)}
                />
              </div>

              <div className="row gap-sm wrap mt-sm">
                <button
                  type="button"
                  className="btn btn-primary row center gap-xs"
                  disabled={reviewing || !doctorNotes.trim()}
                  onClick={() => handleReview(true)}
                >
                  <CheckCircle2 size={16} />
                  <span>{reviewing ? 'Certifying…' : 'Approve & Certify for Patient'}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-ghost row center gap-xs"
                  disabled={reviewing}
                  onClick={() => handleReview(false)}
                >
                  <span>Save Draft Without Patient Certification</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon={FileText}
            title="No Evolution Tracker for this Patient"
            message="No comparative laboratory reports are currently compiled for this patient. You can compare reports directly during consultation."
          />
        </div>
      )}
    </div>
  );
}
