import { useState, useEffect } from 'react';
import {
  Share2, PlusCircle, CheckCircle2, Clock, AlertTriangle,
  UserCheck, ShieldCheck, Stethoscope, User
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import { getMyPatients, listDoctors } from '../../services/doctorService';
import { getDoctorReferrals, createReferral, updateReferralStatus } from '../../services/continuityService';
import { useToast } from '../../context/AppContext';
import { formatDate } from '../../utils/format';

export default function DoctorReferralsPage() {
  const toast = useToast();
  const [referrals, setReferrals] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctorList, setDoctorList] = useState([]);
  const [loading, setLoading] = useState(true);

  // New referral modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [referredDoctorId, setReferredDoctorId] = useState('');
  const [reason, setReason] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [priority, setPriority] = useState('ROUTINE');
  const [submitting, setSubmitting] = useState(false);

  // Receiving doctor observation modal
  const [activeReferral, setActiveReferral] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [receivingNotes, setReceivingNotes] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [refs, pList, docRes] = await Promise.all([
        getDoctorReferrals(),
        getMyPatients(),
        listDoctors({ limit: 50 }),
      ]);
      setReferrals(refs || []);
      setPatients(pList || []);
      setDoctorList(docRes?.items || []);
      if (pList?.length > 0 && !selectedPatientId) {
        setSelectedPatientId(pList[0]._id);
      }
    } catch (err) {
      toast.error('Failed to load referrals and directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!selectedPatientId || !reason.trim()) {
      toast.error('Please specify patient and clinical reason for referral.');
      return;
    }

    try {
      setSubmitting(true);
      await createReferral({
        patientId: selectedPatientId,
        referredDoctorId: referredDoctorId || null,
        reason: reason.trim(),
        clinicalNotes: clinicalNotes.trim(),
        priority,
      });
      toast.success('Referral initiated! Patient has been notified to authorize consent.');
      setShowCreateModal(false);
      setReason('');
      setClinicalNotes('');
      setPriority('ROUTINE');
      await loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create referral');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!activeReferral) return;
    try {
      setUpdatingStatus(true);
      await updateReferralStatus(activeReferral._id, {
        status: newStatus || activeReferral.status,
        receivingDoctorNotes: receivingNotes,
      });
      toast.success('Referral status and observations updated!');
      setActiveReferral(null);
      setReceivingNotes('');
      await loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update referral');
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading && referrals.length === 0) {
    return <LoadingSpinner label="Loading referral network & collaboration hub…" />;
  }

  return (
    <div className="stack-lg">
      <PageHeader
        title="Multi-Doctor Referrals & Collaboration"
        subtitle="Coordinate multidisciplinary patient care, manage cross-specialty consults, and adhere to patient consent controls."
        action={
          <button
            type="button"
            className="btn btn-primary row center gap-xs"
            onClick={() => setShowCreateModal(true)}
          >
            <PlusCircle size={16} /> <span>Create New Referral</span>
          </button>
        }
      />

      <div className="card row gap-sm" style={{ background: 'var(--teal-50)', border: '1px solid var(--teal-500)' }}>
        <ShieldCheck size={22} color="var(--teal-600)" />
        <div className="small">
          <strong>Continuity Protocol:</strong> Secondary specialists receive access to shared patient records only after the patient explicitly authorizes consent. All transitions are logged for audit compliance.
        </div>
      </div>

      {/* Referrals List */}
      <section className="stack">
        <h3>Referral Cases ({referrals.length})</h3>

        {referrals.length > 0 ? (
          <div className="grid gap-md">
            {referrals.map((ref) => {
              const consentGranted = ref.patientConsent?.granted;
              const patientName = ref.patientId?.userId?.name || 'Patient';
              const referringDocName = ref.referringDoctorId?.userId?.name || 'Referring Doctor';
              const receivingDocName = ref.referredDoctorId?.userId?.name || ref.referredDepartmentId?.name || 'Specialist';

              return (
                <div
                  key={ref._id}
                  className="card stack-sm"
                  style={{
                    borderLeft: `5px solid ${consentGranted ? 'var(--teal-500)' : 'var(--amber-600)'}`,
                  }}
                >
                  <div className="row between wrap gap-sm">
                    <div>
                      <div className="row gap-xs">
                        <User size={16} color="var(--teal-600)" />
                        <strong style={{ fontSize: '1.05rem' }}>{patientName}</strong>
                        <span className="badge badge-teal">{ref.priority}</span>
                        <span className="badge badge-ghost">Status: {ref.status}</span>
                      </div>
                      <div className="muted small mt-xs">
                        Referred by <strong>Dr. {referringDocName}</strong> → Specialist: <strong>Dr. {receivingDocName}</strong> on {formatDate(ref.createdAt)}
                      </div>
                    </div>

                    <div className="row gap-xs wrap">
                      {consentGranted ? (
                        <span className="badge badge-success row gap-xs">
                          <CheckCircle2 size={12} /> Patient Consent Granted
                        </span>
                      ) : (
                        <span className="badge badge-warning row gap-xs">
                          <Clock size={12} /> Pending Patient Consent
                        </span>
                      )}

                      <button
                        type="button"
                        className="btn btn-sm btn-secondary row gap-xs"
                        onClick={() => {
                          setActiveReferral(ref);
                          setNewStatus(ref.status);
                          setReceivingNotes(ref.receivingDoctorNotes || '');
                        }}
                      >
                        <span>Update Status & Notes</span>
                      </button>
                    </div>
                  </div>

                  {/* Reason & Clinical Notes */}
                  <div className="card p-sm" style={{ background: 'var(--gray-50)' }}>
                    <strong>Clinical Reason for Referral:</strong>
                    <p className="small mt-xs">{ref.reason}</p>
                    {ref.clinicalNotes && (
                      <p className="small muted mt-xs">Referring Physician Notes: {ref.clinicalNotes}</p>
                    )}
                  </div>

                  {/* Receiving Doctor Notes */}
                  {ref.receivingDoctorNotes && (
                    <div className="card p-sm" style={{ background: 'rgba(230, 247, 245, 0.4)', border: '1px solid var(--teal-200, #99f6e4)' }}>
                      <strong>Receiving Specialist Clinical Response:</strong>
                      <p className="small mt-xs">{ref.receivingDoctorNotes}</p>
                    </div>
                  )}

                  {/* Inline Status & Note Update */}
                  {activeReferral?._id === ref._id && (
                    <div className="card p-sm stack-sm mt-sm" style={{ border: '1.5px solid var(--teal-500)' }}>
                      <strong>Update Referral Case (# {ref._id.slice(-6)})</strong>
                      <div className="grid grid-2 gap-sm">
                        <div>
                          <label className="field-label">Referral Status</label>
                          <select
                            className="select"
                            value={newStatus}
                            onChange={(e) => setNewStatus(e.target.value)}
                          >
                            <option value="PENDING">PENDING</option>
                            <option value="ACCEPTED">ACCEPTED</option>
                            <option value="IN_REVIEW">IN_REVIEW</option>
                            <option value="COMPLETED">COMPLETED</option>
                            <option value="CANCELLED">CANCELLED</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="field-label">Consulting Specialist Observations & Notes</label>
                        <textarea
                          className="input"
                          rows={3}
                          placeholder="Record clinical assessment, recommendations, or secondary review observations..."
                          value={receivingNotes}
                          onChange={(e) => setReceivingNotes(e.target.value)}
                        />
                      </div>

                      <div className="row gap-xs">
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          disabled={updatingStatus}
                          onClick={handleUpdateStatus}
                        >
                          {updatingStatus ? 'Saving…' : 'Save Referral Updates'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => setActiveReferral(null)}
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
              icon={Share2}
              title="No Referral Records"
              message="No cross-doctor referrals are currently active. Click 'Create New Referral' to collaborate on a patient case."
            />
          </div>
        )}
      </section>

      {/* Create Referral Modal */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-card stack">
            <div className="row between">
              <h3>Create Inter-Doctor Referral</h3>
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
                <label className="field-label" htmlFor="ref-patient">Patient</label>
                <select
                  id="ref-patient"
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
                <label className="field-label" htmlFor="ref-doc">Target Specialist / Colleague</label>
                <select
                  id="ref-doc"
                  className="select"
                  value={referredDoctorId}
                  onChange={(e) => setReferredDoctorId(e.target.value)}
                >
                  <option value="">-- Choose Colleague / Specialist --</option>
                  {doctorList.map((doc) => (
                    <option key={doc._id} value={doc._id}>
                      Dr. {doc.userId?.name} ({doc.specialization || 'Specialist'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-2 gap-sm">
                <div>
                  <label className="field-label" htmlFor="ref-prio">Priority</label>
                  <select
                    id="ref-prio"
                    className="select"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    <option value="ROUTINE">ROUTINE</option>
                    <option value="URGENT">URGENT</option>
                    <option value="EMERGENCY">EMERGENCY</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="field-label" htmlFor="ref-reason">Clinical Reason for Referral</label>
                <input
                  id="ref-reason"
                  type="text"
                  className="input"
                  placeholder="e.g., Cardiologist opinion on recurrent palpitations and borderline ECG"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="field-label" htmlFor="ref-notes">Clinical Notes & Findings</label>
                <textarea
                  id="ref-notes"
                  className="input"
                  rows={3}
                  placeholder="Provide background, existing medication, and questions for consulting physician..."
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                />
              </div>

              <div className="row gap-xs mt-sm">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Creating…' : 'Send Referral Request'}
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
