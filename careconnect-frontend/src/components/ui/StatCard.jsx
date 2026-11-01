export default function StatCard({ label, value, icon: Icon, tone = 'teal', hint, to, loading }) {
  return (
    <div className={`stat-card stat-${tone}`}>
      {Icon && <div className="stat-icon"><Icon size={20} aria-hidden="true" /></div>}
      <div className="stat-body">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{loading ? <span className="skeleton" style={{ width: 48, height: 26, display: 'inline-block' }} /> : value}</div>
        {hint && <div className="stat-hint">{hint}</div>}
      </div>
      {to}
    </div>
  );
}
