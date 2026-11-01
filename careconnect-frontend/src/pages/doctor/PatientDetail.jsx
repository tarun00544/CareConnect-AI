import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  User, Calendar, FileText, GitCompare, Compass, Sparkles,
  ClipboardList, CalendarCheck, History, AlertTriangle, Pill, CheckCircle2, ArrowLeft
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import ComparisonChart from '../../components/medical/ComparisonChart';
import Timeline from '../../components/ui/Timeline';
import StatusBadge from '../../components/ui/StatusBadge';
import {
  getPatientNavigation,
  getPatientJourney,
  generateAISummary
} from '../../services/continuityService';
import { formatDate, formatDay } from '../../utils/format';
import { useToast } from '../../context/AppContext';

const TABS = [
  { id: 'OVERVIEW', label: 'Overview', icon: User },
  { id: 'HISTORY', label: 'Medical History', icon: FileText },
  { id: 'REPORTS', label: 'Reports', icon: FileText },
  { id: 'COMPARISONS', label: 'Comparisons', icon: GitCompare },
  { id: 'CONSULTATIONS', label: 'Consultations', icon: Calendar },
  { id: 'AISUMMARY', label: 'AI Summary', icon: Sparkles },
  { id: 'FOLLOWUPS', label: 'Follow-ups', icon: CalendarCheck },
  { id: 'PRESCRIPTIONS', label: 'Prescriptions', icon: ClipboardList },
  { id: 'TIMELINE', label: 'Timeline', icon: History },
];

export default function DoctorPatientDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('OVERVIEW');
  const [loading, setLoading] = useState(true);
  const [navData, setNavData] = useState(null);
  const [journeyEvents, setJourneyEvents] = useState([]);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [nav, jrn] = await Promise.all([
          getPatientNavigation(id),
          getPatientJourney(id),
        ]);
        setNavData(nav);
        setJourneyEvents(jrn || []);
      } catch (err) {
        toast.error('Failed to load patient dossier');
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  const handleGenerateSummary = async () => {
    try {
      setGeneratingSummary(true);
      const res = await generateAISummary({ patientId: id });
      toast.success('AI structured summary generated!');
      const updatedNav = await getPatientNavigation(id);
      setNavData(updatedNav);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to generate AI summary');
    } finally {
      setGeneratingSummary(false);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Opening comprehensive patient dossier…" />;
  }

  const patient = navData?.patient;
  if (!patient) {
    return (
      <EmptyState
        title="Patient Dossier Not Found"
        message="Could not retrieve the records for this patient."
        action={<Link to="/doctor/patients" className="btn btn-primary">Back to My Patients</Link>}
      />
    );
  }

  const summary = navData?.latestApprovedSummary;

  return (
    <div className="stack-lg">
      <div className="row between wrap gap-sm">
        <Link to="/doctor/patients" className="btn btn-sm btn-ghost row gap-xs">
          <ArrowLeft size={16} /> <span>Back to Patients Directory</span>
        </Link>
        <span className="badge badge-teal">CareConnect Patient Dossier</span>
      </div>

      <PageHeader
        title={patient.userId?.name || 'Patient Profile'}
        subtitle={`Gender: ${patient.gender || 'N/A'} · Blood Group: ${patient.bloodGroup || 'Unknown'} · Phone: ${patient.userId?.phone || 'N/A'}`}
      />

      {/* Navigation Tabs Bar */}
      <section className="card p-sm" style={{ overflowX: 'auto' }}>
        <div className="row gap-xs" style={{ minWidth: 'max-content' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`btn btn-sm ${activeTab === t.id ? 'btn-primary' : 'btn-ghost'} row gap-xs`}
              onClick={() => setActiveTab(t.id)}
            >
              <t.icon size={15} /> <span>{t.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Tab 1: OVERVIEW */}
      {activeTab === 'OVERVIEW' && (
        <div className="stack">
          <div className="grid grid-stats">
            <div className="card text-center p-sm">
              <div className="muted small">Consultations</div>
              <strong>{navData?.summaryStats?.totalAppointments || 0}</strong>
            </div>
            <div className="card text-center p-sm">
              <div className="muted small">Pending Follow-ups</div>
              <strong style={{ color: 'var(--teal-600)' }}>{navData?.summaryStats?.pendingFollowUpsCount || 0}</strong>
            </div>
            <div className="card text-center p-sm">
              <div className="muted small">Medical Reports</div>
              <strong style={{ color: 'var(--blue-600)' }}>{navData?.summaryStats?.totalReports || 0}</strong>
            </div>
            <div className="card text-center p-sm">
              <div className="muted small">Report Comparisons</div>
              <strong>{navData?.summaryStats?.totalComparisons || 0}</strong>
            </div>
          </div>

          <section className="card stack">
            <h3>Patient Demographic & Vitals Profile</h3>
            <div className="grid grid-3 gap-md">
              <div>
                <span className="muted small">Date of Birth</span>
                <div>{patient.dateOfBirth ? formatDate(patient.dateOfBirth) : 'Not specified'}</div>
              </div>
              <div>
                <span className="muted small">Blood Group</span>
                <strong style={{ color: 'var(--red-600)' }}>{patient.bloodGroup || 'Unknown'}</strong>
              </div>
              <div>
                <span className="muted small">Emergency Contact</span>
                <div>{patient.emergencyContact?.name || 'None'} ({patient.emergencyContact?.relation || ''}) - {patient.emergencyContact?.phone || ''}</div>
              </div>
            </div>

            <div className="grid grid-2 gap-md mt-sm" style={{ borderTop: '1px solid var(--gray-200)', paddingTop: '12px' }}>
              <div>
                <span className="muted small row gap-xs">
                  <AlertTriangle size={14} color="var(--red-600)" /> <strong>Allergies:</strong>
                </span>
                <div className="mt-xs">
                  {patient.allergies?.length ? (
                    <div className="row wrap gap-xs">
                      {patient.allergies.map((a, i) => <span key={i} className="badge badge-danger">{a}</span>)}
                    </div>
                  ) : (
                    <span className="small text-success">No documented drug allergies.</span>
                  )}
                </div>
              </div>

              <div>
                <span className="muted small row gap-xs">
                  <Pill size={14} color="var(--teal-600)" /> <strong>Current Medications:</strong>
                </span>
                <div className="mt-xs">
                  {patient.currentMedicines?.length ? (
                    <div className="row wrap gap-xs">
                      {patient.currentMedicines.map((m, i) => <span key={i} className="badge badge-info">{m}</span>)}
                    </div>
                  ) : (
                    <span className="small muted">None recorded.</span>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Tab 2: MEDICAL HISTORY */}
      {activeTab === 'HISTORY' && (
        <section className="card stack">
          <h3>Patient-Reported & Documented Medical History</h3>
          {patient.medicalHistory?.length ? (
            <ul className="small" style={{ listStyle: 'disc', paddingLeft: '20px', lineHeight: 1.8 }}>
              {patient.medicalHistory.map((h, i) => <li key={i}>{h}</li>)}
            </ul>
          ) : (
            <p className="small muted">No pre-existing chronic conditions documented.</p>
          )}
        </section>
      )}

      {/* Tab 3: REPORTS */}
      {activeTab === 'REPORTS' && (
        <section className="stack">
          <h3>Uploaded Medical Reports ({navData?.medicalRecords?.length || 0})</h3>
          {navData?.medicalRecords?.length ? (
            <div className="grid gap-sm">
              {navData.medicalRecords.map((r) => (
                <div key={r._id} className="card p-sm row between wrap gap-sm">
                  <div>
                    <strong>{r.title}</strong>
                    <div className="small muted">{formatDate(r.createdAt)} · {r.type}</div>
                    {r.description && <div className="small mt-xs">{r.description}</div>}
                  </div>
                  {r.fileUrl && (
                    <a href={r.fileUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost">
                      Open File
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={FileText} title="No Reports" message="No laboratory or imaging reports on record." />
          )}
        </section>
      )}

      {/* Tab 4: COMPARISONS */}
      {activeTab === 'COMPARISONS' && (
        <section className="stack">
          <h3>Report Evolution Comparisons ({navData?.reportComparisons?.length || 0})</h3>
          {navData?.reportComparisons?.length ? (
            <div className="grid gap-md">
              {navData.reportComparisons.map((c) => (
                <div key={c._id} className="card stack-sm">
                  <div className="row between wrap gap-sm">
                    <strong>Report Evolution Tracking #{c._id.slice(-6)}</strong>
                    <span className="small muted">{formatDate(c.createdAt)}</span>
                  </div>
                  <ComparisonChart parameters={c.parameters || []} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={GitCompare} title="No Comparisons" message="No comparative report tracking records on file." />
          )}
        </section>
      )}

      {/* Tab 5: CONSULTATIONS */}
      {activeTab === 'CONSULTATIONS' && (
        <section className="stack">
          <h3>Consultation History ({navData?.pastAppointments?.length || 0})</h3>
          {navData?.pastAppointments?.length ? (
            <div className="grid gap-sm">
              {navData.pastAppointments.map((a) => (
                <div key={a._id} className="card p-sm row between wrap gap-sm">
                  <div>
                    <strong>{formatDate(a.date)}</strong> at {a.startTime} ({a.consultationType})
                    <div className="small muted mt-xs">Notes: {a.notes || 'Routine consultation'}</div>
                  </div>
                  <span className="badge badge-teal">{a.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Calendar} title="No Consultations" message="No previous consultations found." />
          )}
        </section>
      )}

      {/* Tab 6: AI SUMMARY */}
      {activeTab === 'AISUMMARY' && (
        <section className="card stack">
          <div className="row between wrap gap-sm">
            <div className="row gap-xs">
              <Sparkles size={20} color="var(--teal-600)" />
              <h3>Doctor-Approved Clinical Summary</h3>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-primary row gap-xs"
              disabled={generatingSummary}
              onClick={handleGenerateSummary}
            >
              <Sparkles size={14} /> <span>{generatingSummary ? 'Synthesizing…' : 'Generate / Refresh Summary'}</span>
            </button>
          </div>

          {summary ? (
            <div className="grid gap-sm mt-xs">
              <div className="card p-sm" style={{ background: 'var(--gray-50)' }}>
                <strong>Overview</strong>
                <p className="small mt-xs">{summary.doctorDraft?.patientOverview || summary.aiGenerated?.patientOverview}</p>
              </div>
              <div className="card p-sm" style={{ background: 'var(--gray-50)' }}>
                <strong>Previous Consultations</strong>
                <p className="small mt-xs">{summary.doctorDraft?.previousConsultationSummary || summary.aiGenerated?.previousConsultationSummary}</p>
              </div>
              <div className="card p-sm" style={{ background: 'var(--gray-50)' }}>
                <strong>Clinical Observations & Plan</strong>
                <p className="small mt-xs">{summary.doctorDraft?.clinicalObservations || 'Adhere to management plan.'}</p>
              </div>
            </div>
          ) : (
            <EmptyState icon={Sparkles} title="No Summary Generated" message="Click 'Generate / Refresh Summary' above to create one." />
          )}
        </section>
      )}

      {/* Tab 7: FOLLOW-UPS */}
      {activeTab === 'FOLLOWUPS' && (
        <section className="stack">
          <h3>Scheduled Follow-ups ({navData?.followUps?.length || 0})</h3>
          {navData?.followUps?.length ? (
            <div className="grid gap-sm">
              {navData.followUps.map((f) => (
                <div key={f._id} className="card p-sm row between wrap gap-sm">
                  <div>
                    <strong>{f.title}</strong>
                    <div className="small muted">Due: {formatDate(f.dueDate)}</div>
                    <p className="small mt-xs">{f.instructions}</p>
                  </div>
                  <span className={`badge ${f.status === 'COMPLETED' ? 'badge-success' : f.status === 'OVERDUE' ? 'badge-danger' : 'badge-teal'}`}>
                    {f.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={CalendarCheck} title="No Follow-ups" message="No follow-up checkpoints scheduled." />
          )}
        </section>
      )}

      {/* Tab 8: PRESCRIPTIONS */}
      {activeTab === 'PRESCRIPTIONS' && (
        <section className="stack">
          <h3>Issued Prescriptions ({navData?.prescriptions?.length || 0})</h3>
          {navData?.prescriptions?.length ? (
            <div className="grid gap-sm">
              {navData.prescriptions.map((p) => (
                <div key={p._id} className="card p-sm row between wrap gap-sm">
                  <div>
                    <strong>Prescription — {formatDate(p.createdAt)}</strong>
                    <div className="small muted">{p.medicines?.length || 0} medications prescribed.</div>
                    {p.instructions && <div className="small mt-xs">Instructions: {p.instructions}</div>}
                  </div>
                  <Link to={`/doctor/prescriptions/${p._id}`} className="btn btn-sm btn-ghost">
                    View Rx Details
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={ClipboardList} title="No Prescriptions" message="No prescriptions issued on record." />
          )}
        </section>
      )}

      {/* Tab 9: TIMELINE */}
      {activeTab === 'TIMELINE' && (
        <section className="card stack">
          <h3>Patient Health Journey Timeline</h3>
          {journeyEvents.length ? (
            <Timeline
              items={journeyEvents.map((ev) => ({
                id: ev.id,
                title: ev.title,
                description: ev.description,
                date: formatDate(ev.timestamp),
                tone: ev.badgeTone || 'teal',
                to: ev.link,
                badge: ev.status ? <StatusBadge status={ev.status} size="sm" /> : null,
              }))}
            />
          ) : (
            <EmptyState icon={History} title="Timeline Empty" message="No journey events recorded." />
          )}
        </section>
      )}
    </div>
  );
}
