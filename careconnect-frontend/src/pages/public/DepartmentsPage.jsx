import PageHeader from '../../components/ui/PageHeader';
import DepartmentList from '../../components/doctors/DepartmentList';

export default function DepartmentsPage() {
  return (
    <div className="container page-pad">
      <PageHeader eyebrow="Departments" title="Hospital departments" subtitle="Choose a department to see the doctors who practise there." />
      <DepartmentList doctorsBase="/doctors" />
    </div>
  );
}
