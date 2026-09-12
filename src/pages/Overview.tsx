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
      <div className="page-heading">
        <h1>Overview</h1>
        <p>Admin panel setup</p>
      </div>
      <section className="connection-panel" aria-labelledby="connection-heading">
        <div className="panel-heading">
          <h2 id="connection-heading">Server connection</h2>
          <button
            type="button"
            disabled={connection.status === 'checking'}
            onClick={() => {
              setConnection({ status: 'checking' });
              setAttempt(value => value + 1);
            }}
          >
            {connection.status === 'checking' ? 'Checking…' : 'Check connection'}
          </button>
        </div>
        <div className="panel-body">
          <dl className="connection-details">
            <div><dt>Service</dt><dd>DRIGO API</dd></div>
            <div>
              <dt>Status</dt>
              <dd role="status" aria-live="polite">
                {connection.status === 'checking' && 'Checking…'}
                {connection.status === 'online' && <span className="connection-online">Connected</span>}
                {connection.status === 'offline' && <span className="error-text">Unavailable</span>}
              </dd>
            </div>
            <div>
              <dt>Last successful check</dt>
              <dd>{connection.status === 'online' ? connection.checkedAt : '—'}</dd>
            </div>
          </dl>
          {connection.status === 'offline' && <p role="alert" className="error-message">{connection.message}</p>}
          <div className="setup-note">
            <h3>Authentication is not configured yet</h3>
            <p>Login and OTP verification are the next step. Rental and customer data will be available after sign-in is implemented.</p>
          </div>
        </div>
      </section>
    </>
  );
}
