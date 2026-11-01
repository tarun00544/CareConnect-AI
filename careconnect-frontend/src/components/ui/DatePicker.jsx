import { todayISO } from '../../utils/format';

/** Native date input with a min date (defaults to today) — value/onChange use YYYY-MM-DD. */
export default function DatePicker({ value, onChange, min = todayISO(), max, id = 'date', label = 'Select date' }) {
  return <input id={id} type="date" className="input" value={value} min={min} max={max} onChange={(e) => onChange(e.target.value)} aria-label={label} />;
}
