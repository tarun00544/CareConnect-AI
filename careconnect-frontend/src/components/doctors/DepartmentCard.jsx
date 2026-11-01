import { Link } from 'react-router-dom';
import { Building2, ChevronRight } from 'lucide-react';

export default function DepartmentCard({ department, doctorsTo }) {
  return (
    <article className="card dept-card">
      <span className="dept-icon"><Building2 size={22} aria-hidden="true" /></span>
      <h3>{department.name}</h3>
      {department.hospitalId?.name && <div className="muted small">{department.hospitalId.name}</div>}
      <p className="muted">{department.description || 'Speak to a specialist in this department.'}</p>
      <Link to={doctorsTo} className="link-arrow">View doctors <ChevronRight size={15} aria-hidden="true" /></Link>
    </article>
  );
}
