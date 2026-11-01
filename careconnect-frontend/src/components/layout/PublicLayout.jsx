import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

export default function PublicLayout() {
  return (
    <div className="public-shell">
      <a href="#main" className="skip-link">Skip to content</a>
      <Navbar />
      <main id="main" tabIndex={-1}><Outlet /></main>
      <Footer />
    </div>
  );
}
