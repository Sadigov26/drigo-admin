import { useCallback, useState } from 'react';
import { usePromotionData as useData } from '../promotions/usePromotionData';
import { usePermissions } from '../permissions/PermissionsContext';
import { Icon } from '../components/Icon';
import { snapshot, type Row } from './fleetApi';
import { Records } from './FleetShared';
import { RecordEditor } from './RecordEditor';

export function ResourceList({ title, path, keys, editable = false, createOnly = false, note, children }: {
  title: string; path: string; keys: string[]; editable?: boolean; createOnly?: boolean; note?: string; children?: (rows: Row[]) => React.ReactNode;
}) {
  const state = useData(useCallback((signal: AbortSignal) => snapshot(path, signal), [path]));
  const { can } = usePermissions();
  const scope = path === 'geozones' ? 'fleet' : 'settings';
  const [edit, setEdit] = useState<{ row: Row | null; remove?: boolean } | null>(null);
  const [notice, setNotice] = useState('');
  return <section className="fleet-resource"><div className="fleet-heading"><h2>{title}</h2><div className="fleet-actions"><button onClick={state.refresh} disabled={state.loading}><Icon name="refresh" />Refresh</button>{editable && can(`${scope}.create`) && <button className="btn-primary" onClick={() => setEdit({ row: null })}><Icon name="plus" />Add {path === 'geozones' ? 'zone' : path.endsWith('campaigns') ? 'campaign' : 'notification'}</button>}</div></div>
    {note && <p className="fleet-note">{note}</p>}{notice && <p role="status">{notice}</p>}
    {!state.loading && !state.error && state.data && children?.(state.data)}
    <Records title={title} data={state.data ?? []} loading={state.loading} error={state.error} refresh={state.refresh} keys={keys} filterStatus={keys.includes('status')} actions={editable && (can(`${scope}.edit`) && !createOnly || can(`${scope}.delete`)) ? row => <>{!createOnly && can(`${scope}.edit`) && <button className="btn-soft-primary" onClick={() => setEdit({ row })}><Icon name="edit" />Edit</button>}{can(`${scope}.delete`) && <button className="btn-soft-danger" onClick={() => setEdit({ row, remove: true })}><Icon name="trash" />Delete</button>}</> : undefined} />
    {edit && <RecordEditor path={path} record={edit.row} remove={edit.remove} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); setNotice('Change saved. Loading the latest records…'); state.refresh(); }} />}
  </section>;
}
