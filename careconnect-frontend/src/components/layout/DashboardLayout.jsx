import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import MobileNav from './MobileNav';
import IncomingCallModal from '../video/IncomingCallModal';
import { useAuth } from '../../context/AuthContext';
import { NAV_BY_ROLE } from '../../constants/navigation';

export default function DashboardLayout() {
  const { role } = useAuth();
  const [drawer, setDrawer] = useState(false);
  const { pathname } = useLocation();
  const items = NAV_BY_ROLE[role] || [];

  useEffect(() => { setDrawer(false); window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">Skip to content</a>
      <Sidebar items={items} drawerOpen={drawer} onCloseDrawer={() => setDrawer(false)} />
      <div className="app-main">
        <Topbar onMenu={() => setDrawer(true)} />
        <main id="main" className="content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <MobileNav items={items} role={role} onMore={() => setDrawer(true)} />
      <IncomingCallModal />
    </div>
  );
}
