import { Link } from 'react-router-dom';
import {
  ArrowRight, CalendarCheck, ClipboardList, FileHeart, HeartPulse, History, Pill, ShieldCheck, Siren, Sparkles, Stethoscope, Video, BedDouble,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const FEATURES = [
  { icon: Sparkles, title: 'AI Health Assistant', text: 'Describe your symptoms and get general guidance on which departments may be appropriate — never a diagnosis.', tone: 'teal' },
  { icon: Stethoscope, title: 'Doctor discovery', text: 'Browse specialists by department and hospital, see qualifications, fees and weekly availability.', tone: 'blue' },
  { icon: CalendarCheck, title: 'Appointment booking', text: 'Pick a real open slot, choose video, chat or in-person, and pay securely to confirm.', tone: 'teal' },
  { icon: Video, title: 'Online consultation', text: 'Message your doctor in real time and join video consultations for booked appointments.', tone: 'blue' },
  { icon: Pill, title: 'Pharmacy', text: 'Order medicines from the catalogue with prescription checks handled for you.', tone: 'teal' },
  { icon: BedDouble, title: 'Hospital admission', text: 'Submit an admission request with your details and documents, then follow its progress.', tone: 'blue' },
  { icon: FileHeart, title: 'Medical records', text: 'Keep reports, prescriptions and admissions together in one private place.', tone: 'teal' },
  { icon: History, title: 'Care timeline', text: 'See every step of your care journey in order — appointments, prescriptions, orders and more.', tone: 'blue' },
  { icon: Siren, title: 'Emergency assistance', text: 'Alert a hospital coordinator quickly. Always call local emergency services for life-threatening situations.', tone: 'red' },
];

const JOURNEY = ['Describe symptoms', 'Find a doctor', 'Book & pay', 'Consult', 'Get prescription', 'Order medicines'];

export default function Landing() {
  const { isAuthenticated, homePath } = useAuth();
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow-pill"><HeartPulse size={14} aria-hidden="true" /> CareConnect AI</span>
            <h1>One Platform. Complete Healthcare Journey.</h1>
            <p className="lead">Connect with doctors, manage appointments, access medicines, coordinate hospital care and stay connected throughout your healthcare journey.</p>
            <div className="row gap-sm wrap">
              <Link to={isAuthenticated ? homePath : '/register'} className="btn btn-primary btn-lg">{isAuthenticated ? 'Go to dashboard' : 'Get Started'} <ArrowRight size={18} /></Link>
              <Link to="/doctors" className="btn btn-secondary btn-lg">Find a Doctor</Link>
            </div>
            <ul className="hero-points">
              <li><ShieldCheck size={16} aria-hidden="true" /> Secure, role-based access</li>
              <li><Sparkles size={16} aria-hidden="true" /> AI guidance, not diagnosis</li>
              <li><ClipboardList size={16} aria-hidden="true" /> Records in one place</li>
            </ul>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="journey-card">
              <div className="journey-head"><HeartPulse size={18} /> Your care journey</div>
              <ol>
                {JOURNEY.map((s, i) => (
                  <li key={s}><span className="j-num">{i + 1}</span>{s}</li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2>Everything in one connected journey</h2>
            <p className="muted">From the first symptom to follow-up care, each step hands off to the next.</p>
          </div>
          <div className="grid grid-features">
            {FEATURES.map((f) => (
              <article key={f.title} className={`feature feature-${f.tone}`}>
                <span className="feature-icon"><f.icon size={22} aria-hidden="true" /></span>
                <h3>{f.title}</h3>
                <p className="muted">{f.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container cta-band">
          <div>
            <h2>Ready to take the first step?</h2>
            <p className="muted">Create a free patient account, or browse doctors and medicines without signing in.</p>
          </div>
          <div className="row gap-sm wrap">
            <Link to="/register" className="btn btn-primary btn-lg">Create account</Link>
            <Link to="/pharmacy" className="btn btn-secondary btn-lg">Browse pharmacy</Link>
          </div>
        </div>
      </section>
    </>
  );
}
