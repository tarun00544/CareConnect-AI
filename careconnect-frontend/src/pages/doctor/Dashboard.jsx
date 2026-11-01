import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays, CalendarCheck, Clock, Users, Bot, GitCompare,
  Share2, Compass, AlertTriangle, ArrowRight, UserCheck, Stethoscope, CheckCircle2
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import EmptyState from '../../components/ui/EmptyState';
import AppointmentCard from '../../components/appointments/AppointmentCard';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { getMyDoctorAppointments, getMyPatients } from '../../services/doctorService';
import {
  getDoctorFollowUps,
  getDoctorReferrals,
  getPatientComparisons
} from '../../services/continuityService';
import { appointmentStart, toISODate, todayISO, formatDate } from '../../utils/format';

export const patientNameOf = (a) => a?.patientId?.userId?.name || 'Patient';

export default function DoctorDashboard() {
  const { user } = useAuth();
  const { totalUnreadMessages } = useNotifications();

  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [referrals, setReferrals] = useState([]);

  useEffect(() => {
    async function loadAll() {
      try {
        setLoading(true);
        const [apptsRes, patientsRes, fuRes, refRes] = await Promise.allSettled([
          getMyDoctorAppointments({ limit: 100 }),
          getMyPatients(),
          getDoctorFollowUps(),
          getDoctorReferrals(),
        ]);

        const val = (r, fallback) => (r.status === 'fulfilled' ? r.value : fallback);
        setAppointments(val(apptsRes, { items: [] })?.items || []);
        setPatients(val(patientsRes, []) || []);
        setFollowUps(val(fuRes, []) || []);
        setReferrals(val(refRes, []) || []);
      } catch (err) {
        // Fallback
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  const todayAppts = appointments
    .filter((a) => toISODate(a.date) === todayISO() && !['CANCELLED', 'NO_SHOW'].includes(a.status))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const activeConsultations = appointments.filter((a) => a.status === 'IN_PROGRESS');
  const pendingConfirmations = appointments.filter((a) => a.status === 'PENDING');
  const followUpsDue = followUps.filter((f) => f.status === 'UPCOMING' || f.status === 'PENDING' || f.status === 'OVERDUE');
  const pendingReferrals = referrals.filter((r) => r.status === 'PENDING');
  const overdueFollowUps = followUps.filter((f) => f.status === 'OVERDUE');

  return (
    <div className="stack-lg">
      <PageHeader
        title={`Welcome, Dr. ${user?.name || 'Physician'}`}
        subtitle="CareConnect Continuity Engine — Physician Clinical Command Center."
      />

      {/* Continuity Hero Bar */}
      <div
        className="card row between wrap gap-md"
        style={{
          background: 'linear-gradient(135deg, var(--navy-900), #164e63)',
          color: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          padding: '24px 28px',
        }}
      >
        <div style={{ maxWidth: '640px' }}>
          <span className="badge badge-teal" style={{ background: 'rgba(20, 184, 166, 0.25)', color: '#5eead4' }}>
            Physician Continuity Cockpit
          </span>
          <h2 style={{ color: '#fff', fontSize: '1.45rem', margin: '8px 0 6px' }}>
            Integrated Longitudinal Care Management
          </h2>
          <p className="small" style={{ color: '#e2e8f0', margin: 0, lineHeight: 1.5 }}>
            Synthesize patient histories with AI summaries, review report evolution curves, and coordinate care across multidisciplinary referrals.
          </p>
        </div>

        <div className="row gap-sm wrap">
          <Link to="/doctor/patient-navigation" className="btn btn-primary row center gap-xs">
            <Compass size={16} /> <span>Patient Navigation</span>
          </Link>
          <Link to="/doctor/ai-copilot" className="btn btn-secondary row center gap-xs" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
            <Bot size={16} /> <span>Launch Copilot</span>
          </Link>
        </div>
      </div>

      {/* Overdue alert banner */}
      {overdueFollowUps.length > 0 && (
        <div className="card row between wrap gap-sm" style={{ background: 'var(--red-50)', border: '1.5px solid var(--red-600)' }}>
          <div className="row gap-sm">
            <AlertTriangle size={22} color="var(--red-600)" />
            <div>
              <strong style={{ color: 'var(--red-600)' }}>
                {overdueFollowUps.length} Overdue Patient Follow-up(s) Require Review
              </strong>
              <div className="small muted">Follow-up due dates have lapsed without recorded completion.</div>
            </div>
          </div>
          <Link to="/doctor/follow-ups" className="btn btn-sm btn-primary">
            Review Overdue Follow-ups
          </Link>
        </div>
      )}

      {/* Stats Widgets */}
      <div className="grid grid-stats">
        <StatCard
          label="Today's Appointments"
          value={todayAppts.length}
          icon={CalendarCheck}
          loading={loading}
          hint={`${activeConsultations.length} currently active`}
        />
        <StatCard
          label="Total Assigned Patients"
          value={patients.length}
          icon={Users}
          tone="blue"
          loading={loading}
        />
        <StatCard
          label="Follow-ups Due"
          value={followUpsDue.length}
          icon={CalendarDays}
          tone="teal"
          loading={loading}
          hint={`${overdueFollowUps.length} overdue`}
        />
        <StatCard
          label="Pending Referrals"
          value={pendingReferrals.length}
          icon={Share2}
          tone="amber"
          loading={loading}
          hint={`${referrals.length} total referrals`}
        />
      </div>

      {/* Clinical Workflow Quick Access */}
      <section aria-label="Clinical Tools">
        <h3 className="section-title">Clinical Continuity Modules</h3>
        <div className="grid grid-cards">
          {[
            { to: '/doctor/patient-navigation', label: 'Patient Navigation', desc: 'Complete 360° patient journey & AI summaries', icon: Compass, color: 'var(--teal-600)' },
            { to: '/doctor/report-comparison', label: 'Report Evolution Tracker', desc: 'Biomarker delta curves & clinical certification', icon: GitCompare, color: 'var(--blue-600)' },
            { to: '/doctor/ai-copilot', label: 'Doctor AI Copilot', desc: 'Draft SOAP notes, audits, & patient explanations', icon: Bot, color: 'var(--navy-900)' },
            { to: '/doctor/follow-ups', label: 'Follow-up Manager', desc: 'Task scheduler & requested test tracker', icon: CalendarDays, color: 'var(--teal-600)' },
            { to: '/doctor/referrals', label: 'Referrals & Collaboration', desc: 'Consent-verified colleague referrals', icon: Share2, color: 'var(--blue-600)' },
            { to: '/doctor/patients', label: 'My Patients Directory', desc: 'Patient records & consultation dossiers', icon: Users, color: 'var(--navy-700)' },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="card p-md row gap-sm align-center"
              style={{ textDecoration: 'none', transition: 'all 0.15s ease' }}
            >
              <div
                style={{
                  background: 'var(--gray-100)',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  color: item.color,
                }}
              >
                <item.icon size={22} />
              </div>
              <div>
                <strong style={{ color: 'var(--navy-900)' }}>{item.label}</strong>
                <div className="muted small">{item.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Today's Schedule & Pending Confirmations */}
      <div className="grid grid-2 align-start">
        {/* Today's Schedule */}
        <section className="card stack-sm">
          <div className="row between">
            <h3 className="section-title">Today's Schedule</h3>
            <Link to="/doctor/appointments" className="small">All appointments</Link>
          </div>
          {todayAppts.length > 0 ? (
            todayAppts.map((a) => (
              <AppointmentCard
                key={a._id}
                appointment={a}
                who={patientNameOf(a)}
                to={`/doctor/appointments/${a._id}`}
                showPayment={false}
              />
            ))
          ) : (
            <EmptyState
              compact
              icon={CalendarCheck}
              title="No Appointments Today"
              message="No consultations scheduled on your calendar for today."
            />
          )}
        </section>

        {/* Action Items: Follow-ups & Referrals Pending */}
        <section className="card stack-sm">
          <div className="row between">
            <h3 className="section-title">Pending Clinical Actions</h3>
            <Link to="/doctor/follow-ups" className="small">View all</Link>
          </div>
          {followUpsDue.length > 0 || pendingReferrals.length > 0 ? (
            <div className="grid gap-xs">
              {followUpsDue.slice(0, 3).map((f) => (
                <div key={f._id} className="card p-sm row between align-center">
                  <div>
                    <strong className="small">{f.title}</strong>
                    <div className="muted small">
                      Patient: {f.patientId?.userId?.name || 'Patient'} · Due: {formatDate(f.dueDate)}
                    </div>
                  </div>
                  <span className={`badge ${f.status === 'OVERDUE' ? 'badge-danger' : 'badge-teal'}`}>
                    {f.status}
                  </span>
                </div>
              ))}
              {pendingReferrals.slice(0, 2).map((r) => (
                <div key={r._id} className="card p-sm row between align-center" style={{ background: 'var(--amber-50)' }}>
                  <div>
                    <strong className="small">Referral: {r.reason}</strong>
                    <div className="muted small">Patient: {r.patientId?.userId?.name || 'Patient'}</div>
                  </div>
                  <span className="badge badge-warning">Awaiting Consent</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              compact
              icon={CheckCircle2}
              title="No Pending Action Items"
              message="All follow-ups and referrals are current."
            />
          )}
        </section>
      </div>
    </div>
  );
}
