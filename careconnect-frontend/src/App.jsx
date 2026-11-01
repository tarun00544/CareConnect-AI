import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { CartProvider } from './context/CartContext';
import AppRoutes from './routes/AppRoutes';
import ErrorBoundary from './components/common/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppProvider>
          <AuthProvider>
            <NotificationProvider>
              <CartProvider>
                <AppRoutes />
              </CartProvider>
            </NotificationProvider>
          </AuthProvider>
        </AppProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
