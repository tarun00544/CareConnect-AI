import { useState, useEffect } from 'react';
import { CalendarCheck, Upload, CheckCircle2, Clock, AlertTriangle, CalendarPlus, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import { getMyFollowUps, uploadFollowUpReport } from '../../services/continuityService';
import { useToast } from '../../context/AppContext';
import { formatDate } from '../../utils/format';

export default function FollowUpsPage() {
  const toast = useToast();
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeUploadId, setActiveUploadId] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploading, setUploading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const items = await getMyFollowUps();
      setFollowUps(items || []);
    } catch (err) {
      toast.error('Failed to load follow-up tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUploadReport = async (followUpId) => {
    if (!uploadFile) {
      toast.error('Please select a file to upload');
      return;
    }
    try {
      setUploading(true);
      await uploadFollowUpReport(followUpId, uploadFile, {
        title: uploadFile.name,
        description: uploadDesc,
        type: 'LAB_REPORT',
      });
      toast.success('Requested report uploaded successfully!');
      setActiveUploadId(null);
      setUploadFile(null);
      setUploadDesc('');
      await loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to upload requested report');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Loading your follow-up care schedule…" />;
  }

  const pendingOrUpcoming = followUps.filter((f) => f.status === 'UPCOMING' || f.status === 'PENDING' || f.status === 'OVERDUE');
  const completed = followUps.filter((f) => f.status === 'COMPLETED');

  return (
    <div className="stack-lg">
      <PageHeader
        title="Follow-Up Care Manager"
        subtitle="Stay aligned with your doctor's instructions, submit requested laboratory tests, and keep your care journey unbroken."
      />

      {/* Action / Next Appointment Link */}
      <div className="card row between wrap gap-md" style={{ background: 'linear-gradient(135deg, var(--navy-900), var(--navy-800))', color: '#fff' }}>
        <div>
          <h3 style={{ color: '#fff' }}>Need to Schedule Your Next Visit?</h3>
          <p className="small" style={{ color: 'var(--teal-50)', margin: '4px 0 0' }}>
            Book an appointment with your doctor once you have completed your follow-up tasks and test reports.
          </p>
        </div>
        <Link to="/patient/appointments/book" className="btn btn-primary row center gap-xs">
          <CalendarPlus size={16} />
          <span>Book Next Consultation</span>
        </Link>
      </div>

      {/* Pending & Upcoming Follow-ups */}
      <section className="stack">
        <div className="row between wrap gap-sm">
          <h3>Active Care Tasks ({pendingOrUpcoming.length})</h3>
        </div>

        {pendingOrUpcoming.length > 0 ? (
          <div className="grid gap-md">
            {pendingOrUpcoming.map((task) => {
              const isOverdue = task.status === 'OVERDUE';
              const hasReportRequested = !!(task.requestedReportType || task.requestedReportDescription);
              const isReportUploaded = !!task.uploadedReportId;

              return (
                <div
                  key={task._id}
                  className="card stack-sm"
                  style={{
                    borderLeft: `5px solid ${isOverdue ? 'var(--red-600)' : 'var(--teal-500)'}`,
                  }}
                >
                  <div className="row between wrap gap-sm">
                    <div>
                      <div className="row gap-xs">
                        <strong style={{ fontSize: '1.05rem' }}>{task.title}</strong>
                        {isOverdue ? (
                          <span className="badge badge-danger row gap-xs">
                            <AlertTriangle size={12} /> OVERDUE
                          </span>
                        ) : (
                          <span className="badge badge-teal row gap-xs">
                            <Clock size={12} /> {task.status}
                          </span>
                        )}
                      </div>
                      <div className="muted small mt-xs">
                        Due Date: <strong>{formatDate(task.dueDate)}</strong>
                      </div>
                    </div>

                    <div className="row gap-xs">
                      {hasReportRequested && !isReportUploaded && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary row gap-xs"
                          onClick={() => setActiveUploadId(activeUploadId === task._id ? null : task._id)}
                        >
                          <Upload size={14} />
                          <span>{activeUploadId === task._id ? 'Cancel' : 'Upload Requested Report'}</span>
                        </button>
                      )}
                      {isReportUploaded && (
                        <span className="badge badge-success row gap-xs">
                          <CheckCircle2 size={12} /> Report Submitted
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Doctor's instructions */}
                  <div className="p-sm card" style={{ background: 'var(--gray-50)', marginTop: '8px' }}>
                    <div className="small muted">Doctor's Clinical Instructions:</div>
                    <p className="small mt-xs" style={{ whiteSpace: 'pre-line' }}>
                      {task.instructions || 'Follow prescribed routine and monitor for recurring symptoms.'}
                    </p>
                  </div>

                  {/* Requested report details */}
                  {hasReportRequested && (
                    <div className="row gap-xs small" style={{ color: 'var(--navy-800)', marginTop: '4px' }}>
                      <FileText size={14} color="var(--teal-600)" />
                      <span>
                        <strong>Requested Test:</strong> {task.requestedReportDescription || task.requestedReportType}
                      </span>
                    </div>
                  )}

                  {/* Inline Upload Form */}
                  {activeUploadId === task._id && (
                    <div className="card p-sm stack-sm mt-sm" style={{ border: '1px solid var(--teal-500)' }}>
                      <strong>Upload Report for "{task.title}"</strong>
                      <input
                        type="file"
                        className="input"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      />
                      <textarea
                        className="input"
                        rows={2}
                        placeholder="Add test values or notes (e.g. Fasting Blood Sugar: 104 mg/dL)..."
                        value={uploadDesc}
                        onChange={(e) => setUploadDesc(e.target.value)}
                      />
                      <div className="row gap-xs">
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          disabled={uploading || !uploadFile}
                          onClick={() => handleUploadReport(task._id)}
                        >
                          {uploading ? 'Uploading…' : 'Submit Report to Doctor'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => setActiveUploadId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card">
            <EmptyState
              icon={CalendarCheck}
              title="All Caught Up!"
              message="You have no pending follow-up checkpoints. Great job keeping your care routine up to date."
            />
          </div>
        )}
      </section>

      {/* Completed Follow-ups */}
      {completed.length > 0 && (
        <section className="stack">
          <h3>Completed Care Milestones ({completed.length})</h3>
          <div className="grid gap-sm">
            {completed.map((task) => (
              <div key={task._id} className="card p-sm row between wrap gap-sm">
                <div>
                  <div className="row gap-xs">
                    <CheckCircle2 size={16} color="var(--green-600)" />
                    <strong>{task.title}</strong>
                    <span className="badge badge-success">Completed</span>
                  </div>
                  <div className="muted small mt-xs">
                    Completed on {formatDate(task.completedAt || task.updatedAt)}
                  </div>
                  {task.completionNotes && (
                    <div className="small mt-xs">
                      <em>Doctor Notes: {task.completionNotes}</em>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
