import PageHeader from '../../components/ui/PageHeader';
import DoctorDirectory from '../../components/doctors/DoctorDirectory';

// Public doctor discovery. Profiles/booking live in the (protected) patient area; unauthenticated visitors
// are sent to sign in and returned to the same doctor afterwards.
export default function DoctorsPage() {
  return (
    <div className="container page-pad">
      <PageHeader eyebrow="Doctors" title="Find a doctor" subtitle="Search specialists by department, hospital or name. Sign in to book an appointment." />
      <DoctorDirectory profileBase="/patient/doctors" />
    </div>
  );
}
