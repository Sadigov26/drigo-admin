import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { usePermissions } from './PermissionsContext';
import { EmptyState, ErrorState, LoadingState } from '../components/States';

export function ModulePage({ title, permission, children }: { title: string; permission: string; children?: ReactNode }) {
  const { state, can, retry } = usePermissions();
  if (state.status === 'loading') return <LoadingState message="Loading permissions…" />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={retry} />;
  if (!can(permission)) {
    return <section><h1>Access denied</h1><p className="page-description">Your account does not have access to this module.</p><Link to="/">Return to overview</Link></section>;
  }
  return children ?? <section><h1>{title}</h1><EmptyState message="This module has not been implemented yet." /></section>;
}
