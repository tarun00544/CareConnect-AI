import PageHeader from '../../components/ui/PageHeader';
import DoctorDirectory from '../../components/doctors/DoctorDirectory';

export default function DoctorsList() {
  return (
    <div className="stack-lg">
      <PageHeader title="Find Doctors" subtitle="Browse specialists and book a consultation." />
      <DoctorDirectory profileBase="/patient/doctors" />
    </div>
  );
}
