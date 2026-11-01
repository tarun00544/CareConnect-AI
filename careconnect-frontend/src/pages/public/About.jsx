import { Link } from 'react-router-dom';
import { HeartHandshake, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';

const VALUES = [
  { icon: HeartHandshake, title: 'Care that stays connected', text: 'Patients, doctors, hospital teams and pharmacies work from the same record, so nothing gets lost between steps.' },
  { icon: Sparkles, title: 'AI that knows its limits', text: 'Our assistant summarises what you report and points to relevant departments. It never diagnoses or prescribes.' },
  { icon: Lock, title: 'Privacy by design', text: 'Every role sees only what it needs. Doctors see their own patients; patients see their own records.' },
  { icon: ShieldCheck, title: 'Verified payments', text: 'Payment status is confirmed by our servers — the browser alone can never mark something as paid.' },
];

export default function About() {
  return (
    <div className="container page-pad">
      <PageHeader eyebrow="About" title="CareConnect AI" subtitle="One Platform. Complete Healthcare Journey." />
      <div className="prose">
        <p>CareConnect AI brings the pieces of a healthcare journey into a single product: understanding symptoms, finding the right doctor, booking and paying for a consultation, talking to your care team, receiving prescriptions, ordering medicines and, when needed, coordinating hospital admission and bed allocation.</p>
        <p>It is built as a role-based platform for five kinds of users — patients, doctors, hospital administrators, pharmacy administrators and super administrators — each with a focused workspace.</p>
      </div>
      <div className="grid grid-2" style={{ marginTop: 24 }}>
        {VALUES.map((v) => (
          <article key={v.title} className="card row gap-sm" style={{ alignItems: 'flex-start' }}>
            <span className="round-icon"><v.icon size={20} aria-hidden="true" /></span>
            <div><h3>{v.title}</h3><p className="muted">{v.text}</p></div>
          </article>
        ))}
      </div>
      <div className="disclaimer" style={{ marginTop: 24 }}>
        <ShieldCheck size={18} aria-hidden="true" />
        <p>CareConnect AI is not an emergency service. If you are experiencing a life-threatening emergency, contact local emergency services or go to the nearest hospital.</p>
      </div>
      <div className="row gap-sm" style={{ marginTop: 24 }}>
        <Link to="/register" className="btn btn-primary">Create account</Link>
        <Link to="/services" className="btn btn-secondary">Explore services</Link>
      </div>
    </div>
  );
}
