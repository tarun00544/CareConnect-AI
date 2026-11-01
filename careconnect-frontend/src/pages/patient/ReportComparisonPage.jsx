import { useState, useEffect } from 'react';
import { GitCompare, FileText, CheckCircle2, AlertCircle, Sparkles, Upload, Clock, UserCheck } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import ComparisonChart from '../../components/medical/ComparisonChart';
import { AIDisclaimer } from '../../components/medical/DisclaimerBanner';
import { getMyRecords } from '../../services/patientService';
import { uploadReport } from '../../services/uploadService';
import { compareReports, getPatientComparisons } from '../../services/continuityService';
import { useToast } from '../../context/AppContext';
import { formatDate } from '../../utils/format';

export default function ReportComparisonPage() {
  const toast = useToast();
  const [records, setRecords] = useState([]);
  const [comparisons, setComparisons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Selection for comparison
  const [baselineId, setBaselineId] = useState('');
  const [currentId, setCurrentId] = useState('');
  const [activeComparison, setActiveComparison] = useState(null);

  // Upload modal / inline form state
  const [uploadFile, setUploadFile] = useState(null);
  const [reportTitle, setReportTitle] = useState('');
  const [reportDescription, setReportDescription] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [recs, comps] = await Promise.all([
        getMyRecords(),
        getPatientComparisons(),
      ]);
      setRecords(recs || []);
      setComparisons(comps || []);
      if (comps && comps.length > 0) {
        setActiveComparison(comps[0]);
      }
    } catch (err) {
      toast.error('Failed to load records or previous comparisons');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUploadNewReport = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.error('Please select a file to upload');
      return;
    }
    try {
      setUploading(true);
      await uploadReport(uploadFile, {
        title: reportTitle.trim() || uploadFile.name,
        description: reportDescription.trim(),
        type: 'LAB_REPORT',
      });
      toast.success('Medical report uploaded successfully');
      setUploadFile(null);
      setReportTitle('');
      setReportDescription('');
      await loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to upload report');
    } finally {
      setUploading(false);
    }
  };

  const handleCompare = async () => {
    if (!baselineId || !currentId) {
      toast.error('Please select both a baseline report and a current report to compare.');
      return;
    }
    if (baselineId === currentId) {
      toast.error('Please choose two different reports for comparison.');
      return;
    }

    try {
      setComparing(true);
      const result = await compareReports({
        baselineRecordId: baselineId,
        currentRecordId: currentId,
      });
      toast.success('Report comparison generated!');
      setActiveComparison(result);
      await loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to compare reports');
    } finally {
      setComparing(false);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Loading reports and health metrics..." />;
  }

  return (
    <div className="stack-lg">
      <PageHeader
        title="AI Medical Report Evolution Tracker"
        subtitle="Track chronological biomarker trends, review parameter evolution, and access doctor-approved clinical observations."
      />

      <AIDisclaimer />

      {/* Top Action Section: Compare Two Reports & Quick Upload */}
      <div className="grid grid-2 align-start">
        {/* Selector Card */}
        <section className="card stack">
          <div className="row gap-xs">
            <GitCompare size={20} color="var(--teal-600)" />
            <h3>Select Two Reports to Compare</h3>
          </div>
          <p className="muted small">
            Choose an older baseline laboratory record and a more recent test to analyze numerical shifts side by side.
          </p>

          <div className="grid gap-sm">
            <div>
              <label className="field-label" htmlFor="base-report">1. Baseline (Earlier) Report</label>
              <select
                id="base-report"
                className="select"
                value={baselineId}
                onChange={(e) => setBaselineId(e.target.value)}
              >
                <option value="">-- Choose Baseline Report --</option>
                {records.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.title} ({formatDate(r.createdAt)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor="curr-report">2. Current (Later) Report</label>
              <select
                id="curr-report"
                className="select"
                value={currentId}
                onChange={(e) => setCurrentId(e.target.value)}
              >
                <option value="">-- Choose Latest Report --</option>
                {records.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.title} ({formatDate(r.createdAt)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary row center gap-xs"
            disabled={comparing || !baselineId || !currentId || baselineId === currentId}
            onClick={handleCompare}
          >
            <Sparkles size={16} />
            <span>{comparing ? 'Analyzing Biomarkers…' : 'Generate Evolution Comparison'}</span>
          </button>
        </section>

        {/* Quick Upload Card */}
        <section className="card stack">
          <div className="row gap-xs">
            <Upload size={20} color="var(--teal-600)" />
            <h3>Upload New Medical Report</h3>
          </div>
          <p className="muted small">
            Add a lab report or paste test parameters (e.g. HbA1c: 6.2%, Fasting Blood Sugar: 110 mg/dL).
          </p>

          <form className="stack-sm" onSubmit={handleUploadNewReport}>
            <div>
              <input
                type="file"
                className="input"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setUploadFile(f || null);
                  if (f && !reportTitle) setReportTitle(f.name.replace(/\.[^/.]+$/, ''));
                }}
              />
            </div>
            <div>
              <input
                type="text"
                className="input"
                placeholder="Report title (e.g. Complete Metabolic Panel)"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
              />
            </div>
            <div>
              <textarea
                className="input"
                rows={2}
                placeholder="Optional report notes or parameters (e.g. Fasting Glucose: 115 mg/dL, HbA1c: 6.4%)..."
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="btn btn-secondary row center gap-xs"
              disabled={uploading || !uploadFile}
            >
              <Upload size={16} />
              <span>{uploading ? 'Uploading…' : 'Save to My Medical Records'}</span>
            </button>
          </form>
        </section>
      </div>

      {/* Comparison History Selector Bar */}
      {comparisons.length > 0 && (
        <section className="card p-sm">
          <div className="row between wrap gap-sm">
            <span className="small muted">
              <strong>Previous Comparisons on File:</strong> ({comparisons.length})
            </span>
            <div className="row wrap gap-xs">
              {comparisons.map((c, i) => (
                <button
                  key={c._id}
                  type="button"
                  className={`btn btn-sm ${activeComparison?._id === c._id ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setActiveComparison(c)}
                >
                  <Clock size={14} />
                  <span>
                    Comparison #{i + 1} ({formatDate(c.createdAt)})
                  </span>
                  {c.doctorObservation?.approved && (
                    <span className="badge badge-success" style={{ padding: '1px 5px', fontSize: '0.68rem' }}>
                      Approved
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Active Comparison Display */}
      {activeComparison ? (
        <div className="stack-lg">
          {/* Header Card for this comparison */}
          <div className="card row between wrap gap-md">
            <div>
              <div className="row gap-xs">
                <h3>Evolution Analysis</h3>
                {activeComparison.doctorObservation?.approved ? (
                  <span className="badge badge-success row gap-xs">
                    <UserCheck size={14} /> Doctor Approved
                  </span>
                ) : (
                  <span className="badge badge-warning row gap-xs">
                    <AlertCircle size={14} /> AI Draft (Pending Doctor Review)
                  </span>
                )}
              </div>
              <p className="muted small" style={{ marginTop: '4px' }}>
                Comparing <strong>{activeComparison.baselineRecordId?.title || 'Baseline Report'}</strong> with{' '}
                <strong>{activeComparison.currentRecordId?.title || 'Current Report'}</strong>
              </p>
            </div>

            <div className="text-right">
              <span className="small muted">Generated on {formatDate(activeComparison.createdAt)}</span>
            </div>
          </div>

          {/* Doctor Approved Observations Card */}
          {activeComparison.doctorObservation?.approved && (
            <div
              className="card stack-sm"
              style={{
                border: '1.5px solid var(--teal-500, #14b8a6)',
                backgroundColor: 'rgba(230, 247, 245, 0.5)',
              }}
            >
              <div className="row gap-xs">
                <CheckCircle2 size={18} color="var(--teal-600)" />
                <h4>Doctor-Approved Clinical Observations</h4>
              </div>
              <p style={{ margin: '4px 0', fontSize: '0.96rem' }}>
                {activeComparison.doctorObservation.notes || 'The doctor has reviewed and approved these extracted parameters.'}
              </p>
              {activeComparison.doctorObservation.nextConsultationNotes && (
                <div style={{ marginTop: '6px', fontSize: '0.9rem', color: 'var(--navy-800)' }}>
                  <strong>Plan for Next Consultation:</strong> {activeComparison.doctorObservation.nextConsultationNotes}
                </div>
              )}
            </div>
          )}

          {/* Interactive Visual Evolution Chart */}
          <section className="card">
            <ComparisonChart parameters={activeComparison.parameters || []} />
          </section>

          {/* Detailed Side-by-Side Data Table */}
          <section className="card stack">
            <div className="row between wrap gap-sm">
              <h4>Side-by-Side Parameter Matrix</h4>
              <span className="small muted">{activeComparison.parameters?.length || 0} parameter(s) evaluated</span>
            </div>

            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Medical Parameter</th>
                    <th>Standard Reference Range</th>
                    <th>Previous Baseline Value</th>
                    <th>Latest Value</th>
                    <th>Absolute Delta</th>
                    <th>Percentage Shift</th>
                    <th>Clinical Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeComparison.parameters || []).map((p, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td className="muted small">{p.referenceRange || 'Reference not specified'}</td>
                      <td>
                        {p.baselineValue} {p.unit}
                      </td>
                      <td style={{ fontWeight: 700 }}>
                        {p.currentValue} {p.unit}
                      </td>
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
                        ) : p.currentFlag === 'LOW' ? (
                          <span className="badge badge-warning">Low</span>
                        ) : (
                          <span className="badge badge-ghost">Evaluated</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* AI Draft Explanation & Safety Box */}
          <section className="card stack-sm">
            <div className="row gap-xs">
              <Sparkles size={18} color="var(--teal-600)" />
              <h4>AI Draft Explanation</h4>
            </div>
            <p className="small" style={{ lineHeight: 1.6 }}>
              {activeComparison.aiDraftAnalysis?.summary || 'No narrative generated.'}
            </p>

            {activeComparison.aiDraftAnalysis?.significantChanges?.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <strong className="small">Significant Observed Shifts:</strong>
                <ul className="small muted" style={{ listStyle: 'disc', paddingLeft: '20px', marginTop: '4px' }}>
                  {activeComparison.aiDraftAnalysis.significantChanges.map((change, i) => (
                    <li key={i}>{change}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="alert alert-info mt-sm small">
              <strong>Notice:</strong>{' '}
              {activeComparison.aiDraftAnalysis?.safetyNotice ||
                'Numerical changes must be correlated with your clinical history. Do not alter any medication dosages without consulting your doctor.'}
            </div>
          </section>
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title="No Comparison Selected"
          message="Select two reports above or choose from previously saved comparisons to view parameter evolutions."
        />
      )}
    </div>
  );
}
