import { useState, useEffect } from 'react';
import { Share2, CheckCircle2, ShieldCheck, Clock, UserCheck, AlertCircle } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import { getPatientReferrals, updatePatientConsent } from '../../services/continuityService';
import { useToast } from '../../context/AppContext';
import { formatDate } from '../../utils/format';

export default function ReferralsPage() {
  const toast = useToast();
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const items = await getPatientReferrals();
      setReferrals(items || []);
    } catch (err) {
      toast.error('Failed to load referrals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleConsent = async (referralId, granted) => {
    try {
      setActionInProgress(referralId);
      await updatePatientConsent(referralId, {
        granted,
        notes: granted ? 'Patient explicitly granted consent to share records with referred specialist.' : 'Patient declined record sharing.',
      });
      toast.success(granted ? 'Consent granted! Medical records securely shared with specialist.' : 'Referral request declined.');
      await loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update consent');
    } finally {
      setActionInProgress(null);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Loading referral consultations…" />;
  }

  return (
    <div className="stack-lg">
      <PageHeader
        title="Multi-Doctor Referrals & Collaboration"
        subtitle="Review doctor recommendations, control record sharing consent, and track multi-specialty care coordination."
      />

      <div className="card row gap-sm" style={{ background: 'var(--blue-50)', border: '1px solid var(--blue-600)' }}>
        <ShieldCheck size={24} color="var(--blue-600)" />
        <div className="small">
          <strong>Privacy & Security Guarantee:</strong> Your medical records are protected under end-to-end patient consent rules. No secondary specialist can inspect your confidential history without your explicit authorization.
        </div>
      </div>

      <section className="stack">
        <h3>Referral History & Active Consultations ({referrals.length})</h3>

        {referrals.length > 0 ? (
          <div className="grid gap-md">
            {referrals.map((ref) => {
              const consentGranted = ref.patientConsent?.granted;
              const isPendingConsent = !consentGranted && ref.status === 'PENDING';

              return (
                <div
                  key={ref._id}
                  className="card stack-sm"
                  style={{
                    borderLeft: `5px solid ${
                      consentGranted ? 'var(--teal-500)' : isPendingConsent ? 'var(--amber-600)' : 'var(--gray-300)'
                    }`,
                  }}
                >
                  <div className="row between wrap gap-sm">
                    <div>
                      <div className="row gap-xs">
                        <strong style={{ fontSize: '1.05rem' }}>
                          Referral to Dr. {ref.referredDoctorId?.userId?.name || ref.referredDepartmentId?.name || 'Specialist'}
                        </strong>
                        <span className="badge badge-teal">{ref.priority} PRIORITY</span>
                        <span className="badge badge-ghost">Status: {ref.status}</span>
                      </div>
                      <div className="muted small mt-xs">
                        Referred by Dr. {ref.referringDoctorId?.userId?.name || 'Attending Physician'} on {formatDate(ref.createdAt)}
                      </div>
                    </div>

                    <div>
                      {consentGranted ? (
                        <span className="badge badge-success row gap-xs">
                          <CheckCircle2 size={12} /> Consent Granted
                        </span>
                      ) : isPendingConsent ? (
                        <span className="badge badge-warning row gap-xs">
                          <Clock size={12} /> Action Required: Consent Needed
                        </span>
                      ) : (
                        <span className="badge badge-ghost">Consent Closed</span>
                      )}
                    </div>
                  </div>

                  {/* Reason for referral */}
                  <div className="card p-sm mt-xs" style={{ background: 'var(--gray-50)' }}>
                    <strong>Clinical Reason for Referral:</strong>
                    <p className="small mt-xs">{ref.reason}</p>
                    {ref.clinicalNotes && (
                      <p className="small muted mt-xs">Notes: {ref.clinicalNotes}</p>
                    )}
                  </div>

                  {/* Consent Action Box */}
                  {isPendingConsent && (
                    <div
                      className="card p-sm stack-sm mt-sm"
                      style={{ background: 'var(--amber-50)', border: '1px solid var(--amber-600)' }}
                    >
                      <div className="row gap-xs">
                        <AlertCircle size={16} color="var(--amber-600)" />
                        <strong>Authorization Request</strong>
                      </div>
                      <p className="small">
                        Dr. {ref.referringDoctorId?.userId?.name || 'Your Doctor'} recommends consulting Dr. {ref.referredDoctorId?.userId?.name || 'a specialist'}. Do you authorize sharing your medical records and lab reports with them?
                      </p>
                      <div className="row gap-xs">
                        <button
                          type="button"
                          className="btn btn-sm btn-primary row gap-xs"
                          disabled={actionInProgress === ref._id}
                          onClick={() => handleConsent(ref._id, true)}
                        >
                          <UserCheck size={14} />
                          <span>Authorize & Grant Consent</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          disabled={actionInProgress === ref._id}
                          onClick={() => handleConsent(ref._id, false)}
                        >
                          Decline Sharing
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Receiving doctor feedback */}
                  {ref.receivingDoctorNotes && (
                    <div className="card p-sm mt-xs" style={{ background: 'var(--teal-50)', border: '1px solid var(--teal-500)' }}>
                      <strong>Receiving Specialist Feedback:</strong>
                      <p className="small mt-xs">{ref.receivingDoctorNotes}</p>
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
              title="No Referrals on Record"
              message="When your doctor refers you to a specialist or multidisciplinary clinic, you will be able to review and authorize the referral here."
            />
          </div>
        )}
      </section>
    </div>
  );
}
