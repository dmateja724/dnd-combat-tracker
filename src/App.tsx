import type { ReactElement } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import CombatTracker from './components/CombatTracker';
import CombatantViewer from './components/CombatantViewer';
import SignInPage from './pages/SignIn';
import SignUpPage from './pages/SignUp';
import { useAuth } from './context/AuthContext';

const LoadingScreen = () => (
  <div className="auth-shell">
    <div className="auth-card">
      <h1>Loading…</h1>
      <p className="auth-subtitle">Preparing your adventuring party.</p>
    </div>
  </div>
);

const RequireAuth = ({ children }: { children: ReactElement }) => {
  const { user, isLoading, isBootstrapping } = useAuth();
  const location = useLocation();

  if (isBootstrapping) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  return children;
};

const GuestOnly = ({ children }: { children: ReactElement }) => {
  const { user, isLoading, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return <LoadingScreen />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  return children;
};

const App = () => {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <RequireAuth>
            <CombatTracker />
          </RequireAuth>
        }
      />
      <Route
        path="/viewer"
        element={
          <RequireAuth>
            <CombatantViewer />
          </RequireAuth>
        }
      />
      <Route
        path="/login"
        element={
          <GuestOnly>
            <SignInPage />
          </GuestOnly>
        }
      />
      <Route
        path="/signup"
        element={
          <GuestOnly>
            <SignUpPage />
          </GuestOnly>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
