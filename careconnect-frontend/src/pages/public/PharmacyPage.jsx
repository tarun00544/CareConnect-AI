import PageHeader from '../../components/ui/PageHeader';
import MedicineCatalog from '../../components/pharmacy/MedicineCatalog';

export default function PharmacyPage() {
  return (
    <div className="container page-pad">
      <PageHeader eyebrow="Pharmacy" title="Medicine catalogue" subtitle="Browse available medicines. Sign in as a patient to order; prescription-only items need a valid prescription." />
      <MedicineCatalog shop={false} />
    </div>
  );
}
