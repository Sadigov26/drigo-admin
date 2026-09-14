import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getPermissions } from './permissionsApi';
import type { Permissions } from './permissionsApi';

type PermissionState =
  | { status: 'loading' }
  | { status: 'ready'; data: Permissions }
  | { status: 'error'; message: string };

type PermissionsContextValue = {
  state: PermissionState;
  can: (permission: string) => boolean;
  retry: () => void;
};

const Context = createContext<PermissionsContextValue | null>(null);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const adminId = session.status === 'authenticated' ? session.admin.id : null;
  const [state, setState] = useState<PermissionState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!adminId) return;
    const controller = new AbortController();
    setState({ status: 'loading' });
    getPermissions(controller.signal).then(data => {
      if (controller.signal.aborted) return;
      if (data.adminId !== adminId) throw new Error('Permissions do not match the signed-in account.');
      setState({ status: 'ready', data });
    }).catch(error => {
      if (!controller.signal.aborted) {
        setState({ status: 'error', message: error instanceof Error ? error.message : 'Unable to load permissions.' });
      }
    });
    return () => controller.abort();
  }, [adminId, attempt]);

  // Never show the previous account's grants while a new account is loading.
  const currentState: PermissionState = state.status === 'ready' && state.data.adminId !== adminId
    ? { status: 'loading' } : state;
  const can = (permission: string) => currentState.status === 'ready'
    && (currentState.data.isSuperAdmin || currentState.data.permissionCodes.includes(permission));

  return (
    <Context.Provider value={{ state: currentState, can, retry: () => {
      setState({ status: 'loading' });
      setAttempt(value => value + 1);
    } }}>
      {children}
    </Context.Provider>
  );
}

export function usePermissions() {
  const context = useContext(Context);
  if (!context) throw new Error('usePermissions must be used inside PermissionsProvider.');
  return context;
}
