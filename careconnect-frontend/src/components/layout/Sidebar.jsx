import { NavLink } from 'react-router-dom';
import { HeartPulse, Lock, X } from 'lucide-react';
import { NAV_ICONS } from './navIcons';
import { useNotifications } from '../../context/NotificationContext';
import { useCart } from '../../context/CartContext';

export function Brand({ compact = false }) {
  return (
    <span className="brand">
      <span className="brand-mark"><HeartPulse size={18} aria-hidden="true" /></span>
      {!compact && <span className="brand-text">CareConnect <b>AI</b></span>}
    </span>
  );
}

export function NavItems({ items, onNavigate }) {
  const { unreadCount, totalUnreadMessages } = useNotifications();
  const { count: cartCount } = useCart();
  const badgeFor = (it) => {
    if (it.badge === 'notifications') return unreadCount;
    if (it.badge === 'messages') return totalUnreadMessages;
    if (it.cart) return cartCount;
    return 0;
  };
  return (
    <nav className="nav-list" aria-label="Primary">
      {items.map((it) => {
        const Icon = NAV_ICONS[it.icon];
        const n = badgeFor(it);
        return (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            onClick={onNavigate}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${it.danger ? 'nav-danger' : ''}`}
            title={it.label}
          >
            {Icon && <Icon size={18} aria-hidden="true" />}
            <span className="nav-label">{it.label}</span>
            {it.locked && <Lock size={12} aria-label="Restricted by backend" className="nav-lock" />}
            {n > 0 && <span className="nav-badge" aria-label={`${n} new`}>{n > 99 ? '99+' : n}</span>}
          </NavLink>
        );
      })}
    </nav>
  );
}

export default function Sidebar({ items, drawerOpen, onCloseDrawer }) {
  return (
    <>
      <aside className="sidebar" aria-label="Sidebar">
        <div className="sidebar-head"><Brand /></div>
        <NavItems items={items} />
      </aside>

      {/* Mobile drawer */}
      <div className={`drawer-backdrop ${drawerOpen ? 'open' : ''}`} onClick={onCloseDrawer} aria-hidden={!drawerOpen} />
      <aside className={`drawer ${drawerOpen ? 'open' : ''}`} aria-label="Navigation drawer" aria-hidden={!drawerOpen}>
        <div className="sidebar-head">
          <Brand />
          <button type="button" className="icon-btn" onClick={onCloseDrawer} aria-label="Close menu"><X size={18} /></button>
        </div>
        <NavItems items={items} onNavigate={onCloseDrawer} />
      </aside>
    </>
  );
}
