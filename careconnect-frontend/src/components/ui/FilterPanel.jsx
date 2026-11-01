import { Filter } from 'lucide-react';

/** Simple responsive filter row. `filters`: [{ key, label, value, options:[{value,label}], onChange, placeholder }] */
export default function FilterPanel({ filters, onReset, children }) {
  return (
    <div className="filter-panel" role="group" aria-label="Filters">
      <span className="filter-title"><Filter size={15} aria-hidden="true" /> Filters</span>
      {filters.map((f) => (
        <label className="filter-item" key={f.key}>
          <span className="sr-only">{f.label}</span>
          <select className="select" value={f.value} onChange={(e) => f.onChange(e.target.value)} aria-label={f.label}>
            <option value="">{f.placeholder || `All ${f.label.toLowerCase()}`}</option>
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      ))}
      {children}
      {onReset && <button type="button" className="btn btn-ghost btn-sm" onClick={onReset}>Reset</button>}
    </div>
  );
}
