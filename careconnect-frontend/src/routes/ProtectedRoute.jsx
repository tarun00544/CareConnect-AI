import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';

/** Requires an authenticated session. Shows a loader while the session is being restored. */
export default function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="fullscreen-center">
        <LoadingSpinner label="Restoring your session…" size={28} />
      </div>
    );
  }
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return <Outlet />;
}
