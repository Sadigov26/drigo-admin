import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function SessionGate() {
  const { session, refreshSession } = useAuth();
  if (session.status === 'checking') {
    return <main className="session-screen"><p role="status">Checking your session…</p></main>;
  }
  if (session.status === 'error') {
    return (
      <main className="session-screen">
        <h1>Unable to connect</h1>
        <p role="alert">{session.message}</p>
        <button onClick={() => { void refreshSession(); }}>Try again</button>
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
