import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Overview } from './pages/Overview';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { GuestOnly, RequireAuth, SessionGate } from './auth/AuthRoutes';
import { LoginPage } from './auth/LoginPage';
import { VerifyPage } from './auth/VerifyPage';

function PageTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'Overview',
      '/login': 'Sign in',
      '/verify': 'Verify sign-in',
    };
    document.title = (titles[pathname] ?? 'Page not found') + ' | DRIGO Admin';
  }, [pathname]);
  return null;
}

function Layout() {
  const { session, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleLogout() {
    setBusy(true);
    setError('');
    try {
      await signOut();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign out. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="sidebar">
        <Link to="/" className="brand" aria-label="DRIGO home">DRIGO <span>Admin</span></Link>
        <nav aria-label="Main navigation">
          <NavLink to="/" end>Overview</NavLink>
        </nav>
        <div className="sidebar-footer">Dubai, UAE</div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>Car rental administration</span>
          <div className="account-menu">
            <span>{session.status === 'authenticated' ? session.admin.username : ''}</span>
            <button onClick={() => { void handleLogout(); }} disabled={busy}>
              {busy ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </header>
        {error && <p role="alert" className="error-message logout-error">{error}</p>}
        <main id="main-content" tabIndex={-1}><Outlet /></main>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <section className="not-found">
      <p>404</p>
      <h1>Page not found</h1>
      <p>This page does not exist in your workspace.</p>
      <Link className="button-link" to="/">Return to overview</Link>
    </section>
  );
}

export function App() {
  return (
    <AuthProvider>
      <PageTitle />
      <Routes>
        <Route element={<SessionGate />}>
          <Route element={<GuestOnly />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/verify" element={<VerifyPage />} />
          </Route>
          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route index element={<Overview />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}
