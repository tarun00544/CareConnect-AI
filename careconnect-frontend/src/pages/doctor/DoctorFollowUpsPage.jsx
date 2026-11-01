import { useState, useEffect } from 'react';
import {
  CalendarCheck, PlusCircle, CheckCircle2, Clock, AlertTriangle,
  RotateCcw, FileText, User
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import { getMyPatients } from '../../services/doctorService';
import {
  getDoctorFollowUps,
  createFollowUp,
  completeFollowUp,
  rescheduleFollowUp
} from '../../services/continuityService';
import { useToast } from '../../context/AppContext';
import { formatDate } from '../../utils/format';

export default function DoctorFollowUpsPage() {
  const toast = useToast();
  const [followUps, setFollowUps] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // New task form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [requestedReportType, setRequestedReportType] = useState('');
  const [requestedReportDesc, setRequestedReportDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Completion modal state
  const [completingTaskId, setCompletingTaskId] = useState(null);
  const [completionNotes, setCompletionNotes] = useState('');

  // Reschedule state
  const [reschedulingTaskId, setReschedulingTaskId] = useState(null);
  const [newDueDate, setNewDueDate] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [items, pList] = await Promise.all([
        getDoctorFollowUps(),
        getMyPatients(),
      ]);
      setFollowUps(items || []);
      setPatients(pList || []);
      if (pList?.length > 0 && !selectedPatientId) {
        setSelectedPatientId(pList[0]._id);
      }
    } catch (err) {
      toast.error('Failed to load follow-up manager data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!selectedPatientId || !title.trim() || !dueDate) {
      toast.error('Please specify patient, title, and due date.');
      return;
    }

    try {
      setSubmitting(true);
      await createFollowUp({
        patientId: selectedPatientId,
        title: title.trim(),
        instructions: instructions.trim(),
        dueDate,
        requestedReportType,
        requestedReportDescription: requestedReportDesc.trim(),
      });
      toast.success('Follow-up task created and patient notified!');
      setShowCreateModal(false);
      setTitle('');
      setInstructions('');
      setDueDate('');
      setRequestedReportType('');
      setRequestedReportDesc('');
      await loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create follow-up task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async (taskId) => {
    try {
      await completeFollowUp(taskId, completionNotes);
      toast.success('Follow-up marked completed!');
      setCompletingTaskId(null);
      setCompletionNotes('');
      await loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to complete task');
    }
  };

  const handleReschedule = async (taskId) => {
    if (!newDueDate) {
      toast.error('Please select a new due date');
      return;
    }
    try {
      await rescheduleFollowUp(taskId, { newDueDate });
      toast.success('Follow-up rescheduled successfully');
      setReschedulingTaskId(null);
      setNewDueDate('');
      await loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to reschedule');
    }
  };

  if (loading && followUps.length === 0) {
    return <LoadingSpinner label="Opening Follow-up Management Cockpit…" />;
  }

  const filteredTasks = followUps.filter((f) => {
    if (statusFilter === 'ALL') return true;
    return f.status === statusFilter;
  });

  const overdueCount = followUps.filter((f) => f.status === 'OVERDUE').length;

  return (
    <div className="stack-lg">
      <PageHeader
        title="Smart Follow-Up Manager"
        subtitle="Schedule post-consultation care checkpoints, request lab reports, and maintain uninterrupted continuity."
        action={
          <button
            type="button"
            className="btn btn-primary row center gap-xs"
            onClick={() => setShowCreateModal(true)}
          >
            <PlusCircle size={16} /> <span>Create Follow-up Task</span>
          </button>
        }
      />

      {/* Overdue alert banner if overdue tasks exist */}
      {overdueCount > 0 && (
        <div className="card row between wrap gap-sm" style={{ background: 'var(--red-50)', border: '1px solid var(--red-600)' }}>
          <div className="row gap-sm">
            <AlertTriangle size={20} color="var(--red-600)" />
            <div>
              <strong style={{ color: 'var(--red-600)' }}>
                {overdueCount} Overdue Follow-up Task(s) Requiring Attention
              </strong>
              <div className="small muted">Patients have passed scheduled follow-up due dates.</div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={{ color: 'var(--red-600)' }}
            onClick={() => setStatusFilter('OVERDUE')}
          >
            Filter Overdue Tasks
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <section className="card p-sm row between wrap gap-sm">
        <span className="small muted">Filter by Status:</span>
        <div className="row wrap gap-xs">
          {[
            { id: 'ALL', label: `All (${followUps.length})` },
            { id: 'UPCOMING', label: 'Upcoming' },
            { id: 'PENDING', label: 'Pending Review' },
            { id: 'OVERDUE', label: `Overdue (${overdueCount})` },
            { id: 'COMPLETED', label: 'Completed' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`btn btn-sm ${statusFilter === tab.id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setStatusFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* Follow-up Tasks Grid */}
      <section className="stack">
        {filteredTasks.length > 0 ? (
          <div className="grid gap-md">
            {filteredTasks.map((task) => {
              const isOverdue = task.status === 'OVERDUE';
              const isCompleted = task.status === 'COMPLETED';
              const patientName = task.patientId?.userId?.name || 'Patient';

              return (
                <div
                  key={task._id}
                  className="card stack-sm"
                  style={{
                    borderLeft: `5px solid ${
                      isCompleted ? 'var(--green-600)' : isOverdue ? 'var(--red-600)' : 'var(--teal-500)'
                    }`,
                  }}
                >
                  <div className="row between wrap gap-sm">
                    <div>
                      <div className="row gap-xs">
                        <User size={16} color="var(--teal-600)" />
                        <strong style={{ fontSize: '1.05rem' }}>{patientName}</strong>
                        <span className="muted small">· {task.title}</span>
                        <span
                          className={`badge ${
                            isCompleted ? 'badge-success' : isOverdue ? 'badge-danger' : 'badge-teal'
                          }`}
                        >
                          {task.status}
                        </span>
                      </div>
                      <div className="muted small mt-xs">
                        Due Date: <strong>{formatDate(task.dueDate)}</strong>
                      </div>
                    </div>

                    {!isCompleted && (
                      <div className="row gap-xs wrap">
                        <button
                          type="button"
                          className="btn btn-sm btn-primary row gap-xs"
                          onClick={() => setCompletingTaskId(task._id)}
                        >
                          <CheckCircle2 size={14} /> <span>Mark Completed</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost row gap-xs"
                          onClick={() => setReschedulingTaskId(task._id)}
                        >
                          <RotateCcw size={14} /> <span>Reschedule</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Instructions */}
                  <div className="card p-sm" style={{ background: 'var(--gray-50)' }}>
                    <div className="small muted">Doctor Instructions:</div>
                    <p className="small mt-xs">{task.instructions || 'Routine care monitoring.'}</p>
                  </div>

                  {/* Requested test and uploaded record status */}
                  {(task.requestedReportType || task.requestedReportDescription) && (
                    <div className="row between wrap gap-sm small mt-xs">
                      <div className="row gap-xs">
                        <FileText size={14} color="var(--teal-600)" />
                        <span>
                          <strong>Requested Test:</strong> {task.requestedReportDescription || task.requestedReportType}
                        </span>
                      </div>
                      <div>
                        {task.uploadedReportId ? (
                          <span className="badge badge-success row gap-xs">
                            <CheckCircle2 size={12} /> Patient Submitted Report:{' '}
                            <a
                              href={task.uploadedReportId.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{ textDecoration: 'underline' }}
                            >
                              {task.uploadedReportId.title}
                            </a>
                          </span>
                        ) : (
                          <span className="badge badge-warning">Awaiting Patient Report Upload</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Completion notes if completed */}
                  {isCompleted && task.completionNotes && (
                    <div className="small muted mt-xs">
                      <em>Clinical Review: {task.completionNotes}</em>
                    </div>
                  )}

                  {/* Inline Complete Box */}
                  {completingTaskId === task._id && (
                    <div className="card p-sm stack-sm mt-sm" style={{ border: '1px solid var(--teal-500)' }}>
                      <strong>Mark Follow-up as Completed</strong>
                      <textarea
                        className="input"
                        rows={2}
                        placeholder="Add optional completion notes or findings..."
                        value={completionNotes}
                        onChange={(e) => setCompletionNotes(e.target.value)}
                      />
                      <div className="row gap-xs">
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => handleComplete(task._id)}
                        >
                          Confirm Completion
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => setCompletingTaskId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline Reschedule Box */}
                  {reschedulingTaskId === task._id && (
                    <div className="card p-sm stack-sm mt-sm" style={{ border: '1px solid var(--teal-500)' }}>
                      <strong>Reschedule Follow-up Due Date</strong>
                      <input
                        type="date"
                        className="input"
                        value={newDueDate}
                        onChange={(e) => setNewDueDate(e.target.value)}
                      />
                      <div className="row gap-xs">
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => handleReschedule(task._id)}
                        >
                          Save New Date
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => setReschedulingTaskId(null)}
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
              title="No Follow-up Tasks Match Filter"
              message="Create a new task above to schedule patient follow-ups."
            />
          </div>
        )}
      </section>

      {/* Create Task Modal / Form Drawer */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-card stack">
            <div className="row between">
              <h3>Create Follow-Up Care Task</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>

            <form className="stack-sm" onSubmit={handleCreate}>
              <div>
                <label className="field-label" htmlFor="fu-patient">Select Patient</label>
                <select
                  id="fu-patient"
                  className="select"
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                >
                  {patients.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.userId?.name || 'Patient'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="field-label" htmlFor="fu-title">Task Title</label>
                <input
                  id="fu-title"
                  type="text"
                  className="input"
                  placeholder="e.g., Post-medication glucose evaluation"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="field-label" htmlFor="fu-date">Follow-up Due Date</label>
                <input
                  id="fu-date"
                  type="date"
                  className="input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="field-label" htmlFor="fu-inst">Clinical Instructions for Patient</label>
                <textarea
                  id="fu-inst"
                  className="input"
                  rows={3}
                  placeholder="e.g. Maintain fasting from 10 PM. Record blood pressure reading daily."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
              </div>

              <div className="grid grid-2 gap-sm">
                <div>
                  <label className="field-label" htmlFor="fu-rtype">Request Medical Report (Optional)</label>
                  <select
                    id="fu-rtype"
                    className="select"
                    value={requestedReportType}
                    onChange={(e) => setRequestedReportType(e.target.value)}
                  >
                    <option value="">None</option>
                    <option value="LAB_REPORT">Lab Blood / Urine Report</option>
                    <option value="IMAGING">Imaging (X-ray, Ultrasound)</option>
                    <option value="OTHER">Other Clinical Record</option>
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="fu-rdesc">Requested Test Name</label>
                  <input
                    id="fu-rdesc"
                    type="text"
                    className="input"
                    placeholder="e.g., Fasting Blood Sugar & Lipid Profile"
                    value={requestedReportDesc}
                    onChange={(e) => setRequestedReportDesc(e.target.value)}
                  />
                </div>
              </div>

              <div className="row gap-xs mt-sm">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Creating…' : 'Schedule Follow-Up Task'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
