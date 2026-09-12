import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { verifyOtp } from './authApi';
import { useAuth } from './AuthContext';

export function VerifyPage() {
  const { pendingUsername, refreshSession } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  if (!pendingUsername) return <Navigate to="/login" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.current || !pendingUsername) return;
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the six-digit verification code.');
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError('');
    try {
      await verifyOtp(pendingUsername, code, controller.signal);
      if (!controller.signal.aborted) {
        setCode('');
        // /auth/me must confirm the session before the panel opens.
        await refreshSession();
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Unable to verify the code. Please try again.');
      }
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-brand">DRIGO <span>Admin</span></div>
      <section className="auth-panel" aria-labelledby="verify-title">
        <h1 id="verify-title">Verify your sign-in</h1>
        <p className="auth-description">Enter the verification code for <strong>{pendingUsername}</strong>.</p>
        <form onSubmit={handleSubmit} aria-busy={busy}>
          <div className="form-field">
            <label htmlFor="code">Verification code</label>
            <input id="code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code"
              pattern="[0-9]{6}" maxLength={6} required aria-describedby="code-help"
              value={code} onChange={event => setCode(event.target.value)} disabled={busy} />
            <p id="code-help" className="field-help">Enter all six digits.</p>
          </div>
          {error && <p role="alert" className="error-message">{error}</p>}
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? 'Verifying…' : 'Verify and sign in'}
          </button>
        </form>
        {!busy && <Link className="auth-back" to="/login" replace>Use a different account</Link>}
      </section>
    </main>
  );
}
