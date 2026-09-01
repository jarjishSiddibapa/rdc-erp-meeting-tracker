import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { AuthProvider, useAuth } from './context/AuthContext';
import GlobalLoadingIndicator, { LoadingNotice } from './components/ui/LoadingNotice';

// App.jsx is the root — anything imported here eagerly ends up in every route's initial
// bundle, /login included. Login and Dashboard each pull in their own antd surface, so
// route-level lazy() here keeps an authenticated user from paying for Login's weight and vice versa — the same
// pattern Dashboard.jsx already uses one level down for its own sub-pages.
const Login = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

const BRAND = '#00B51A';

function PageFallback() {
  return <LoadingNotice fullPage />;
}

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to="/" replace /> : children;
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
        <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
        <Route path="/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: BRAND,
          colorInfo: BRAND,
          borderRadius: 10,
          fontFamily: 'Aptos, "Segoe UI Variable", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
          controlHeight: 36,
          controlHeightLG: 42,
          motionDurationFast: '0.1s',
          motionDurationMid: '0.15s',
          motionDurationSlow: '0.2s',
        },
        components: {
          Table: { fontSize: 13 },
          Menu: { itemHeight: 40 },
        }
      }}
    >
      <GlobalLoadingIndicator />
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ConfigProvider>
  );
}
