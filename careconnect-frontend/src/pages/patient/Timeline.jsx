import { useState, useEffect } from 'react';
import {
  History, CalendarDays, ClipboardList, FlaskConical, HeartPulse,
  GitCompare, CalendarCheck, Share2, Stethoscope, UserRound, Filter
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Timeline from '../../components/ui/Timeline';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import StatusBadge from '../../components/ui/StatusBadge';
import { getPatientJourney } from '../../services/continuityService';
import { formatDate } from '../../utils/format';

const CATEGORY_ICONS = {
  REGISTRATION: UserRound,
  APPOINTMENT: CalendarDays,
  CONSULTATION: Stethoscope,
  REPORT_UPLOAD: FlaskConical,
  REPORT_COMPARISON: GitCompare,
  PRESCRIPTION: ClipboardList,
  ADMISSION: HeartPulse,
  DISCHARGE: HeartPulse,
  FOLLOW_UP_CREATED: CalendarCheck,
  FOLLOW_UP_COMPLETED: CalendarCheck,
  REFERRAL: Share2,
};

export default function CareTimeline() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await getPatientJourney();
        setEvents(data || []);
      } catch (err) {
        // Fallback
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <LoadingSpinner label="Compiling your complete chronological health journey…" />;
  }

  const filteredEvents = events.filter((ev) => {
    if (filter === 'ALL') return true;
    if (filter === 'CONSULTATIONS') return ev.category === 'APPOINTMENT' || ev.category === 'CONSULTATION';
    if (filter === 'REPORTS') return ev.category === 'REPORT_UPLOAD' || ev.category === 'REPORT_COMPARISON';
    if (filter === 'FOLLOWUPS') return ev.category === 'FOLLOW_UP_CREATED' || ev.category === 'FOLLOW_UP_COMPLETED';
    if (filter === 'REFERRALS') return ev.category === 'REFERRAL';
    if (filter === 'INPATIENT') return ev.category === 'ADMISSION' || ev.category === 'DISCHARGE';
    return true;
  });

  const timelineItems = filteredEvents.map((ev) => {
    const Icon = CATEGORY_ICONS[ev.category] || History;
    return {
      id: ev.id,
      title: ev.title,
      description: ev.description,
      date: formatDate(ev.timestamp),
      tone: ev.badgeTone || 'teal',
      icon: Icon,
      to: ev.link,
      badge: ev.status ? <StatusBadge status={ev.status} size="sm" /> : null,
    };
  });

  return (
    <div className="stack-lg">
      <PageHeader
        title="Patient Health Journey Timeline"
        subtitle="An unbroken, chronological record of your healthcare journey, compiled directly from verified clinical database records."
      />

      {/* Category filter pills */}
      <section className="card p-sm">
        <div className="row between wrap gap-sm">
          <div className="row gap-xs">
            <Filter size={16} className="muted" />
            <span className="small muted">Filter Timeline Events:</span>
          </div>
          <div className="row wrap gap-xs">
            {[
              { id: 'ALL', label: `All Events (${events.length})` },
              { id: 'CONSULTATIONS', label: 'Consultations' },
              { id: 'REPORTS', label: 'Reports & Comparisons' },
              { id: 'FOLLOWUPS', label: 'Follow-ups' },
              { id: 'REFERRALS', label: 'Referrals' },
              { id: 'INPATIENT', label: 'Admissions' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`btn btn-sm ${filter === tab.id ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline display */}
      {timelineItems.length > 0 ? (
        <section className="card">
          <Timeline items={timelineItems} />
        </section>
      ) : (
        <EmptyState
          icon={History}
          title="No events match this filter"
          message="Adjust your filter selection above or book a consultation to expand your health journey."
        />
      )}

      <p className="muted small text-center">
        Every milestone in your timeline represents an authenticated clinical interaction. AI pre-assessments are strictly informational and not stored as permanent medical records.
      </p>
    </div>
  );
}
