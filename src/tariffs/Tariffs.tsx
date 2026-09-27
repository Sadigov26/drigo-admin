import { useEffect, useRef, useState } from 'react';
import { Table } from '../components/Table';
import type { Column, SortOrder } from '../components/Table';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { usePermissions } from '../permissions/PermissionsContext';
import { ApiError } from '../api/client';
import { deleteTariff, editable, listTariffs, payload, resources, saveTariff } from './tariffsApi';
import type { Resource, TariffDraft, TariffRow } from './tariffsApi';
import { fieldLabel, TariffFields, tariffValue } from './TariffDetails';
import { TariffForm } from './TariffForm';
import './tariffs.css';

const fields: Record<Resource, string[]> = {
  'tariff-packages': ['unitCount', 'timeUnit', 'price', 'isActive'],
  'tariff-plans': ['name', 'description', 'isActive'],
  'tariff-templates': ['name', 'description', 'isActive'],
  'tariff-distances': ['includedKm', 'extraKmPrice'],
  insurances: ['name', 'dailyPrice', 'deductible', 'description', 'isActive'],
  'subscription-plans': ['modelName', 'monthlyPrice', 'includedKm', 'minMonths', 'isActive'],
  'subscription-bookings': ['customerName', 'modelName', 'status', 'months', 'monthlyPrice', 'startDate'],
};
type Editor = { type: 'create' } | { type: 'edit' | 'delete' | 'detail'; row: TariffRow };
const message = (cause: unknown) => cause instanceof Error ? cause.message : 'Request failed. Please try again.';

function TariffSection({ resource }: { resource: Resource }) {
  const { can } = usePermissions();
  const [rows, setRows] = useState<TariffRow[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState(''), [status, setStatus] = useState('');
  const [page, setPage] = useState(1), [sortBy, setSortBy] = useState('id'), [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState(false), [actionError, setActionError] = useState(''), [notice, setNotice] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const lock = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null);
    listTariffs(resource, controller.signal).then(data => {
      if (!controller.signal.aborted) { setRows(data); setLoading(false); }
    }).catch(cause => { if (!controller.signal.aborted) { setError(message(cause)); setRows([]); setLoading(false); } });
    return () => controller.abort();
  }, [resource, version]);
  function refresh() { setVersion(value => value + 1); }
  function open(next: Editor) { setActionError(''); setUncertain(false); setEditor(next); }
  function close() { if (!lock.current) { setEditor(null); setActionError(''); } }
  async function mutate(draft?: TariffDraft) {
    if (lock.current || uncertain || !editor || editor.type === 'detail') return;
    const permission = editor.type === 'create' ? 'create' : editor.type === 'edit' ? 'edit' : 'delete';
    if (!can(`tariffs.${permission}`)) { setActionError('You do not have permission for this action.'); return; }
    // Validate before the request so a rejected form cannot send a partial payload.
    try { if (draft) payload(resource, draft); } catch (cause) { setActionError(message(cause)); return; }
    lock.current = true; setBusy(true); setActionError(''); setNotice('');
    try {
      if (editor.type === 'delete') await deleteTariff(resource, editor.row.id);
      else if (draft) await saveTariff(resource, draft, editor.type === 'edit' ? editor.row.id : undefined);
      if (!alive.current) return;
      setEditor(null); setNotice('Saved. The list has been refreshed.'); refresh();
    } catch (cause) {
      if (alive.current && (!(cause instanceof ApiError) || cause.status >= 500)) setUncertain(true);
      if (alive.current) setActionError(cause instanceof ApiError && cause.status === 409 ? 'This record is in use and cannot be changed. ' + cause.message : message(cause) + (cause instanceof ApiError && cause.status < 500 ? '' : ' The outcome may be uncertain. Close this dialog and refresh the list before trying again.'));
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  const query = search.trim().toLowerCase();
  const filtered = rows.filter(row => (!query || JSON.stringify(row).toLowerCase().includes(query)) && (!status || (status === 'Active' && resource !== 'subscription-bookings' ? row.isActive === true : status === 'Inactive' ? row.isActive === false : row.status === status)));
  filtered.sort((a, b) => {
    const left = a[sortBy], right = b[sortBy];
    const comparison = typeof left === 'number' && typeof right === 'number' ? left - right : String(left ?? '').localeCompare(String(right ?? ''), 'en', { numeric: true });
    return (comparison || a.id - b.id) * (sortOrder === 'asc' ? 1 : -1);
  });
  const columns: Column<TariffRow>[] = [{ key: 'id', label: 'Record', sortable: true, render: row => <button className="text-button" onClick={() => open({ type: 'detail', row })}>#{row.id}</button> }, ...fields[resource].map(key => ({ key, label: key === 'isActive' ? 'Active' : fieldLabel(key), sortable: true, render: (row: TariffRow) => tariffValue(key, row[key], row.currency) }))];
  if (editable(resource) && (can('tariffs.edit') || can('tariffs.delete'))) columns.push({ key: 'actions', label: 'Actions', render: row => <div className="tariff-actions">{can('tariffs.edit') && <button className="tariff-edit" onClick={() => open({ type: 'edit', row })}><Icon name="edit" />Edit</button>}{can('tariffs.delete') && <button className="tariff-delete" onClick={() => open({ type: 'delete', row })}><Icon name="trash" />Delete</button>}</div> });
  return <section aria-label={resources[resource]}>
    <div className="tariff-section-heading"><div><h2>{resources[resource]}</h2>{!editable(resource) && <span className="tariff-readonly">Read-only</span>}</div><div className="tariff-actions"><button disabled={loading} onClick={refresh}><Icon name="refresh" />Refresh</button>{editable(resource) && can('tariffs.create') && <button className="primary-button" onClick={() => open({ type: 'create' })}><Icon name="plus" />Add {resource.replace('tariff-', '').replace(/s$/, '')}</button>}</div></div>
    {notice && <p role="status" className="tariff-notice">{notice}</p>}
    <Table caption={resources[resource]} columns={columns} data={filtered.slice((page - 1) * 10, page * 10)} rowKey={row => row.id} total={filtered.length} page={page} pageSize={10} loading={loading} error={error} search={search} sortBy={sortBy} sortOrder={sortOrder} onSearch={setSearch} onPageChange={setPage} onSort={(key, order) => { setSortBy(key); setSortOrder(order); }} onRetry={refresh} onRowClick={row => open({ type: 'detail', row })} filters={<div className="tariff-filters">
      {resource !== 'tariff-distances' && <label>Status<select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option>{(resource === 'subscription-bookings' ? ['Pending', 'Active', 'Assigned', 'Completed', 'Cancelled'] : ['Active', 'Inactive']).map(value => <option key={value}>{value}</option>)}</select></label>}
      <label>Sort by<select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1); }}>{['id', ...fields[resource]].map(key => <option key={key} value={key}>{fieldLabel(key)}</option>)}</select></label>
      <label>Order<select value={sortOrder} onChange={e => { setSortOrder(e.target.value as SortOrder); setPage(1); }}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label>
    </div>} />
    <Modal isOpen={editor !== null} title={`${editor?.type === 'detail' ? 'Details' : editor?.type === 'delete' ? 'Delete record?' : editor?.type === 'edit' ? 'Edit record' : 'New record'} · ${resources[resource]}`} onClose={close}>
      <div className="tariff-modal">{actionError && <p role="alert" className="error-message">{actionError}</p>}
        {editor?.type === 'detail' && <TariffFields row={editor.row} />}
        {editor?.type === 'delete' && <><p>Delete {String(editor.row.name ?? `record #${editor.row.id}`)}? This cannot be undone.</p><div className="tariff-actions"><button disabled={busy} onClick={close}>Cancel</button><button className="tariff-delete" disabled={busy || uncertain} onClick={() => { void mutate(); }}><Icon name="trash" />{busy ? 'Deleting…' : 'Confirm delete'}</button></div></>}
        {(editor?.type === 'create' || editor?.type === 'edit') && <TariffForm resource={resource} row={editor.type === 'edit' ? editor.row : undefined} busy={busy} blocked={uncertain} onSave={draft => { void mutate(draft); }} onCancel={close} />}
      </div>
    </Modal>
  </section>;
}
export default function Tariffs() {
  const [resource, setResource] = useState<Resource>('tariff-packages');
  return <div className="tariffs-module"><header className="tariff-heading"><h1>Tariffs & subscriptions</h1><p>Pricing, allowances and subscription records</p></header><nav className="tariff-tabs" aria-label="Tariff sections">{(Object.keys(resources) as Resource[]).map(key => <button key={key} aria-pressed={key === resource} onClick={() => setResource(key)}>{resources[key]}</button>)}</nav><TariffSection key={resource} resource={resource} /></div>;
}
