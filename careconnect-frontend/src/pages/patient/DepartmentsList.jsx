import PageHeader from '../../components/ui/PageHeader';
import DepartmentList from '../../components/doctors/DepartmentList';

export default function DepartmentsList() {
  return (
    <div className="stack-lg">
      <PageHeader title="Departments" subtitle="Choose a department to see its doctors." />
      <DepartmentList doctorsBase="/patient/doctors" />
    </div>
  );
}
