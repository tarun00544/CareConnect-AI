import PageHeader from '../../components/ui/PageHeader';
import MedicineCatalog from '../../components/pharmacy/MedicineCatalog';

export default function Pharmacy() {
  return (
    <div className="stack-lg">
      <PageHeader title="Pharmacy" subtitle="Order medicines. Prescription-only items need one of your prescriptions at checkout." />
      <MedicineCatalog shop detailBase="/patient/pharmacy" />
    </div>
  );
}
