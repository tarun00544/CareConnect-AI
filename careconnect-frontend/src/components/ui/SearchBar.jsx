import { Search, X } from 'lucide-react';

export default function SearchBar({ value, onChange, placeholder = 'Search…', label = 'Search' }) {
  return (
    <div className="searchbar">
      <Search size={17} aria-hidden="true" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} />
      {value && (
        <button type="button" className="icon-btn icon-btn-sm" onClick={() => onChange('')} aria-label="Clear search">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
