import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';

type Connection =
  | { status: 'checking' }
  | { status: 'online'; checkedAt: string }
  | { status: 'offline'; message: string };

export function Overview() {
  const [connection, setConnection] = useState<Connection>({ status: 'checking' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 8000);

    async function checkConnection() {
      try {
        const result = await apiRequest<{ status: string }>('/api/health', {
          signal: controller.signal,
        });
        if (result.status !== 'ok') throw new Error('The backend is not ready.');
        if (!controller.signal.aborted) {
          setConnection({ status: 'online', checkedAt: new Date().toLocaleTimeString() });
        }
      } catch (error) {
        if (!controller.signal.aborted || timedOut) {
          setConnection({ status: 'offline', message: timedOut
            ? 'The connection timed out. Check that the backend is running and try again.'
            : error instanceof Error ? error.message : 'Unable to reach the backend.' });
        }
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void checkConnection();
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [attempt]);

  return (
    <>
      <section className="welcome">
        <div>
          <p className="eyebrow">DRIGO OPERATIONS</p>
          <h1>Your fleet.<br />One workspace.</h1>
          <p className="intro">A home for your cars, rentals and customers.<br />Your operations workspace is taking shape.</p>
        </div>
        <div className="welcome-mark" aria-hidden="true">D<span>↗</span></div>
      </section>

      <section className="connection-panel" aria-labelledby="connection-heading">
        <div>
          <p className="eyebrow">CONNECTION</p>
          <h2 id="connection-heading">Backend availability</h2>
          <div role="status" aria-live="polite">
            {connection.status === 'checking' && <p>Checking the connection…</p>}
            {connection.status === 'online' && <p><span className="status-dot" /> Online <span className="muted">· Checked at {connection.checkedAt}</span></p>}
            {connection.status === 'offline' && <p className="error-text">{connection.message}</p>}
          </div>
        </div>
        <button disabled={connection.status === 'checking'} onClick={() => {
          setConnection({ status: 'checking' });
          setAttempt(value => value + 1);
        }}>{connection.status === 'checking' ? 'Checking…' : 'Check again'} <span aria-hidden="true">↻</span></button>
      </section>

      <section className="workspace-plan" aria-labelledby="workspace-heading">
        <div className="section-heading"><h2 id="workspace-heading">Inside your workspace</h2><span className="muted">Coming next</span></div>
        <div className="module-row"><span className="module-number">01</span><div><h3>Secure access</h3><p>Sign in, verify your OTP and access your admin account.</p></div><span className="pill">Next milestone</span></div>
        <div className="module-row"><span className="module-number">02</span><div><h3>Fleet & rentals</h3><p>Explore cars, inspect rentals and manage their lifecycle.</p></div><span className="muted">Planned</span></div>
        <div className="module-row"><span className="module-number">03</span><div><h3>Customers & payments</h3><p>Review customers, track fines and manage outstanding debt.</p></div><span className="muted">Planned</span></div>
      </section>
    </>
  );
}
