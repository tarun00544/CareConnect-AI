import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
Building2,
HelpCircle,
MessageCircleQuestion,
Stethoscope,
UserRound,
LoaderCircle
} from 'lucide-react';

import StatusBadge from '../ui/StatusBadge';
import { AIDisclaimer, EmergencyBanner } from './DisclaimerBanner';
import { listDoctors } from '../../services/doctorService';

export default function AIResult({
result,
departments = [],
onPickQuestion,
variant = 'assessment'
}) {
const [doctors, setDoctors] = useState([]);
const [loadingDoctors, setLoadingDoctors] = useState(false);
const [doctorError, setDoctorError] = useState('');

const urgent =
result.urgencyCategory === 'EMERGENCY' ||
result.urgencyCategory === 'HIGH';

const matchDepartment = (name) =>
departments.find(
d => d.name?.toLowerCase() === String(name).toLowerCase()
) ||
departments.find(
d =>
d.name?.toLowerCase().includes(String(name).toLowerCase()) ||
String(name).toLowerCase().includes(d.name?.toLowerCase())
);

useEffect(() => {
let cancelled = false;

```
async function loadRecommendedDoctors() {
  if (variant !== 'assessment' || !result.possibleDepartments?.length) {
    setDoctors([]);
    return;
  }

  setLoadingDoctors(true);
  setDoctorError('');

  try {
    const departmentIds = [
      ...new Set(
        result.possibleDepartments
          .map(name => matchDepartment(name)?._id)
          .filter(Boolean)
      )
    ];

    if (!departmentIds.length) {
      setDoctors([]);
      return;
    }

    const responses = await Promise.all(
      departmentIds.map(departmentId =>
        listDoctors({ departmentId, page: 1, limit: 20 })
      )
    );

    const uniqueDoctors = new Map();

    responses.forEach(response => {
      (response.items || []).forEach(doctor => {
        if (doctor._id) {
          uniqueDoctors.set(doctor._id, doctor);
        }
      });
    });

    if (!cancelled) {
      setDoctors([...uniqueDoctors.values()]);
    }
  } catch (error) {
    if (!cancelled) {
      setDoctorError(
        error.message || 'Unable to load recommended doctors.'
      );
    }
  } finally {
    if (!cancelled) {
      setLoadingDoctors(false);
    }
  }
}

loadRecommendedDoctors();

return () => {
  cancelled = true;
};
```

}, [result, departments, variant]);

return ( <div className="ai-result stack">

```
  {urgent && (
    <EmergencyBanner message={result.safetyMessage || undefined} />
  )}

  <section>
    <h4>Summary of what you reported</h4>
    <p>{result.summary}</p>

    {result.urgencyCategory && variant !== 'report' && (
      <p className="row gap-xs small">
        <span className="muted">Suggested urgency:</span>
        <StatusBadge status={result.urgencyCategory} size="sm" />
      </p>
    )}
  </section>

  {result.possibleDepartments?.length > 0 && (
    <section>
      <h4>
        <Building2 size={16} />
        Recommended departments
      </h4>

      <div className="dept-suggest">
        {result.possibleDepartments.map(name => {
          const department = matchDepartment(name);

          return department ? (
            <Link
              key={name}
              to={`/patient/doctors?departmentId=${department._id}`}
              className="suggest-chip"
            >
              <Stethoscope size={14} />
              {department.name}
            </Link>
          ) : (
            <span key={name} className="suggest-chip suggest-static">
              {name}
            </span>
          );
        })}
      </div>
    </section>
  )}

  {variant === 'assessment' && (
    <section className="stack">

      <h4>
        <Stethoscope size={17} />
        Doctors matching your suggested departments
      </h4>

      {loadingDoctors && (
        <p className="muted">
          <LoaderCircle size={16} className="spin" />
          Loading matching doctors...
        </p>
      )}

      {doctorError && (
        <p className="field-error">{doctorError}</p>
      )}

      {!loadingDoctors && !doctorError && doctors.length === 0 && (
        <p className="muted small">
          No verified and bookable doctors are currently available
          in the suggested departments.
        </p>
      )}

      <div className="grid">
        {doctors.map(doctor => (
          <article key={doctor._id} className="card stack">

            <div className="row gap-sm align-center">

              {doctor.profilePhotoUrl ? (
                <img
                  src={doctor.profilePhotoUrl}
                  alt=""
                  width="52"
                  height="52"
                  style={{
                    borderRadius: '50%',
                    objectFit: 'cover'
                  }}
                />
              ) : (
                <UserRound size={38} />
              )}

              <div>
                <h4>
                  Dr. {doctor.userId?.name || 'Doctor'}
                </h4>

                <p className="muted small">
                  {doctor.specialization}
                </p>
              </div>

            </div>

            <p>
              <Building2 size={14} />
              {' '}{doctor.hospitalId?.name || 'Hospital'}
            </p>

            {doctor.departmentId?.name && (
              <p className="small">
                Department: {doctor.departmentId.name}
              </p>
            )}

            <p className="small">
              Qualification: {doctor.qualification || 'Not specified'}
            </p>

            <p className="small">
              Experience: {doctor.experience ?? 0} years
            </p>

            <p className="small">
              Consultation Fee: ₹{doctor.consultationFee}
            </p>

            <span className="badge badge-success">
              Verified doctor
            </span>

            <Link
              to={`/patient/doctors/${doctor._id}`}
              className="btn btn-primary"
            >
              View Profile & Book
            </Link>

          </article>
        ))}
      </div>

    </section>
  )}

  {variant !== 'report' && result.followUpQuestions?.length > 0 && (
    <section>
      <h4>
        <HelpCircle size={16} />
        Follow-up questions
      </h4>

      <div className="chips">
        {result.followUpQuestions.map(question => (
          <button
            key={question}
            type="button"
            className="chip chip-btn"
            onClick={() => onPickQuestion?.(question)}
            disabled={!onPickQuestion}
          >
            {question}
          </button>
        ))}
      </div>
    </section>
  )}

  {result.doctorQuestions?.length > 0 && (
    <section>
      <h4>
        <MessageCircleQuestion size={16} />
        Questions to ask your doctor
      </h4>

      <ul className="bullets">
        {result.doctorQuestions.map(question => (
          <li key={question}>{question}</li>
        ))}
      </ul>
    </section>
  )}

  {result.safetyMessage && !urgent && (
    <p className="muted small">{result.safetyMessage}</p>
  )}

  {variant !== 'report' && (
    <div className="row gap-sm wrap">
      <Link to="/patient/doctors" className="btn btn-primary">
        <Stethoscope size={16} />
        Find all doctors
      </Link>

      <Link
        to="/patient/appointments/book"
        className="btn btn-secondary"
      >
        Book an appointment
      </Link>
    </div>
  )}

  <AIDisclaimer />

</div>


);
}
