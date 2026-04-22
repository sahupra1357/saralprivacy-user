import React, { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { exchangeSSOToken } from './api/auth';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ProtectedRoute from './components/ProtectedRoute';

const Spinner: React.FC<{ message?: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center min-h-screen gap-4">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
    {message && <p className="text-gray-600 text-sm">{message}</p>}
  </div>
);

const AppRoutes: React.FC = () => {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isHandlingSSO, setIsHandlingSSO] = useState(false);
  const [ssoChecked, setSsoChecked] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const orchToken = params.get('orch_token');
    if (!orchToken) { setSsoChecked(true); return; }

    setIsHandlingSSO(true);
    window.history.replaceState({}, '', location.pathname);

    exchangeSSOToken(orchToken)
      .then((data) => {
        login(data.access_token, data.user);
        void navigate('/dashboard', { replace: true });
      })
      .catch(() => {
        void navigate('/login', {
          replace: true,
          state: { ssoError: 'Your access link has expired. Please request a new one.' },
        });
      })
      .finally(() => {
        setIsHandlingSSO(false);
        setSsoChecked(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isHandlingSSO || !ssoChecked || isLoading) {
    return <Spinner message={isHandlingSSO ? 'Setting up your workspace...' : undefined} />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

const App: React.FC = () => <AppRoutes />;

export default App;
