import { NavLink } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { NAV_ICONS } from './navIcons';
import { MOBILE_PRIMARY } from '../../constants/navigation';

export default function MobileNav({ items, role, onMore }) {
  const keys = MOBILE_PRIMARY[role] || [];
  const primary = keys.map((k) => items.find((i) => i.icon === k)).filter(Boolean);
  return (
    <nav className="bottom-nav" aria-label="Quick navigation">
      {primary.map((it) => {
        const Icon = NAV_ICONS[it.icon];
        return (
          <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => `bn-item ${isActive ? 'active' : ''}`}>
            <Icon size={20} aria-hidden="true" />
            <span>{it.label.split(' ')[0]}</span>
          </NavLink>
        );
      })}
      <button type="button" className="bn-item" onClick={onMore} aria-label="Open full menu">
        <Menu size={20} aria-hidden="true" />
        <span>More</span>
      </button>
    </nav>
  );
}
