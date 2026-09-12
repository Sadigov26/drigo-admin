import { useEffect } from 'react';
import { Link, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Overview } from './pages/Overview';

function Layout() {
  const { pathname } = useLocation();
  useEffect(() => { document.title = pathname === '/' ? 'Overview | DRIGO Admin' : 'Page not found | DRIGO Admin'; }, [pathname]);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="sidebar">
        <Link to="/" className="brand" aria-label="DRIGO home">drigo<span>↗</span></Link>
        <p className="sidebar-label">WORKSPACE</p>
        <nav aria-label="Main navigation"><NavLink to="/" end><span aria-hidden="true">▦</span> Overview</NavLink></nav>
        <div className="sidebar-footer"><span className="sidebar-dot" /> Dubai operations<p>Admin workspace</p></div>
      </aside>
      <div className="main-shell">
        <header className="topbar"><span>Workspace <span className="breadcrumb">/ {pathname === '/' ? 'Overview' : 'Not found'}</span></span><span className="environment">Local environment</span></header>
        <main id="main-content" tabIndex={-1}><Outlet /></main>
        <footer className="page-footer"><span>DRIGO Admin</span><span>Built for everyday operations.</span></footer>
      </div>
    </div>
  );
}

function NotFound() {
  return <section className="not-found"><p className="eyebrow">404</p><h1>Page not found</h1><p>This page does not exist in your workspace.</p><Link className="button-link" to="/">Return to overview</Link></section>;
}

export function App() {
  return <Routes><Route element={<Layout />}><Route index element={<Overview />} /><Route path="*" element={<NotFound />} /></Route></Routes>;
}
