import { useEffect, useRef, useState } from 'react';
import { Table, type Column } from '../components/Table';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState, LoadingState } from '../components/States';
import { usePermissions } from '../permissions/PermissionsContext';
import { date } from '../customers/CustomerDetails';
import { RecordDetails, money } from './RecordDetails';
import { AccidentForm } from './AccidentForm';
import { accidentStatuses, fineStatuses, views, loadRecords, syncStatus, carDetails, applyFine, saveAccident, deleteAccident, type View, type RecordRow, type FineAction, type AccidentInput } from './finesApi';
import './fines.css';

const message = (cause: unknown) => cause instanceof Error ? cause.message : 'Unable to load records.';
type Action = FineAction | 'delete' | AccidentInput;
export default function Fines() {
  const { can } = usePermissions();
  const [view, setView] = useState<View>('Manual fines');
  const [rows, setRows] = useState<RecordRow[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [revision, setRevision] = useState(0), [search, setSearch] = useState(''), [status, setStatus] = useState(''), [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: 'id', order: 'desc' as 'asc' | 'desc' });
  const [sync, setSync] = useState<Record<string, unknown> | null>(null), [syncError, setSyncError] = useState('');
  const [selected, setSelected] = useState<RecordRow | null>(null), [detailLoading, setDetailLoading] = useState(false), [detailError, setDetailError] = useState('');
  const [car, setCar] = useState<Record<string, unknown> | null>(null), [editing, setEditing] = useState(false), [creating, setCreating] = useState(false);
  const [action, setAction] = useState<Action | null>(null), [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [actionError, setActionError] = useState(''), [needsRefresh, setNeedsRefresh] = useState(false);
  const lock = useRef(false), detailAbort = useRef<AbortController | null>(null);
  const refresh = () => setRevision(value => value + 1);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setRows([]); setSync(null); setSyncError('');
    loadRecords(view, controller.signal).then(data => { if (!controller.signal.aborted) setRows(data); }).catch(cause => { if (!controller.signal.aborted) setError(message(cause)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    if (view === 'Scraper') syncStatus(controller.signal).then(data => { if (!controller.signal.aborted) setSync(data); }).catch(cause => { if (!controller.signal.aborted) setSyncError(message(cause)); });
    return () => controller.abort();
  }, [view, revision]);
  useEffect(() => () => detailAbort.current?.abort(), []);
  async function open(row: RecordRow) {
    detailAbort.current?.abort(); const controller = new AbortController(); detailAbort.current = controller;
    setSelected(row); setCar(null); setEditing(false); setAction(null); setActionError(''); setNotice(''); setNeedsRefresh(false); setDetailError(''); setDetailLoading(true);
    try {
      if (view === 'Car fines') { const data = await carDetails(row.id, controller.signal); if (!controller.signal.aborted) setCar(data); }
      else {
        const current = (await loadRecords(view === 'Accidents' ? 'Accidents' : 'Manual fines', controller.signal)).find(item => item.id === row.id);
        if (!current) throw new Error('Record no longer exists.');
        if (!controller.signal.aborted) setSelected(current);
      }
    } catch (cause) { if (!controller.signal.aborted) setDetailError(message(cause)); }
    finally { if (!controller.signal.aborted) setDetailLoading(false); }
  }
  function close() { if (lock.current) return; detailAbort.current?.abort(); setSelected(null); setCreating(false); setEditing(false); setAction(null); setActionError(''); }
  async function confirm() {
    if (!action || lock.current || needsRefresh) return;
    if (!(typeof action === 'object' ? can(creating ? 'fines.create' : 'fines.edit') : can(action === 'delete' ? 'fines.delete' : 'fines.edit'))) return;
    lock.current = true; setBusy(true); setActionError('');
    let saved = false;
    try {
      let id = selected?.id;
      if (typeof action === 'object') { const result = await saveAccident(action, creating ? undefined : selected ?? undefined); id = Number(result.id); setSelected({ ...result, id }); }
      else if (selected) { if (action === 'delete') await deleteAccident(selected); else await applyFine(selected, action); }
      else throw new Error('Select a record first.');
      saved = true; setAction(null); setEditing(false); setCreating(false); refresh();
      if (action === 'delete') setSelected(null);
      else {
        const fresh = (await loadRecords(view === 'Accidents' ? 'Accidents' : 'Manual fines')).find(row => row.id === id);
        if (!fresh) throw new Error('Updated record could not be reloaded.');
        setSelected(fresh);
      }
      setNotice('Saved. Records have been refreshed.');
    } catch (cause) { setNeedsRefresh(true); setActionError((saved ? 'Saved, but refresh failed. ' : '') + message(cause)); }
    finally { lock.current = false; setBusy(false); }
  }
  const filtered = rows.filter(row => (!status || row.status === status) && Object.values(row).some(value => typeof value !== 'object' && String(value ?? '').toLowerCase().includes(search.trim().toLowerCase()))).sort((a, b) => {
    const x = a[sort.key], y = b[sort.key]; const result = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''));
    return sort.order === 'asc' ? result : -result;
  });
  const link = (row: RecordRow) => <button className="table-link" onClick={() => void open(row)}>{view === 'Car fines' ? String(row.plateNumber ?? row.id) : `#${row.id}`}</button>;
  const columns: Column<RecordRow>[] = view === 'Car fines' ? [
    { key: 'id', label: 'Plate', render: link }, { key: 'carName', label: 'Vehicle' }, { key: 'totalFines', label: 'Portal fine count' }, { key: 'totalAmount', label: 'Portal amount', sortable: true, render: row => money(row.totalAmount) }, { key: 'portalStatus', label: 'Portal status', render: row => <StatusBadge status={String(row.portalStatus ?? '')} /> }, { key: 'lastSyncedAt', label: 'Last sync · Dubai', render: row => date(row.lastSyncedAt) },
  ] : view === 'Accidents' ? [
    { key: 'id', label: 'Accident', render: link }, { key: 'carId', label: 'Car ID' }, { key: 'description', label: 'Description' }, { key: 'estimatedCost', label: 'Estimated cost', sortable: true, render: row => money(row.estimatedCost) }, { key: 'status', label: 'Status', render: row => <StatusBadge status={String(row.status ?? '')} /> }, { key: 'accidentDate', label: 'Date · Dubai', sortable: true, render: row => date(row.accidentDate) },
  ] : [
    { key: 'id', label: 'Fine', render: link }, { key: 'plateNumber', label: 'Plate' }, { key: 'type', label: 'Type' }, { key: 'amount', label: 'Amount', sortable: true, render: row => money(row.amount) }, { key: 'status', label: 'Status', render: row => <StatusBadge status={String(row.status ?? '')} /> }, { key: 'fineDate', label: 'Date · Dubai', sortable: true, render: row => date(row.fineDate) },
  ];
  return <section className="incidents"><header className="incident-heading"><div><h1>Fines &amp; Accidents</h1><p>Traffic charges and incident records</p></div><div className="incident-actions"><button onClick={refresh}><Icon name="refresh" />Refresh</button>{view === 'Accidents' && can('fines.create') && <button className="primary-button" onClick={() => { setCreating(true); setNeedsRefresh(false); setActionError(''); setNotice(''); }}><Icon name="plus" />Add accident</button>}</div></header>
    <div className="incident-tabs" aria-label="Fine and accident views">{views.map(tab => <button key={tab} aria-pressed={view === tab} onClick={() => { setView(tab); setStatus(''); setSearch(''); setPage(1); setSort({ key: 'id', order: 'desc' }); setNotice(''); }}>{tab}</button>)}</div>
    {notice && !selected && <p role="status">{notice}</p>}
    {view === 'Scraper' && <section className="incident-card incident-sync"><h2>Source sync</h2>{syncError ? <ErrorState message={syncError} onRetry={refresh} /> : sync ? <><div className="incident-sync-grid"><div><span>Last sync · Dubai</span><strong>{date(sync.lastSyncAt)}</strong></div><div><span>Sync status</span><StatusBadge status={String(sync.status ?? '')} /></div><div><span>Pending fines</span><strong>{String(sync.pendingCount ?? '—')}</strong></div><div><span>Scraper records</span><strong>{loading || error ? '—' : rows.length}</strong></div></div><div className="incident-sources"><span>Sources</span>{Array.isArray(sync.sources) ? sync.sources.map((source, index) => <span className="incident-source" key={index}>{String(source)}</span>) : <span>—</span>}</div></> : <LoadingState />}</section>}
    <Table caption={view} columns={columns} data={filtered.slice((page - 1) * 10, page * 10)} rowKey={row => row.id} total={filtered.length} page={page} pageSize={10} loading={loading} error={error || null} search={search} sortBy={sort.key} sortOrder={sort.order} onPageChange={setPage} onSearch={setSearch} onSort={(key, order) => setSort({ key, order })} onRetry={refresh} onRowClick={row => void open(row)} filters={view !== 'Car fines' && <label>Status<select aria-label="Status filter" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option>{(view === 'Accidents' ? accidentStatuses : fineStatuses).map(item => <option key={item}>{item}</option>)}</select></label>} />
    <Modal isOpen={!!selected || creating} title={creating ? 'New accident' : `${view === 'Accidents' ? 'Accident' : view === 'Car fines' ? 'Car fines' : 'Fine'} #${selected?.id}`} onClose={close}>
      <div className="incident-detail">
      {actionError && <ErrorState message={actionError} onRetry={() => { setAction(null); if (selected) void open(selected); else { setNeedsRefresh(false); setActionError(''); } }} />}
      {notice && <p role="status">{notice}</p>}
      {detailLoading && !creating ? <LoadingState /> : detailError && !creating ? <ErrorState message={detailError} onRetry={() => selected && void open(selected)} /> : <>
        {selected && !creating && <header className="incident-summary"><div><p>{view === 'Accidents' ? 'Incident record' : view === 'Car fines' ? 'Vehicle fine account' : String(selected.source ?? 'Traffic fine')}</p><h3>{String(selected.plateNumber ?? car?.plateNumber ?? `Car #${selected.carId ?? '—'}`)}</h3><StatusBadge status={String(selected.status ?? selected.portalStatus ?? '')} /></div><div><p>{view === 'Accidents' ? 'Estimated cost' : 'Amount · AED'}</p><strong>{money(view === 'Accidents' ? selected.estimatedCost : view === 'Car fines' ? car?.totalAmount : selected.amount)}</strong></div></header>}
        {!creating && selected && <div className="incident-actions"><button disabled={busy} onClick={() => void open(selected)}><Icon name="refresh" />Refresh details</button>
          {view === 'Accidents' ? <>{can('fines.edit') && <button disabled={busy || needsRefresh || !!action} onClick={() => setEditing(true)}><Icon name="edit" />Edit accident</button>}{can('fines.delete') && <button className="btn-danger" disabled={busy || needsRefresh || !!action} onClick={() => setAction('delete')}><Icon name="trash" />Delete</button>}</> : view !== 'Car fines' && can('fines.edit') && ['Pending', 'Review'].includes(String(selected.status)) && <>
            <button className="primary-button" disabled={busy || needsRefresh || !!action || !selected.userId} onClick={() => setAction('bill-customer')}>Bill customer</button><button disabled={busy || needsRefresh || !!action} onClick={() => setAction('bill-company')}>Bill company</button><button className="btn-danger" disabled={busy || needsRefresh || !!action} onClick={() => setAction('dismiss')}>Dismiss</button>
            {!selected.userId && <span>No linked customer for billing.</span>}
          </>}
        </div>}
        {(creating || editing) && !action && <AccidentForm row={creating ? undefined : selected ?? undefined} busy={busy || needsRefresh} onSave={setAction} onCancel={() => creating ? close() : setEditing(false)} />}
        {action && <section className="incident-confirm"><h3>Confirm {typeof action === 'object' ? 'accident changes' : action.replaceAll('-', ' ')}</h3><p>{action === 'bill-customer' ? `Create a debt of ${money(selected?.amount)} for customer ${selected?.userId}?` : action === 'delete' ? 'Permanently delete this accident? This cannot be undone.' : action === 'bill-company' ? 'Assign this fine to the company? No customer debt will be created.' : action === 'dismiss' ? 'Dismiss this fine without creating a customer debt?' : 'Save these accident details?'}</p>{typeof action === 'object' && <RecordDetails row={action} />}<div className="incident-actions"><button disabled={busy} onClick={() => setAction(null)}>Cancel</button><button className={action === 'delete' || action === 'dismiss' ? 'btn-danger' : 'primary-button'} disabled={busy || needsRefresh} onClick={() => void confirm()}>{busy ? 'Saving…' : 'Confirm action'}</button></div></section>}
        {selected && !editing && <RecordDetails row={car ?? selected} />}
        {car && Array.isArray(car.fines) && <section><h3>Recorded fines <span className="incident-count">{car.fines.length}</span></h3>{car.fines.length ? (car.fines as RecordRow[]).map(fine => <details className="incident-card incident-fine" key={fine.id}><summary><span className="incident-fine-title"><b>#{fine.id}</b> {String(fine.type)}</span><span className="incident-fine-date">{date(fine.fineDate)}</span><strong>{money(fine.amount)}</strong><StatusBadge status={String(fine.status)} /></summary><RecordDetails row={fine} /></details>) : <p>No fines available.</p>}</section>}
      </>}
      </div>
    </Modal>
  </section>;
}
