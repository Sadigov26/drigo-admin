import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePromotionData as useData } from '../promotions/usePromotionData';
import { usePermissions } from '../permissions/PermissionsContext';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { Icon } from '../components/Icon';
import { CompactTable, Fields, Records, label, valueView } from '../fleet/FleetShared';
import { read, object, snapshot, type Action, type Row } from './operationsApi';
import { ActionDialog } from './ActionDialog';
import '../fleet/fleet.css';
import './operations.css';

export function RemotePanel({ title, path }: { title: string; path: string }) {
  const state = useData(useCallback(async (signal: AbortSignal) => { const result = await read(path, signal); return Array.isArray(result) ? { records: result.map(object) } : object(result); }, [path]));
  return <section className="fleet-panel"><div className="fleet-heading"><h2>{title}</h2><button disabled={state.loading} onClick={state.refresh}><Icon name="refresh" />Refresh</button></div>{state.loading ? <LoadingState /> : state.error ? <ErrorState message={state.error} onRetry={state.refresh} /> : !state.data || !Object.keys(state.data).length ? <EmptyState /> : <><Fields row={Object.fromEntries(Object.entries(state.data).filter(([, value]) => !Array.isArray(value)))} />{Object.entries(state.data).filter(([, value]) => Array.isArray(value)).map(([key, value]) => { const list = value as unknown[]; const records = list.every(item => item && typeof item === 'object' && !Array.isArray(item)); return <details key={key} className="ops-records"><summary>{label(key)} · {list.length} {list.length === 1 ? 'record' : 'records'}</summary>{!list.length ? <p className="rental-empty">None.</p> : records ? <CompactTable rows={list as Row[]} /> : <>{valueView(list, key)}</>}</details>; })}</>}</section>;
}
export function OpsList({ title, path, keys, actionFor, addAction, permission = 'fleet.edit', actionPermission, version = 0, onChange }: {
  title: string; path: string; keys: string[] | ((rows: Row[]) => string[]); actionFor?: (row: Row, rows: Row[]) => Action | null; addAction?: Action; permission?: string; actionPermission?: string; version?: number; onChange?: () => void;
}) {
  const state = useData(useCallback((signal: AbortSignal) => snapshot(path, signal), [path, version]));
  const { can } = usePermissions();
  const [action, setAction] = useState<Action | null>(null), [notice, setNotice] = useState('');
  return <section className="fleet-resource"><div className="fleet-heading"><h2>{title}</h2><div className="fleet-actions"><button disabled={state.loading} onClick={state.refresh}><Icon name="refresh" />Refresh</button>{addAction && can(permission) && <button className="btn-primary" onClick={() => setAction(addAction)}><Icon name="plus" />{addAction.title}</button>}</div></div>{notice && <p role="status">{notice}</p>}
    <Records title={title} keys={typeof keys === 'function' ? keys(state.data ?? []) : keys} data={state.data ?? []} loading={state.loading} error={state.error} refresh={state.refresh} filterStatus={(typeof keys === 'function' ? keys(state.data ?? []) : keys).includes('status')} actions={actionFor && can(actionPermission ?? permission) ? row => { const item = actionFor(row, state.data ?? []); return item ? <button className={item.danger ? 'btn-soft-danger' : 'btn-soft-primary'} onClick={() => setAction(item)}>{item.title}</button> : null; } : undefined} />
    {action && <ActionDialog action={action} onClose={() => setAction(null)} onSaved={() => { setAction(null); setNotice('Change saved. Reloading server data…'); state.refresh(); onChange?.(); }} />}
  </section>;
}
function Cleanings() {
  const [version, setVersion] = useState(0);
  return <><RemotePanel key={version} title="Cleaning statistics" path="cleanings/stats" /><OpsList title="Cleanings" path="cleanings" keys={['plateNumber', 'type', 'status', 'scheduledAt', 'assignedTo', 'cost']} onChange={() => setVersion(v => v + 1)} actionFor={row => ['Scheduled', 'InProgress'].includes(String(row.status)) ? { title: 'Cancel cleaning', path: `cleanings/${row.id}/cancel`, method: 'PUT', fields: [], initial: {}, kind: 'cleaning', danger: true, note: `Cancel cleaning #${row.id} for ${row.plateNumber}? Completed and cancelled cleanings cannot be cancelled here.` } : null} /></>;
}
function ProblemReports() {
  return <OpsList title="Problem reports" path="problemreports" keys={['id', 'plateNumber', 'userName', 'category', 'severity', 'status', 'createdAt']} actionFor={row => {
    const statuses = ['Open', 'InProgress', 'Resolved', 'Dismissed'];
    return statuses.length > 1 ? { title: 'Change status', path: `problemreports/${row.id}/status`, method: 'PUT', fields: [{ key: 'status', label: 'Status', type: 'select', options: statuses, required: true }], initial: { status: row.status }, note: `Report #${row.id}` } : null;
  }} />;
}
function Scraper() {
  const state = useData(useCallback(async (signal: AbortSignal) => object(await read('scraper/status', signal)), []));
  const { can } = usePermissions(), [action, setAction] = useState<Action | null>(null);
  const sources = Array.isArray(state.data?.sources) ? state.data.sources.map(object) : [];
  return <section className="fleet-panel"><div className="fleet-heading"><h2>Scraper status</h2><button disabled={state.loading} onClick={state.refresh}>Refresh</button></div>{state.loading ? <LoadingState /> : state.error ? <ErrorState message={state.error} onRetry={state.refresh} /> : state.data && <><Fields row={state.data} /><div className="ops-trigger-grid">{sources.map(source => <button key={String(source.source)} disabled={!can('fleet.edit') || state.data?.running === true} onClick={() => setAction({ title: `Trigger ${source.source}`, path: `scraper/trigger/${encodeURIComponent(String(source.source))}`, method: 'GET', fields: [], initial: {}, kind: 'scraper', note: 'Start a new collection run for this source?' })}>{String(source.source)} · Trigger</button>)}</div></>}{action && <ActionDialog action={action} onClose={() => setAction(null)} onSaved={() => { setAction(null); state.refresh(); }} />}</section>;
}
const tabs = ['Cleanings', 'Car reports', 'Problem reports', 'Car services', 'Scraper', 'Monitoring', 'Business inquiries', 'Employees', 'Connected devices', 'Exit surveys'];
export default function Operations() {
  const [params, setParams] = useSearchParams(), tab = tabs.includes(params.get('view') ?? '') ? params.get('view')! : tabs[0];
  return <div className="fleet-module"><header className="fleet-banner"><h1>Operations</h1><p>Cleaning, maintenance, service health and field activity</p></header><div className="fleet-tabs" aria-label="Operations views">{tabs.map(name => <button key={name} aria-pressed={tab === name} onClick={() => setParams({ view: name })}>{name}</button>)}</div><div key={tab}>
    {tab === 'Cleanings' ? <Cleanings /> : tab === 'Car reports' ? <OpsList title="Car reports" path="car-reports" keys={['id', 'plateNumber', 'userName', 'type', 'status', 'createdAt']} /> : tab === 'Problem reports' ? <ProblemReports /> : tab === 'Car services' ? <OpsList title="Car services" path="car-services" keys={['id', 'plateNumber', 'type', 'status', 'scheduledAt', 'cost']} /> : tab === 'Scraper' ? <Scraper /> : tab === 'Monitoring' ? <>{['overview', 'database', 'redis', 'docker', 'teltonika'].map(name => <RemotePanel key={name} title={({ overview: 'Service overview', database: 'Data storage', redis: 'Cache performance', docker: 'Background services', teltonika: 'Vehicle connectivity' })[name] ?? name} path={`monitoring/${name}`} />)}</> : tab === 'Business inquiries' ? <OpsList title="Business inquiries" path="businessinquiries" keys={['companyName', 'contactName', 'email', 'status', 'createdAt']} actionFor={row => ({ title: 'Change status', path: `businessinquiries/${row.id}/status`, method: 'PUT', fields: [{ key: 'status', label: 'Status', type: 'select', options: ['New', 'Contacted', 'Qualified', 'Closed', 'Rejected'], required: true }], initial: { status: row.status }, note: String(row.companyName) })} /> : tab === 'Employees' ? <OpsList title="Employees" path="employees" keys={['fullName', 'role', 'phoneNumber', 'isActive', 'createdAt']} /> : tab === 'Connected devices' ? <OpsList title="Connected devices" path="cars/connected-devices" keys={['plateNumber', 'imei', 'deviceType', 'online', 'lastPingAt']} /> : <OpsList title="Exit surveys" path="exit-surveys" keys={['id', 'userId', 'rating', 'reason', 'createdAt']} />}
  </div></div>;
}
