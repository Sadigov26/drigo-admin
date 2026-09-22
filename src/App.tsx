import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Overview } from './pages/Overview';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { GuestOnly, RequireAuth, SessionGate } from './auth/AuthRoutes';
import { LoginPage } from './auth/LoginPage';
import { VerifyPage } from './auth/VerifyPage';
import { PermissionsProvider, usePermissions } from './permissions/PermissionsContext';
import { menuItems } from './permissions/menu';
import { ModulePage } from './permissions/ModulePage';
import { ErrorState, LoadingState } from './components/States';

const Dashboard = lazy(() => import('./dashboard/Dashboard'));
const Cars = lazy(() => import('./cars/CarsModule'));
const Catalog = lazy(() => import('./catalog/Catalog'));
const Rentals = lazy(() => import('./rentals/Rentals'));
const Customers = lazy(() => import('./customers/Customers'));

function PageTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'Overview',
      '/login': 'Sign in',
      '/verify': 'Verify sign-in',
    };
    document.title = (titles[pathname] ?? menuItems.find(item => item.path === pathname)?.label ?? 'Page not found') + ' | DRIGO Admin';
  }, [pathname]);
  return null;
}

function Layout() {
  const { session, signOut } = useAuth();
  const { state: permissions, can, retry } = usePermissions();
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
          {permissions.status === 'loading' && <LoadingState message="Loading menu…" />}
          {permissions.status === 'error' && <ErrorState message="Menu unavailable." onRetry={retry} />}
          {menuItems.filter(item => can(item.permission)).map(item => (
            <NavLink key={item.path} to={item.path}>{item.label}</NavLink>
          ))}
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

function PermissionsLayout() {
  return <PermissionsProvider><Layout /></PermissionsProvider>;
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
            <Route element={<PermissionsLayout />}>
              <Route index element={<Overview />} />
              {menuItems.map(item => (
                <Route key={item.path} path={item.path} element={
                  <ModulePage title={item.label} permission={item.permission}>
                    {item.path === '/dashboard' ? <Suspense fallback={<LoadingState message="Loading dashboard…" />}><Dashboard /></Suspense>
                      : item.path === '/cars' ? <Suspense fallback={<LoadingState message="Loading cars…" />}><Cars /></Suspense>
                      : item.path === '/brands' ? <Suspense fallback={<LoadingState message="Loading catalog…" />}><Catalog /></Suspense>
                      : item.path === '/rentals' ? <Suspense fallback={<LoadingState message="Loading rentals…" />}><Rentals /></Suspense>
                      : item.path === '/customers' ? <Suspense fallback={<LoadingState message="Loading customers…" />}><Customers /></Suspense> : undefined}
                  </ModulePage>
                } />
              ))}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}
