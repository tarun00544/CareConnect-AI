import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** Mirrors the backend's authorize(...roles): a user whose role is not allowed is sent to /unauthorized. */
export default function RoleRoute({ allow }) {
  const { role } = useAuth();
  const allowed = Array.isArray(allow) ? allow : [allow];
  if (!role || !allowed.includes(role)) return <Navigate to="/unauthorized" replace />;
  return <Outlet />;
}
