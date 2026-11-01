import { Link } from 'react-router-dom';
import {
  CalendarDays, ClipboardList, Sparkles, Stethoscope, GitCompare,
  CalendarCheck, FlaskConical, History, Compass, CheckCircle2, AlertTriangle, ArrowRight, Clock, Bell
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import { useAsync } from '../../hooks/useAsync';
import { useDoctorDirectory } from '../../hooks/useDoctorDirectory';
import { getMyAppointments, getMyPrescriptions, getMyRecords } from '../../services/patientService';
import { getMyFollowUps, getSharedSummaries, getPatientJourney } from '../../services/continuityService';
import { APPOINTMENT_ACTIVE } from '../../constants';
import { appointmentStart, formatDate, formatTimeRange } from '../../utils/format';

const CONTINUITY_ACTIONS = [
  { to: '/patient/reminders', label: 'Medicine Reminders', icon: Clock, color: 'var(--teal-600)' },
  { to: '/patient/report-comparison', label: 'Report Comparison', icon: GitCompare, color: 'var(--teal-600)' },
  { to: '/patient/follow-ups', label: 'Follow-up Tasks', icon: CalendarCheck, color: 'var(--navy-700)' },
  { to: '/patient/timeline', label: 'Care Journey', icon: History, color: 'var(--blue-600)' },
  { to: '/patient/navigation', label: 'Patient Navigation', icon: Compass, color: 'var(--teal-600)' },
  { to: '/patient/ai', label: 'AI Assistant', icon: Sparkles, color: 'var(--navy-900)' },
  { to: '/patient/appointments/book', label: 'Book Appointment', icon: CalendarDays, color: 'var(--blue-600)' },
];

async function loadDashboardData() {
  const [appts, rx, records, followUps, summaries, journey] = await Promise.allSettled([
    getMyAppointments({ limit: 10 }),
    getMyPrescriptions(),
    getMyRecords(),
    getMyFollowUps(),
    getSharedSummaries(),
    getPatientJourney(),
  ]);

  const val = (r, fallback) => (r.status === 'fulfilled' ? r.value : fallback);
  return {
    appts: val(appts, { items: [] }),
    prescriptions: val(rx, []),
    records: val(records, []),
    followUps: val(followUps, []),
    summaries: val(summaries, []),
    journey: val(journey, []),
  };
}

export default function PatientDashboard() {
  const { user } = useAuth();
  const { totalUnreadMessages } = useNotifications();
  const { data, loading, reload } = useAsync(loadDashboardData, []);
  const { doctorName } = useDoctorDirectory();

  const appts = data?.appts?.items || [];
  const rx = data?.prescriptions || [];
  const records = data?.records || [];
  const followUps = data?.followUps || [];
  const summaries = data?.summaries || [];
  const journey = data?.journey || [];

  const now = new Date();
  const upcoming = appts
    .filter((a) => APPOINTMENT_ACTIVE.includes(a.status) && appointmentStart(a) && appointmentStart(a) >= new Date(now.getTime() - 60 * 60 * 1000))
    .sort((a, b) => appointmentStart(a) - appointmentStart(b));
  const nextAppt = upcoming[0];

  const pendingFollowUps = followUps.filter((f) => f.status === 'UPCOMING' || f.status === 'PENDING' || f.status === 'OVERDUE');
  const requestedReports = followUps.filter((f) => (f.requestedReportType || f.requestedReportDescription) && !f.uploadedReportId);
  const latestSummary = summaries[0];

  return (
    <div className="stack-lg">
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0] || 'there'}`}
        subtitle="CareConnect Continuity Engine — One Platform. Complete Healthcare Journey."
      />

      {/* Hero Continuity Banner */}
      <div
        className="card row between wrap gap-md"
        style={{
          background: 'linear-gradient(135deg, var(--navy-900), #10335e)',
          color: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          padding: '24px 28px',
        }}
      >
        <div style={{ maxWidth: '640px' }}>
          <div className="row gap-xs" style={{ marginBottom: '6px' }}>
            <span className="badge badge-teal" style={{ background: 'rgba(20, 184, 166, 0.2)', color: '#5eead4' }}>
              Active Care Continuity
            </span>
          </div>
          <h2 style={{ color: '#fff', fontSize: '1.45rem', marginBottom: '8px' }}>
            Your Complete Healthcare Journey is in Sync
          </h2>
          <p className="small" style={{ color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>
            Medical reports, previous consultations, and follow-ups are interconnected with your care team. No gaps between appointments.
          </p>
        </div>

        <div className="row gap-sm wrap">
          <Link to="/patient/report-comparison" className="btn btn-primary row center gap-xs">
            <GitCompare size={16} />
            <span>Compare Reports</span>
          </Link>
          <Link to="/patient/navigation" className="btn btn-secondary row center gap-xs" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
            <Compass size={16} />
            <span>Care Navigation</span>
          </Link>
        </div>
      </div>

      {/* Requested Reports Urgent Alert Widget */}
      {requestedReports.length > 0 && (
        <div
          className="card row between wrap gap-sm"
          style={{
            background: 'var(--amber-50)',
            border: '1.5px solid var(--amber-600)',
          }}
        >
          <div className="row gap-sm">
            <AlertTriangle size={22} color="var(--amber-600)" />
            <div>
              <strong style={{ color: 'var(--amber-600)' }}>
                {requestedReports.length} Medical Report(s) Requested by Your Doctor
              </strong>
              <div className="small muted">
                Action required: Please upload the required laboratory test before your next follow-up.
              </div>
            </div>
          </div>
          <Link to="/patient/follow-ups" className="btn btn-sm btn-primary">
            Upload Requested Reports
          </Link>
        </div>
      )}

      {/* Dashboard Key Stat Cards */}
      <div className="grid grid-stats">
        <StatCard
          label="Upcoming Appointments"
          value={upcoming.length}
          icon={CalendarDays}
          loading={loading}
          hint={nextAppt ? `Next: ${formatDate(nextAppt.date)}` : 'None scheduled'}
        />
        <StatCard
          label="Pending Follow-ups"
          value={pendingFollowUps.length}
          icon={CalendarCheck}
          tone="teal"
          loading={loading}
          hint={requestedReports.length > 0 ? `${requestedReports.length} reports needed` : 'All on track'}
        />
        <StatCard
          label="Medical Reports"
          value={records.length}
          icon={FlaskConical}
          tone="blue"
          loading={loading}
          hint="Laboratory & imaging"
        />
        <StatCard
          label="Active Prescriptions"
          value={rx.length}
          icon={ClipboardList}
          loading={loading}
        />
      </div>

      {/* Quick Action Navigation Grid */}
      <section aria-label="Care Engine Actions">
        <h3 className="section-title">Continuity Quick Actions</h3>
        <div className="grid grid-cards">
          {CONTINUITY_ACTIONS.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="card p-md row gap-sm align-center"
              style={{
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                textDecoration: 'none',
              }}
            >
              <div
                style={{
                  background: 'var(--gray-100)',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  color: a.color,
                }}
              >
                <a.icon size={22} />
              </div>
              <div>
                <strong style={{ color: 'var(--navy-900)' }}>{a.label}</strong>
                <div className="muted small">Access module →</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Widgets Grid: Upcoming Appointment & Pending Follow-ups */}
      <div className="grid grid-2 align-start">
        {/* Widget 1: Upcoming Appointment */}
        <section className="card stack-sm">
          <div className="row between">
            <h3 className="section-title">Upcoming Appointment</h3>
            <Link to="/patient/appointments" className="small">View all</Link>
          </div>
          {nextAppt ? (
            <div className="card p-sm stack-sm" style={{ background: 'var(--gray-50)' }}>
              <div className="row between wrap gap-sm">
                <div>
                  <strong>{doctorName(nextAppt.doctorId)}</strong>
                  {(nextAppt.departmentId?.name || nextAppt.doctorId?.departmentId?.name || nextAppt.doctorId?.specialization) && (
                    <div className="muted small">
                      {nextAppt.departmentId?.name || nextAppt.doctorId?.departmentId?.name}
                      {(nextAppt.departmentId?.name || nextAppt.doctorId?.departmentId?.name) && nextAppt.doctorId?.specialization ? ' · ' : ''}
                      {nextAppt.doctorId?.specialization || ''}
                    </div>
                  )}
                </div>
                <StatusBadge status={nextAppt.status} size="sm" />
              </div>
              <div className="muted small">
                {formatDate(nextAppt.date)} · {formatTimeRange(nextAppt.startTime, nextAppt.endTime)} ({nextAppt.consultationType})
              </div>
              <div className="row gap-sm wrap mt-xs">
                <Link className="btn btn-primary btn-sm" to={`/patient/appointments/${nextAppt._id}`}>
                  View Details & Preparation
                </Link>
              </div>
            </div>
          ) : (
            <EmptyState
              compact
              icon={CalendarDays}
              title="No Upcoming Consultations"
              action={<Link to="/patient/appointments/book" className="btn btn-primary btn-sm">Book Consultation</Link>}
            />
          )}
        </section>

        {/* Widget 2: Pending Follow-ups */}
        <section className="card stack-sm">
          <div className="row between">
            <h3 className="section-title">Pending Follow-ups</h3>
            <Link to="/patient/follow-ups" className="small">View manager</Link>
          </div>
          {pendingFollowUps.length > 0 ? (
            <div className="stack-xs">
              {pendingFollowUps.slice(0, 3).map((f) => (
                <div key={f._id} className="card p-sm row between align-center">
                  <div>
                    <strong className="small">{f.title}</strong>
                    <div className="muted small">Due: {formatDate(f.dueDate)}</div>
                  </div>
                  <span className={`badge ${f.status === 'OVERDUE' ? 'badge-danger' : 'badge-teal'}`}>
                    {f.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              compact
              icon={CalendarCheck}
              title="All Follow-ups Completed"
              message="No outstanding tasks or requested reports."
            />
          )}
        </section>
      </div>

      {/* Widget 3: Latest Doctor-Approved Summary */}
      {latestSummary && (
        <section
          className="card stack-sm"
          style={{
            borderLeft: '5px solid var(--teal-500)',
            background: 'var(--off-white)',
          }}
        >
          <div className="row between wrap gap-sm">
            <div className="row gap-xs">
              <CheckCircle2 size={18} color="var(--teal-600)" />
              <h4>Latest Doctor-Approved Journey Summary</h4>
            </div>
            <Link to="/patient/navigation" className="small row gap-xs">
              <span>View full summary</span> <ArrowRight size={14} />
            </Link>
          </div>
          <p className="small" style={{ margin: '4px 0', lineHeight: 1.5 }}>
            {latestSummary.doctorDraft?.clinicalObservations || latestSummary.doctorDraft?.patientOverview || 'Your continuity roadmap has been certified.'}
          </p>
          <div className="muted small">
            Approved on {formatDate(latestSummary.approvedAt || latestSummary.updatedAt)}
          </div>
        </section>
      )}

      {/* Widget 4: Recent Medical Reports & Prescriptions */}
      <div className="grid grid-2 align-start">
        {/* Recent Medical Reports */}
        <section className="card stack-sm">
          <div className="row between">
            <h3 className="section-title">Recent Medical Reports</h3>
            <Link to="/patient/report-comparison" className="small">Compare reports</Link>
          </div>
          {records.length > 0 ? (
            <div className="stack-xs">
              {records.slice(0, 3).map((r) => (
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
            <EmptyState compact icon={FlaskConical} title="No Reports Uploaded" />
          )}
        </section>

        {/* Recent Prescriptions */}
        <section className="card stack-sm">
          <div className="row between">
            <h3 className="section-title">Recent Prescriptions</h3>
            <Link to="/patient/prescriptions" className="small">All prescriptions</Link>
          </div>
          {rx.length > 0 ? (
            <div className="stack-xs">
              {rx.slice(0, 3).map((p) => (
                <div key={p._id} className="card p-sm row between">
                  <div>
                    <strong>Prescription ({p.medicines?.length || 0} meds)</strong>
                    <div className="small muted">{formatDate(p.createdAt)}</div>
                  </div>
                  <Link to={`/patient/prescriptions/${p._id}`} className="btn btn-sm btn-ghost">
                    Details
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState compact icon={ClipboardList} title="No Active Prescriptions" />
          )}
        </section>
      </div>

      {/* Widget 5: Health Journey Timeline Snippet */}
      {journey.length > 0 && (
        <section className="card stack-sm">
          <div className="row between">
            <h3 className="section-title">Care Timeline Activity</h3>
            <Link to="/patient/timeline" className="small">Open full timeline</Link>
          </div>
          <div className="grid gap-xs">
            {journey.slice(0, 4).map((ev) => (
              <div key={ev.id} className="card p-sm row between wrap gap-sm" style={{ background: 'var(--gray-50)' }}>
                <div>
                  <strong>{ev.title}</strong>
                  <div className="muted small">{ev.description}</div>
                </div>
                <span className="small muted">{formatDate(ev.timestamp)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
