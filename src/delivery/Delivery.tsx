import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Table, type Column } from '../components/Table';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState, LoadingState, EmptyState } from '../components/States';
import { usePermissions } from '../permissions/PermissionsContext';
import { date } from '../customers/CustomerDetails';
import { RecordDetails, money } from '../fines/RecordDetails';
import { DeliveryForm } from './DeliveryForm';
import { activeDeliveries, available, canAssign, canCancel, child, detail, list, remove, reservationAction, save, statuses, type Resource, type Row } from './deliveryApi';
import '../fines/fines.css';
import './delivery.css';

const DeliveryMap = lazy(() => import('./DeliveryMap'));
const message = (cause: unknown) => cause instanceof Error ? cause.message : 'Unable to complete the request.';
type View = Resource | 'map';
type Action = { type: 'cancel'; value: string } | { type: 'assign-driver'; value: number } | { type: 'save'; value: Record<string, unknown> } | { type: 'delete' };
const titles: Record<View, string> = { reservations: 'Reservations', deliveryDrivers: 'Drivers', deliveryZones: 'Zones', map: 'Active deliveries' };

export default function Delivery({ mode }: { mode: 'reservations' | 'delivery' }) {
  const { can } = usePermissions();
  const [view, setView] = useState<View>(mode === 'reservations' ? 'reservations' : 'deliveryDrivers');
  const [rows, setRows] = useState<Row[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [revision, setRevision] = useState(0), [search, setSearch] = useState(''), [filter, setFilter] = useState(''), [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: 'id', order: 'desc' as 'asc' | 'desc' });
  const [selected, setSelected] = useState<Row | null>(null), [detailLoading, setDetailLoading] = useState(false), [detailError, setDetailError] = useState('');
  const [creating, setCreating] = useState(false), [editing, setEditing] = useState(false), [assigning, setAssigning] = useState(false);
  const [drivers, setDrivers] = useState<Row[]>([]), [zones, setZones] = useState<Row[]>([]), [optionError, setOptionError] = useState(''), [optionLoading, setOptionLoading] = useState(false);
  const [driverId, setDriverId] = useState(''), [reason, setReason] = useState(''), [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false), [actionError, setActionError] = useState(''), [notice, setNotice] = useState(''), [needsRefresh, setNeedsRefresh] = useState(false);
  const lock = useRef(false), detailAbort = useRef<AbortController | null>(null), optionsAbort = useRef<AbortController | null>(null);
  const resource: Resource = view === 'map' ? 'reservations' : view;
  const permission = resource === 'reservations' ? 'reservations' : 'delivery';
  const refresh = () => setRevision(value => value + 1);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setRows([]);
    (view === 'map' ? activeDeliveries(controller.signal) : list(view, controller.signal)).then(value => {
      if (!controller.signal.aborted) setRows(value);
    }).catch(cause => { if (!controller.signal.aborted) setError(message(cause)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [view, revision]);
  useEffect(() => () => { detailAbort.current?.abort(); optionsAbort.current?.abort(); }, []);
  function close() {
    if (lock.current) return;
    detailAbort.current?.abort(); optionsAbort.current?.abort(); setSelected(null); setCreating(false); setEditing(false); setAssigning(false); setAction(null); setActionError('');
  }
  async function open(row: Row) {
    detailAbort.current?.abort(); optionsAbort.current?.abort();
    const controller = new AbortController(); detailAbort.current = controller;
    setSelected(row); setDetailLoading(true); setDetailError(''); setEditing(false); setAssigning(false); setAction(null); setActionError(''); setNeedsRefresh(false); setReason(''); setNotice('');
    try { const fresh = await detail(resource, row.id, controller.signal); if (!controller.signal.aborted) setSelected(fresh); }
    catch (cause) { if (!controller.signal.aborted) setDetailError(message(cause)); }
    finally { if (!controller.signal.aborted) setDetailLoading(false); }
  }
  async function options(kind: 'assign' | 'form') {
    optionsAbort.current?.abort(); const controller = new AbortController(); optionsAbort.current = controller;
    setOptionError(''); setOptionLoading(true); setDriverId('');
    try {
      if (kind === 'assign') {
        const [all, deliveries] = await Promise.all([list('deliveryDrivers', controller.signal), activeDeliveries(controller.signal)]);
        if (!controller.signal.aborted) setDrivers(all.filter(row => available(row) && !deliveries.some(item => item.driverId === row.id)));
      } else if (resource === 'deliveryDrivers') {
        const data = await list('deliveryZones', controller.signal); if (!controller.signal.aborted) setZones(data);
      }
    } catch (cause) { if (!controller.signal.aborted) setOptionError(message(cause)); }
    finally { if (!controller.signal.aborted) setOptionLoading(false); }
  }
  async function confirm() {
    if (!action || lock.current || needsRefresh || !can(`${permission}.${action.type === 'delete' ? 'delete' : creating ? 'create' : 'edit'}`)) return;
    lock.current = true; setBusy(true); setActionError(''); let saved = false;
    try {
      let nextId = selected?.id;
      if (action.type === 'save' && resource !== 'reservations') {
        const result = await save(resource, action.value, creating ? undefined : selected ?? undefined); nextId = result.id; setSelected(result);
      } else if (selected && action.type === 'delete' && resource !== 'reservations') await remove(resource, selected);
      else if (selected && (action.type === 'cancel' || action.type === 'assign-driver')) await reservationAction(selected, action.type, action.type === 'cancel' ? reason : action.value);
      else throw new Error('Choose a valid action.');
      saved = true; setAction(null); setCreating(false); setEditing(false); setAssigning(false); refresh();
      if (action.type === 'delete') setSelected(null);
      else if (nextId) setSelected(await detail(resource, nextId));
      // Fresh related records are fetched on next navigation; assignment options never reuse an old list.
      setNotice('Saved. The latest records have been loaded.');
    } catch (cause) { setNeedsRefresh(true); setActionError((saved ? 'Saved, but refresh failed. ' : '') + message(cause)); }
    finally { lock.current = false; setBusy(false); }
  }
  const filtered = rows.filter(row => (!filter || (resource === 'deliveryZones' ? String(row.isActive) === filter : row.status === filter)) && Object.values(row).some(value => typeof value !== 'object' && String(value ?? '').toLowerCase().includes(search.trim().toLowerCase()))).sort((a, b) => {
    const x = a[sort.key], y = b[sort.key]; const value = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''));
    return sort.order === 'asc' ? value : -value;
  });
  const link = (row: Row) => <button className="table-link" onClick={() => void open(row)}>{resource === 'reservations' ? `#${row.id}` : String(row.fullName ?? row.name)}</button>;
  const columns: Column<Row>[] = resource === 'reservations' ? [
    { key: 'id', label: 'Reservation', render: link }, { key: 'customerName', label: 'Customer', sortable: true }, { key: 'plateNumber', label: 'Plate' },
    { key: 'status', label: 'Status', render: row => <StatusBadge status={String(row.status)} /> }, { key: 'driverName', label: 'Driver' },
    { key: 'scheduledDeliveryDate', label: 'Scheduled · Dubai', sortable: true, render: row => date(row.scheduledDeliveryDate) },
    ...(view === 'map' ? [] : [{ key: 'totalPrice', label: 'Amount', sortable: true, render: (row: Row) => money(row.totalPrice) }]),
  ] : resource === 'deliveryDrivers' ? [
    { key: 'fullName', label: 'Driver', render: link, sortable: true }, { key: 'phoneNumber', label: 'Phone' }, { key: 'status', label: 'Status', render: row => <StatusBadge status={String(row.status)} /> },
    { key: 'isActive', label: 'Enabled', render: row => row.isActive ? 'Yes' : 'No' }, { key: 'activeDeliveries', label: 'Active deliveries', sortable: true }, { key: 'zoneId', label: 'Zone ID' },
  ] : [
    { key: 'name', label: 'Zone', render: link, sortable: true }, { key: 'centerLat', label: 'Latitude' }, { key: 'centerLng', label: 'Longitude' },
    { key: 'radiusKm', label: 'Radius · km', sortable: true }, { key: 'driverCount', label: 'Drivers' }, { key: 'isActive', label: 'Status', render: row => <StatusBadge status={row.isActive ? 'Active' : 'Inactive'} /> },
  ];
  return <section className="delivery-module"><header className="delivery-heading"><div><h1>{mode === 'reservations' ? 'Reservations' : 'Delivery'}</h1><p>{mode === 'reservations' ? 'Bookings, driver assignment and delivery progress' : 'Driver availability and delivery areas'}</p></div><div className="delivery-actions"><button onClick={refresh}><Icon name="refresh" />Refresh</button>{resource !== 'reservations' && can('delivery.create') && <button className="primary-button" onClick={() => { setCreating(true); setNeedsRefresh(false); setDetailError(''); setActionError(''); setNotice(''); void options('form'); }}><Icon name="plus" />Add {resource === 'deliveryDrivers' ? 'driver' : 'zone'}</button>}</div></header>
    <nav className="delivery-tabs" aria-label="Delivery views">{(mode === 'reservations' ? ['reservations', 'map'] as View[] : ['deliveryDrivers', 'deliveryZones'] as View[]).map(tab => <button key={tab} aria-pressed={view === tab} onClick={() => { setView(tab); setSearch(''); setFilter(''); setPage(1); setNotice(''); }}>{titles[tab]}</button>)}</nav>
    {notice && !selected && <p role="status">{notice}</p>}
    {view === 'map' && !loading && !error && (rows.length ? <Suspense fallback={<LoadingState />}><DeliveryMap rows={rows} /></Suspense> : <EmptyState />)}
    <Table caption={titles[view]} columns={columns} data={filtered.slice((page - 1) * 10, page * 10)} total={filtered.length} rowKey={row => row.id} page={page} pageSize={10} loading={loading} error={error || null} search={search} sortBy={sort.key} sortOrder={sort.order} onPageChange={setPage} onSearch={setSearch} onRetry={refresh} onSort={(key, order) => setSort({ key, order })} onRowClick={row => void open(row)} filters={<><label>Status<select value={filter} onChange={event => { setFilter(event.target.value); setPage(1); }}><option value="">All statuses</option>{(resource === 'deliveryZones' ? ['true', 'false'] : resource === 'deliveryDrivers' ? ['Online', 'Offline', 'Busy'] : statuses).map(status => <option key={status} value={status}>{status === 'true' ? 'Active' : status === 'false' ? 'Inactive' : status}</option>)}</select></label><label>Sort by<select value={sort.key} onChange={event => { setSort({ ...sort, key: event.target.value }); setPage(1); }}><option value="id">ID</option>{columns.filter(column => column.sortable).map(column => <option key={column.key} value={column.key}>{column.label}</option>)}</select></label><label>Order<select value={sort.order} onChange={event => setSort({ ...sort, order: event.target.value as 'asc' | 'desc' })}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label></>} />
    <Modal isOpen={!!selected || creating} title={creating ? `New ${resource === 'deliveryDrivers' ? 'driver' : 'zone'}` : `${resource === 'reservations' ? 'Reservation' : resource === 'deliveryDrivers' ? 'Driver' : 'Zone'} #${selected?.id}`} onClose={close}>
      <div className="delivery-detail incident-detail">{actionError && <ErrorState message={actionError} onRetry={() => { setAction(null); if (selected) void open(selected); else { setNeedsRefresh(false); setActionError(''); } }} />}{notice && <p role="status">{notice}</p>}
      {detailLoading && !creating ? <LoadingState /> : detailError && !creating ? <ErrorState message={detailError} onRetry={() => selected && void open(selected)} /> : <>
        {selected && !creating && <><header className="delivery-summary"><div><h3>{String(selected.customerName ?? selected.fullName ?? selected.name ?? `#${selected.id}`)}</h3><p>{String(selected.carName ?? selected.phoneNumber ?? 'Delivery zone')}</p><StatusBadge status={String(selected.status ?? (selected.isActive ? 'Active' : 'Inactive'))} /></div>{resource === 'reservations' && <strong>{money(selected.totalPrice)}</strong>}</header>
        <div className="delivery-actions"><button disabled={busy} onClick={() => void open(selected)}><Icon name="refresh" />Refresh details</button>{resource === 'reservations' ? <>{can('reservations.edit') && canAssign(selected) && <button className="primary-button" disabled={busy || needsRefresh || !!action} onClick={() => { setAssigning(true); void options('assign'); }}>Assign driver</button>}{can('reservations.edit') && canCancel(selected) && <button className="btn-danger" disabled={busy || needsRefresh || !!action} onClick={() => { setAssigning(false); setAction({ type: 'cancel', value: '' }); }}>Cancel reservation</button>}</> : <>{can('delivery.edit') && <button disabled={busy || needsRefresh || !!action} onClick={() => { setEditing(true); void options('form'); }}><Icon name="edit" />Edit</button>}{can('delivery.delete') && <button className="btn-danger" disabled={busy || needsRefresh || !!action} onClick={() => { setEditing(false); setAction({ type: 'delete' }); }}><Icon name="trash" />Delete</button>}</>}</div></>}
        {(creating || editing || assigning) && optionLoading ? <LoadingState /> : (creating || editing || assigning) && optionError ? <ErrorState message={optionError} onRetry={() => void options(assigning ? 'assign' : 'form')} /> : <>
          {(creating || editing) && !action && resource !== 'reservations' && <DeliveryForm resource={resource} row={creating ? undefined : selected ?? undefined} zones={zones} busy={busy || needsRefresh} onSave={value => setAction({ type: 'save', value })} onCancel={() => creating ? close() : setEditing(false)} />}
          {assigning && !action && <section className="delivery-card"><h3>Choose an available driver</h3>{drivers.length ? <><label>Driver<select value={driverId} onChange={event => setDriverId(event.target.value)}><option value="">Choose driver</option>{drivers.map(driver => <option key={driver.id} value={driver.id}>{String(driver.fullName)} · {String(driver.phoneNumber)}</option>)}</select></label><button className="primary-button" disabled={!driverId || needsRefresh} onClick={() => setAction({ type: 'assign-driver', value: Number(driverId) })}>Review assignment</button></> : <EmptyState message="No available Online drivers. Update availability in Delivery, then refresh this list." />}</section>}
        </>}
        {action && <section className="delivery-confirm"><h3>{action.type === 'delete' ? 'Delete permanently?' : action.type === 'cancel' ? 'Cancel this reservation?' : action.type === 'assign-driver' ? 'Assign this driver?' : 'Save these changes?'}</h3><p>{action.type === 'delete' ? 'This record will be permanently deleted. This cannot be undone.' : action.type === 'cancel' ? 'The reservation will be cancelled and its driver allocation updated.' : action.type === 'assign-driver' ? `${drivers.find(driver => driver.id === action.value)?.fullName ?? `Driver #${action.value}`} will become Busy.` : 'Review the details below before saving.'}</p>
          {action.type === 'cancel' && <label>Reason (optional)<textarea maxLength={500} value={reason} onChange={event => setReason(event.target.value)} disabled={busy} /></label>}
          {action.type === 'save' && <RecordDetails row={action.value} />}
          <div className="delivery-actions"><button disabled={busy} onClick={() => setAction(null)}>Back</button><button className={['cancel', 'delete'].includes(action.type) ? 'btn-danger' : 'primary-button'} disabled={busy || needsRefresh} onClick={() => void confirm()}>{busy ? 'Saving…' : 'Confirm action'}</button></div></section>}
        {selected && !editing && <><section className="delivery-card"><h3>Record details</h3><RecordDetails row={Object.fromEntries(Object.entries(selected).filter(([key]) => !['user', 'car', 'driver', 'zone', 'activeReservations'].includes(key)))} />{resource === 'reservations' && selected.status === 'Cancelled' && <p>Cancellation reason: {String(selected.cancelReason ?? 'Not returned by the API')}</p>}</section>{['user', 'car', 'driver', 'zone', 'activeReservations'].filter(key => key in selected).map(key => <details className="delivery-card" key={key}><summary>{({ user: 'Customer', car: 'Vehicle', driver: 'Driver', zone: 'Zone', activeReservations: 'Active reservations' } as Record<string, string>)[key]}</summary>{selected[key] == null ? <p>—</p> : <RecordDetails row={Array.isArray(selected[key]) ? { records: selected[key] } : child(selected[key])} />}</details>)}</>}
      </>}
      </div>
    </Modal>
  </section>;
}
