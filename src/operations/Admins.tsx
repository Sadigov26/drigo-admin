import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import { usePromotionData as useData } from '../promotions/usePromotionData';
import { usePermissions } from '../permissions/PermissionsContext';
import { useAuth } from '../auth/AuthContext';
import { Modal } from '../components/Modal';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { Records } from '../fleet/FleetShared';
import { snapshot, permissionDetail, savePermissions, type Row } from './operationsApi';
import '../fleet/fleet.css';
import './operations.css';

export function PermissionEditor({ admin, onClose, onSaved }: { admin: Row; onClose: () => void; onSaved: () => void }) {
  const state = useData(useCallback(async (signal: AbortSignal) => {
    const [target, catalogue] = await Promise.all([permissionDetail(String(admin.id), signal), snapshot('permissions', signal)]);
    return { target, catalogue };
  }, [admin.id]));
  const [selected, setSelected] = useState<string[] | null>(null), [search, setSearch] = useState(''), [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [uncertain, setUncertain] = useState(false);
  const lock = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const current = selected ?? state.data?.target.permissionCodes ?? [];
  const original = state.data?.target.permissionCodes ?? [];
  const added = current.filter(code => !original.includes(code)), removed = original.filter(code => !current.includes(code));
  const close = () => { if (!lock.current) onClose(); };
  async function save() {
    if (lock.current || uncertain || !state.data || state.data.target.isSuperAdmin) return;
    lock.current = true; setBusy(true); setError('');
    try { await savePermissions(String(admin.id), current); if (alive.current) onSaved(); }
    catch (cause) { if (alive.current) { setError(cause instanceof Error ? cause.message : 'Unable to save permissions.'); if (!(cause instanceof ApiError) || cause.status >= 500 || cause.status < 400) setUncertain(true); } }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  return <Modal isOpen title={`Permissions · ${admin.fullName ?? admin.username}`} onClose={close}><div className="fleet-form">
    {state.loading ? <LoadingState /> : state.error ? <ErrorState message={state.error} onRetry={state.refresh} /> : !state.data?.catalogue.length ? <EmptyState /> : state.data.target.isSuperAdmin ? <p>Super admins already have all permissions. This screen does not change the super-admin role.</p> : <>
      <p className="fleet-note">This replaces the selected administrator's permission list. Review added and removed access before confirming. Super-admin roles and your own permissions cannot be changed here.</p>
      {review ? <div className="ops-permission-review"><section><h3>Grant ({added.length})</h3>{added.length ? <ul>{added.map(code => <li key={code}>{code}</li>)}</ul> : <p>None</p>}</section><section><h3>Revoke ({removed.length})</h3>{removed.length ? <ul>{removed.map(code => <li key={code}>{code}</li>)}</ul> : <p>None</p>}</section></div> : <><label>Search permissions<input type="search" value={search} onChange={e => setSearch(e.target.value)} /></label><p>{current.length} permissions selected</p><div className="ops-permission-grid">{state.data.catalogue.filter(row => String(row.code).toLowerCase().includes(search.toLowerCase())).map(row => <label className="fleet-checkbox" key={String(row.code)}><input type="checkbox" checked={current.includes(String(row.code))} onChange={e => setSelected(e.target.checked ? [...current, String(row.code)] : current.filter(code => code !== row.code))} />{String(row.code)}</label>)}</div></>}
      {error && <p role="alert" className="error-message">{error}</p>}{uncertain && <p role="alert">Result uncertain. Close and reload this administrator before another attempt.</p>}
      <div className="fleet-actions"><button disabled={busy} onClick={close}>Cancel</button>{review ? <><button disabled={busy || uncertain} onClick={() => setReview(false)}>Back</button><button className="btn-soft-danger" disabled={busy || uncertain} onClick={() => void save()}>{busy ? 'Saving…' : 'Confirm permissions'}</button></> : <button className="btn-primary" disabled={!added.length && !removed.length} onClick={() => setReview(true)}>Review permissions</button>}</div>
    </>}
  </div></Modal>;
}
export default function Admins() {
  const state = useData(useCallback((signal: AbortSignal) => snapshot('auth', signal), []));
  const permissions = usePermissions(), { session } = useAuth();
  const [selected, setSelected] = useState<Row | null>(null), [notice, setNotice] = useState('');
  const superAdmin = permissions.state.status === 'ready' && permissions.state.data.isSuperAdmin;
  const ownId = session.status === 'authenticated' ? session.admin.id : null;
  return <div className="fleet-module"><header className="fleet-banner"><h1>Admin management</h1><p>Administrator accounts and explicit permission grants</p></header><div className="fleet-heading"><h2>Administrators</h2><button disabled={state.loading} onClick={state.refresh}>Refresh</button></div><p className="fleet-note">Manage team access. Your own account and administrator roles are protected.</p>{notice && <p role="status">{notice}</p>}
    <Records title="Administrators" data={state.data ?? []} keys={['fullName', 'username', 'email', 'isSuperAdmin']} loading={state.loading} error={state.error} refresh={state.refresh} actions={superAdmin && permissions.can('admins.edit') ? row => row.id !== ownId && row.isSuperAdmin !== true ? <button className="btn-soft-primary" onClick={() => setSelected(row)}>Edit permissions</button> : <span>Protected account</span> : undefined} />
    {selected && <PermissionEditor admin={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); setNotice('Permissions saved. Records refreshed.'); state.refresh(); permissions.retry(); }} />}
  </div>;
}
