export default function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} type="button" role="tab" aria-selected={value === t.value} className={`tab ${value === t.value ? 'active' : ''}`} onClick={() => onChange(t.value)}>
          {t.label}
          {t.count !== undefined && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
