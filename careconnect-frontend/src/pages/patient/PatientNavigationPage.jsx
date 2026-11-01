import { useState, useEffect } from 'react';
import { Compass, CheckCircle2, Calendar, FileText, Pill, AlertTriangle, User, Stethoscope } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import { getPatientNavigation, getSharedSummaries } from '../../services/continuityService';
import { formatDate } from '../../utils/format';

export default function PatientNavigationPage() {
  const [data, setData] = useState(null);
  const [sharedSummaries, setSharedSummaries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [nav, summaries] = await Promise.all([
          getPatientNavigation(),
          getSharedSummaries(),
        ]);
        setData(nav);
        setSharedSummaries(summaries || []);
      } catch (err) {
        // error handling
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <LoadingSpinner label="Navigating your complete healthcare journey…" />;
  }

  const patient = data?.patient;
  const activeSummary = sharedSummaries[0] || data?.latestApprovedSummary;

  return (
    <div className="stack-lg">
      <PageHeader
        title="Patient Care Navigation"
        subtitle="Your personalized care roadmap, doctor-approved clinical summaries, and active continuity checkpoints."
      />

      {/* Continuity Stats Top Bar */}
      <div className="grid grid-stats">
        <div className="card text-center p-md">
          <div className="muted small">Total Consultations</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--navy-900)' }}>
            {data?.summaryStats?.totalAppointments || 0}
          </div>
        </div>
        <div className="card text-center p-md">
          <div className="muted small">Pending Follow-ups</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--teal-600)' }}>
            {data?.summaryStats?.pendingFollowUpsCount || 0}
          </div>
        </div>
        <div className="card text-center p-md">
          <div className="muted small">Medical Reports</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--blue-600)' }}>
            {data?.summaryStats?.totalReports || 0}
          </div>
        </div>
        <div className="card text-center p-md">
          <div className="muted small">Active Prescriptions</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--green-600)' }}>
            {data?.summaryStats?.totalPrescriptions || 0}
          </div>
        </div>
      </div>

      {/* Patient Health Passport Summary Card */}
      <section className="card stack">
        <div className="row between wrap gap-sm">
          <div className="row gap-xs">
            <User size={20} color="var(--teal-600)" />
            <h3>Patient Health Passport</h3>
          </div>
          <span className="badge badge-teal">Verified Digital ID</span>
        </div>

        <div className="grid grid-3 gap-md">
          <div>
            <div className="muted small">Full Name</div>
            <strong>{patient?.userId?.name || 'Patient'}</strong>
          </div>
          <div>
            <div className="muted small">Blood Group</div>
            <strong style={{ color: 'var(--red-600)' }}>{patient?.bloodGroup || 'Not specified'}</strong>
          </div>
          <div>
            <div className="muted small">Gender / Date of Birth</div>
            <strong>
              {patient?.gender || 'N/A'} · {patient?.dateOfBirth ? formatDate(patient.dateOfBirth) : 'N/A'}
            </strong>
          </div>
        </div>

        <div className="grid grid-2 gap-md" style={{ borderTop: '1px solid var(--gray-200)', paddingTop: '12px' }}>
          <div>
            <div className="muted small row gap-xs">
              <AlertTriangle size={14} color="var(--amber-600)" />
              <span>Known Drug Allergies</span>
            </div>
            <div>
              {patient?.allergies?.length ? (
                <div className="row wrap gap-xs mt-xs">
                  {patient.allergies.map((a, i) => (
                    <span key={i} className="badge badge-danger">{a}</span>
                  ))}
                </div>
              ) : (
                <span className="small text-success">No documented drug allergies.</span>
              )}
            </div>
          </div>

          <div>
            <div className="muted small row gap-xs">
              <Pill size={14} color="var(--teal-600)" />
              <span>Current Active Medications</span>
            </div>
            <div>
              {patient?.currentMedicines?.length ? (
                <div className="row wrap gap-xs mt-xs">
                  {patient.currentMedicines.map((m, i) => (
                    <span key={i} className="badge badge-info">{m}</span>
                  ))}
                </div>
              ) : (
                <span className="small muted">No active medications registered.</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Latest Doctor-Approved Journey Summary */}
      {activeSummary ? (
        <section
          className="card stack"
          style={{
            border: '2px solid var(--teal-500, #14b8a6)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div className="row between wrap gap-sm">
            <div className="row gap-xs">
              <Stethoscope size={22} color="var(--teal-600)" />
              <div>
                <h3 style={{ margin: 0 }}>Latest Doctor-Approved Journey Summary</h3>
                <span className="muted small">
                  Approved on {formatDate(activeSummary.approvedAt || activeSummary.updatedAt)}
                </span>
              </div>
            </div>
            <span className="badge badge-success row gap-xs">
              <CheckCircle2 size={14} /> Doctor Certified
            </span>
          </div>

          <div className="grid gap-md" style={{ marginTop: '8px' }}>
            <div className="card p-sm" style={{ background: 'var(--gray-50)' }}>
              <strong>1. Care Overview</strong>
              <p className="small mt-xs">{activeSummary.doctorDraft?.patientOverview || activeSummary.aiGenerated?.patientOverview}</p>
            </div>

            <div className="card p-sm" style={{ background: 'var(--gray-50)' }}>
              <strong>2. Previous Consultation & Clinical Insights</strong>
              <p className="small mt-xs">{activeSummary.doctorDraft?.previousConsultationSummary || activeSummary.aiGenerated?.previousConsultationSummary}</p>
            </div>

            <div className="card p-sm" style={{ background: 'var(--gray-50)' }}>
              <strong>3. Clinical Observations & Management Plan</strong>
              <p className="small mt-xs">
                {activeSummary.doctorDraft?.clinicalObservations || 'Adhere to prescribed medication plan and follow-up checkpoints.'}
              </p>
            </div>

            <div className="card p-sm" style={{ background: 'var(--gray-50)' }}>
              <strong>4. Report Evolution & Biomarker Status</strong>
              <p className="small mt-xs">
                {activeSummary.doctorDraft?.recentReportComparisonSummary || activeSummary.aiGenerated?.recentReportComparisonSummary || 'Report metrics reviewed.'}
              </p>
            </div>

            <div className="card p-sm" style={{ background: 'var(--gray-50)' }}>
              <strong>5. Pending Follow-up Action Items</strong>
              <p className="small mt-xs" style={{ whiteSpace: 'pre-line' }}>
                {activeSummary.doctorDraft?.pendingFollowUpTasks || activeSummary.aiGenerated?.pendingFollowUpTasks}
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="card">
          <EmptyState
            icon={Compass}
            title="No Approved Summary Yet"
            message="Your doctor will compile, approve, and share your personalized Continuity Summary during or after your upcoming consultation."
          />
        </section>
      )}

      {/* Past Consultations & Upcoming Appointments Roadmap */}
      <div className="grid grid-2 align-start">
        <section className="card stack">
          <div className="row gap-xs">
            <Calendar size={18} color="var(--teal-600)" />
            <h4>Upcoming Care Checkpoints</h4>
          </div>
          {data?.upcomingAppointments?.length ? (
            <div className="stack-sm">
              {data.upcomingAppointments.map((a) => (
                <div key={a._id} className="card p-sm row between">
                  <div>
                    <strong>{formatDate(a.date)}</strong> at {a.startTime}
                    <div className="small muted">Mode: {a.consultationType}</div>
                  </div>
                  <span className="badge badge-teal">{a.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">No upcoming consultations booked.</p>
          )}
        </section>

        <section className="card stack">
          <div className="row gap-xs">
            <FileText size={18} color="var(--blue-600)" />
            <h4>Recent Medical Reports</h4>
          </div>
          {data?.medicalRecords?.length ? (
            <div className="stack-sm">
              {data.medicalRecords.slice(0, 4).map((r) => (
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
            <p className="muted small">No medical reports uploaded yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
