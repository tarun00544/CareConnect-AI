import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, ChevronRight, LogOut, Menu, Settings, UserRound } from 'lucide-react';
import NotificationPanel from './NotificationPanel';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { BREADCRUMB_LABELS } from '../../constants/navigation';
import { ROLE_BASE, ROLE_LABEL } from '../../constants';
import { initials } from '../../utils/format';

function Breadcrumbs() {
  const { pathname } = useLocation();
  const parts = pathname.split('/').filter(Boolean);
  const crumbs = parts.map((seg, i) => {
    const to = `/${parts.slice(0, i + 1).join('/')}`;
    const isId = /^[a-f0-9]{24}$/i.test(seg);
    return { to, label: isId ? 'Details' : BREADCRUMB_LABELS[seg] || seg.replace(/-/g, ' ') };
  });
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {crumbs.map((c, i) => (
        <span key={c.to} className="crumb">
          {i > 0 && <ChevronRight size={13} aria-hidden="true" />}
          {i === crumbs.length - 1 ? <span aria-current="page">{c.label}</span> : i === 0 ? <span>{c.label}</span> : <Link to={c.to}>{c.label}</Link>}
        </span>
      ))}
    </nav>
  );
}

export default function Topbar({ onMenu }) {
  const { user, role, logout } = useAuth();
  const { unreadCount, socketStatus } = useNotifications();
  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const bellRef = useRef(null);
  const menuRef = useRef(null);
  const { pathname } = useLocation();

  useEffect(() => { setBellOpen(false); setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const base = ROLE_BASE[role];
  return (
    <header className="topbar">
      <button type="button" className="icon-btn topbar-menu" onClick={onMenu} aria-label="Open menu"><Menu size={20} /></button>
      <Breadcrumbs />
      <div className="topbar-right">
        <span className={`live-pill live-${socketStatus}`} title={`Real-time connection: ${socketStatus}`}>
          <span className={`live-dot live-${socketStatus}`} aria-hidden="true" />
          <span className="live-text">{socketStatus === 'connected' ? 'Live' : socketStatus === 'connecting' ? 'Connecting' : 'Offline'}</span>
        </span>
        <div className="anchor">
          <button ref={bellRef} type="button" className="icon-btn bell" onClick={() => setBellOpen((o) => !o)} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-expanded={bellOpen}>
            <Bell size={19} />
            {unreadCount > 0 && <span className="bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          <NotificationPanel open={bellOpen} onClose={() => setBellOpen(false)} anchorRef={bellRef} />
        </div>
        <div className="anchor" ref={menuRef}>
          <button type="button" className="profile-btn" onClick={() => setMenuOpen((o) => !o)} aria-haspopup="menu" aria-expanded={menuOpen}>
            <span className="avatar">{initials(user?.name)}</span>
            <span className="profile-meta">
              <span className="profile-name">{user?.name}</span>
              <span className="profile-role">{ROLE_LABEL[role]}</span>
            </span>
          </button>
          {menuOpen && (
            <div className="menu" role="menu">
              <div className="menu-head">
                <strong>{user?.name}</strong>
                <span className="muted small">{user?.email}</span>
              </div>
              <Link role="menuitem" to={`${base}/profile`} className="menu-item"><UserRound size={16} /> Profile</Link>
              <Link role="menuitem" to={`${base}/settings`} className="menu-item"><Settings size={16} /> Settings</Link>
              <button role="menuitem" type="button" className="menu-item menu-danger" onClick={logout}><LogOut size={16} /> Sign out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
