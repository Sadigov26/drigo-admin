import { Link } from 'react-router-dom';
import { usePermissions } from './PermissionsContext';
import { EmptyState, ErrorState, LoadingState } from '../components/States';

export function ModulePage({ title, permission }: { title: string; permission: string }) {
  const { state, can, retry } = usePermissions();
  if (state.status === 'loading') return <LoadingState message="Loading permissions…" />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={retry} />;
  if (!can(permission)) {
    return <section><h1>Access denied</h1><p className="page-description">Your account does not have access to this module.</p><Link to="/">Return to overview</Link></section>;
  }
  return <section><h1>{title}</h1><EmptyState message="This module has not been implemented yet." /></section>;
}
