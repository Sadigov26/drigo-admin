import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError, SESSION_EXPIRED_EVENT } from '../api/client';
import { getSession, logout } from './authApi';
import type { Admin } from './authApi';

type Session =
  | { status: 'checking' }
  | { status: 'authenticated'; admin: Admin }
  | { status: 'anonymous' }
  | { status: 'error'; message: string };

type AuthContextValue = {
  session: Session;
  pendingUsername: string | null;
  setPendingUsername: (username: string | null) => void;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ status: 'checking' });
  const [pendingUsername, setPendingUsername] = useState<string | null>(null);
  const sessionRequest = useRef<AbortController | null>(null);
  const signingOut = useRef(false);

  const refreshSession = useCallback(async () => {
    if (signingOut.current) return;
    sessionRequest.current?.abort();
    const controller = new AbortController();
    sessionRequest.current = controller;
    setSession({ status: 'checking' });
    try {
      const admin = await getSession(controller.signal);
      if (!controller.signal.aborted) {
        setPendingUsername(null);
        setSession({ status: 'authenticated', admin });
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.status === 401) {
        setPendingUsername(null);
        setSession({ status: 'anonymous' });
      } else {
        setSession({ status: 'error', message: error instanceof Error
          ? error.message : 'Unable to check your session.' });
      }
    }
  }, []);

  useEffect(() => {
    void refreshSession();
    return () => sessionRequest.current?.abort();
  }, [refreshSession]);

  useEffect(() => {
    const expireSession = () => {
      sessionRequest.current?.abort();
      setPendingUsername(null);
      setSession({ status: 'anonymous' });
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, expireSession);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expireSession);
  }, []);

  useEffect(() => {
    if (session.status !== 'authenticated') return;
    const onFocus = () => { void refreshSession(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [session.status, refreshSession]);

  const signOut = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    // A late /me response must not restore an account after logout.
    sessionRequest.current?.abort();
    try {
      const result = await logout();
      if (result?.success !== true) throw new Error('Sign out was not completed. Please try again.');
      setPendingUsername(null);
      setSession({ status: 'anonymous' });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setPendingUsername(null);
        setSession({ status: 'anonymous' });
      } else {
        throw error;
      }
    } finally {
      signingOut.current = false;
    }
  }, []);

  return (
    <AuthContext.Provider value={{ session, pendingUsername, setPendingUsername, refreshSession, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
