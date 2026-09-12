import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from './authApi';
import { useAuth } from './AuthContext';

export function LoginPage() {
  const navigate = useNavigate();
  const { setPendingUsername } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    setPendingUsername(null);
    return () => request.current?.abort();
  }, [setPendingUsername]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.current) return;
    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError('');
    try {
      const result = await login(username.trim(), password, controller.signal);
      if (!result || typeof result.username !== 'string' || !result.username) {
        throw new Error('The server did not return a username. Please try again.');
      }
      if (!controller.signal.aborted) {
        setPassword('');
        setPendingUsername(result.username);
        navigate('/verify', { replace: true });
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Unable to sign in. Please try again.');
      }
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-brand">DRIGO <span>Admin</span></div>
      <section className="auth-panel" aria-labelledby="login-title">
        <h1 id="login-title">Sign in</h1>
        <p className="auth-description">Use your admin account to continue.</p>
        <form onSubmit={handleSubmit} aria-busy={busy}>
          <div className="form-field">
            <label htmlFor="username">Username</label>
            <input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false}
              required value={username} onChange={event => setUsername(event.target.value)} disabled={busy} />
          </div>
          <div className="form-field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password"
              required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
          </div>
          {error && <p role="alert" className="error-message">{error}</p>}
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Continue'}
          </button>
        </form>
        <p className="auth-footnote">You will be asked for a verification code next.</p>
      </section>
    </main>
  );
}
