import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { ErrorState, LoadingState } from '../components/States';

export function SessionGate() {
  const { session, refreshSession } = useAuth();
  if (session.status === 'checking') {
    return <main className="session-screen"><LoadingState message="Checking your session…" /></main>;
  }
  if (session.status === 'error') {
    return (
      <main className="session-screen">
        <h1>Unable to connect</h1>
        <ErrorState message={session.message} onRetry={() => { void refreshSession(); }} />
      </main>
    );
  }
  return <Outlet />;
}

export function RequireAuth() {
  const { session } = useAuth();
  return session.status === 'authenticated' ? <Outlet /> : <Navigate to="/login" replace />;
}

export function GuestOnly() {
  const { session } = useAuth();
  return session.status === 'authenticated' ? <Navigate to="/" replace /> : <Outlet />;
}
