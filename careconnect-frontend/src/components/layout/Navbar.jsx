import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Brand } from './Sidebar';
import { PUBLIC_NAV } from '../../constants/navigation';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { isAuthenticated, homePath } = useAuth();
  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" aria-label="CareConnect AI home"><Brand /></Link>
        <nav className={`navbar-links ${open ? 'open' : ''}`} aria-label="Main">
          {PUBLIC_NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)} className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}>{n.label}</NavLink>
          ))}
          <div className="navbar-cta-mobile">
            {isAuthenticated ? (
              <Link to={homePath} className="btn btn-primary" onClick={() => setOpen(false)}>Go to dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-secondary" onClick={() => setOpen(false)}>Sign in</Link>
                <Link to="/register" className="btn btn-primary" onClick={() => setOpen(false)}>Get started</Link>
              </>
            )}
          </div>
        </nav>
        <div className="navbar-cta">
          {isAuthenticated ? (
            <Link to={homePath} className="btn btn-primary btn-sm">Dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">Sign in</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Get started</Link>
            </>
          )}
        </div>
        <button type="button" className="icon-btn navbar-toggle" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
    </header>
  );
}
