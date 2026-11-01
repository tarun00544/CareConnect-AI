import { Link } from 'react-router-dom';
import { BedDouble, CalendarCheck, CreditCard, FileHeart, MessageSquare, Pill, Siren, Sparkles, Stethoscope, Video } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';

const SERVICES = [
  { icon: Sparkles, title: 'AI symptom guidance', text: 'Structured, non-diagnostic pre-consultation triage that suggests departments and questions to ask.', to: '/register' },
  { icon: Stethoscope, title: 'Doctors & departments', text: 'Search specialists, compare fees and see weekly schedules.', to: '/doctors' },
  { icon: CalendarCheck, title: 'Appointments', text: 'Book real available slots, reschedule or cancel from your dashboard.', to: '/register' },
  { icon: CreditCard, title: 'Secure payments', text: 'Pay consultation fees and medicine orders with Razorpay; receipts are kept in your account.', to: '/register' },
  { icon: MessageSquare, title: 'Chat with your doctor', text: 'Real-time messaging tied to each appointment.', to: '/register' },
  { icon: Video, title: 'Video consultation', text: 'A consultation room for booked video appointments.', to: '/register' },
  { icon: Pill, title: 'Pharmacy', text: 'Browse the catalogue, add to cart and order — prescription-only items are verified.', to: '/pharmacy' },
  { icon: BedDouble, title: 'Hospital admission', text: 'Digital admission requests with document upload and status tracking.', to: '/register' },
  { icon: FileHeart, title: 'Medical records', text: 'Upload and keep reports; view prescriptions and admissions together.', to: '/register' },
  { icon: Siren, title: 'Emergency coordination', text: 'Alert a hospital coordinator. This does not replace emergency services.', to: '/register' },
];

export default function Services() {
  return (
    <div className="container page-pad">
      <PageHeader eyebrow="Services" title="Everything your care journey needs" subtitle="Each service connects to the next, so your information follows you." />
      <div className="grid grid-cards">
        {SERVICES.map((s) => (
          <Link key={s.title} to={s.to} className="card card-link">
            <span className="round-icon"><s.icon size={20} aria-hidden="true" /></span>
            <h3>{s.title}</h3>
            <p className="muted">{s.text}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
