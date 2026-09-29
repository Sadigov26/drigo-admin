import { useCallback, useEffect, useRef, useState } from 'react';
import { Table, type Column, type SortOrder } from '../components/Table';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState, LoadingState } from '../components/States';
import { usePermissions } from '../permissions/PermissionsContext';
import { ApiError } from '../api/client';
import { CustomerImage, date } from '../customers/CustomerDetails';
import '../customers/customers.css';
import { buildPayload, campaignStatuses, changeStatus, displayStatus, getRecord, getReferral, listRecords, removeRecord, saveRecord, saveReferral, sections, storyStatuses, type RecordRow, type Section, type Values } from './promotionsApi';
import { PromotionForm } from './PromotionForm';
import { Analytics, PromotionFields } from './PromotionDetails';
import { usePromotionData } from './usePromotionData';
import './promotions.css';

type Editor = { type: 'create' } | { type: 'edit' | 'detail' | 'delete' | 'status'; id: number };
type Area = Section | 'referrals';
const titles = { ...sections, referrals: 'Referral settings' };
function RecordPanel({ section, editor, onClose, onSaved, onBusy }: { section: Area; editor: Editor; onClose: () => void; onSaved: () => void; onBusy: (busy: boolean) => void }) {
  const id = 'id' in editor ? editor.id : undefined;
  const current = usePromotionData(useCallback((signal: AbortSignal) => editor.type === 'create' ? Promise.resolve(null) : section === 'referrals' ? getReferral(signal) : getRecord(section, id!, signal), [section, id, editor.type]));
  const { can } = usePermissions();
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [uncertain, setUncertain] = useState(false);
  const lock = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function submit(values?: Values) {
    if (lock.current || uncertain) return;
    const permission = editor.type === 'create' ? 'create' : editor.type === 'delete' ? 'delete' : 'edit';
    if (!can(`promotions.${permission}`)) { setError('You do not have permission for this action.'); return; }
    try { if (values) buildPayload(section, values); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Check the form.'); return; }
    lock.current = true; setBusy(true); onBusy(true); setError('');
    try {
      if (section === 'referrals') await saveReferral(values!);
      else if (editor.type === 'delete') await removeRecord(section, id!);
      else if (editor.type === 'status') await changeStatus(section, current.data as RecordRow);
      else await saveRecord(section, values!, id);
      if (alive.current) onSaved();
    } catch (cause) {
      if (!alive.current) return;
      const unknownOutcome = !(cause instanceof ApiError) || cause.status >= 500;
      setUncertain(unknownOutcome);
      setError(cause instanceof ApiError && cause.status === 409 ? 'This record is in use or conflicts with another record. ' + cause.message : (cause instanceof Error ? cause.message : 'Request failed.') + (unknownOutcome ? ' Close and refresh the list before retrying; the request may have been saved.' : ''));
    } finally { lock.current = false; if (alive.current) { setBusy(false); onBusy(false); } }
  }
  if (current.loading) return <LoadingState />;
  if (current.error) return <ErrorState message={current.error} onRetry={current.refresh} />;
  return <div className="promotion-dialog">
    {error && <p role="alert" className="error-message">{error}</p>}
    {editor.type === 'detail' && current.data && <><PromotionFields row={current.data} />{(section === 'discounts' || section === 'stories') && <Analytics section={section} id={id!} />}</>}
    {(editor.type === 'create' || editor.type === 'edit') && <PromotionForm section={section} initial={current.data ?? undefined} busy={busy} blocked={uncertain} onCancel={onClose} onSave={values => { void submit(values); }} />}
    {(editor.type === 'delete' || editor.type === 'status') && current.data && <><p className="promotion-confirm">{editor.type === 'delete' ? 'Permanently delete' : 'Change availability for'} <strong>{String(current.data.title ?? current.data.name ?? current.data.code ?? `#${id}`)}</strong>?{editor.type === 'delete' ? ' This cannot be undone.' : ''}</p>
      {editor.type === 'status' && <p>{section === 'promotions' || section === 'promo-codes' ? current.data.isActive ? 'This will disable the record.' : 'This will enable the record; its dates still determine availability.' : `New status: ${current.data.status === 'Active' ? section === 'stories' ? 'Draft' : 'Paused' : 'Active'}`}</p>}
      <div className="promotion-form-actions"><button disabled={busy} onClick={onClose}>Cancel</button><button className={editor.type === 'delete' ? 'btn-soft-danger' : 'btn-primary'} disabled={busy || uncertain} onClick={() => { void submit(); }}>{busy ? 'Saving…' : 'Confirm'}</button></div></>}
  </div>;
}

function ListSection({ section }: { section: Section }) {
  const state = usePromotionData(useCallback((signal: AbortSignal) => listRecords(section, signal), [section]));
  const { can } = usePermissions();
  const [search, setSearch] = useState(''), [status, setStatus] = useState(''), [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: 'id', order: 'desc' as SortOrder });
  const [editor, setEditor] = useState<Editor | null>(null), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const rows = (state.data ?? []).map(row => ({ ...row, displayStatus: displayStatus(section, row, now) })).filter(row => (!status || row.displayStatus === status) && JSON.stringify(row).toLowerCase().includes(search.trim().toLowerCase()));
  rows.sort((a, b) => { const left = (a as Values)[sort.key], right = (b as Values)[sort.key]; return (typeof left === 'number' && typeof right === 'number' ? left - right : String(left ?? '').localeCompare(String(right ?? ''), 'en', { numeric: true })) * (sort.order === 'asc' ? 1 : -1); });
  const nameKey = section === 'discounts' ? 'name' : section === 'promo-codes' ? 'code' : 'title';
  const columns: Column<RecordRow>[] = [
    { key: nameKey, label: section === 'promo-codes' ? 'Code' : 'Name', sortable: true, render: row => <button className="table-link" onClick={() => setEditor({ type: 'detail', id: row.id })}>{String(row[nameKey] ?? `#${row.id}`)}</button> },
    { key: 'displayStatus', label: 'Status', sortable: true, render: row => <StatusBadge status={String(row.displayStatus)} /> },
  ];
  if (section === 'promotions' || section === 'discounts') columns.push({ key: 'startDate', label: 'Starts · Dubai', sortable: true, render: row => date(row.startDate) }, { key: 'endDate', label: 'Ends · Dubai', sortable: true, render: row => date(row.endDate) });
  if (section === 'discounts' || section === 'promo-codes') columns.push(
    { key: 'value', label: 'Discount', sortable: true, render: row => `${String(row.value ?? '—')}${(row.type ?? row.discountType) === 'Percentage' ? '%' : ' AED'}${row.type === 'FixedPrice' ? ' · fixed price' : ''}` },
    { key: section === 'discounts' ? 'usageLimit' : 'maxRedemptions', label: 'Limit', render: row => String(row[section === 'discounts' ? 'usageLimit' : 'maxRedemptions'] ?? 'Unlimited') },
    { key: section === 'discounts' ? 'usedCount' : 'redemptionCount', label: 'Used', sortable: true });
  if (section === 'promo-codes') columns.push({ key: 'expiresAt', label: 'Expires · Dubai', sortable: true, render: row => date(row.expiresAt) });
  if (section === 'stories') columns.push({ key: 'targetAudience', label: 'Audience' }, { key: 'items', label: 'Media', render: row => {
    const items = Array.isArray(row.items) ? row.items as Values[] : [];
    const cover = items.find(item => item.mediaType === 'Image');
    return <div className="promotion-cover">{cover && <CustomerImage value={cover.mediaUrl} title="Story preview" />}<span>{items.length} items</span></div>;
  } }, { key: 'viewCount', label: 'Views', sortable: true });
  if (can('promotions.edit') || can('promotions.delete')) columns.push({ key: 'actions', label: 'Actions', render: row => <div className="promotion-actions">{can('promotions.edit') && <><button onClick={() => setEditor({ type: 'status', id: row.id })}><Icon name="power" />{section === 'promotions' || section === 'promo-codes' ? row.isActive ? 'Disable' : 'Enable' : row.status === 'Active' ? section === 'stories' ? 'Unpublish' : 'Pause' : 'Activate'}</button><button className="btn-soft-primary" onClick={() => setEditor({ type: 'edit', id: row.id })}><Icon name="edit" />Edit</button></>}{can('promotions.delete') && <button className="btn-soft-danger" onClick={() => setEditor({ type: 'delete', id: row.id })}><Icon name="trash" />Delete</button>}</div> });
  const close = () => { if (!busy) setEditor(null); };
  return <section><div className="promotion-panel-heading"><h2>{sections[section]}</h2><div className="promotion-actions"><button disabled={state.loading} onClick={state.refresh}><Icon name="refresh" />Refresh</button>{can('promotions.create') && <button className="btn-primary" onClick={() => setEditor({ type: 'create' })}><Icon name="plus" />Add {section === 'promo-codes' ? 'promo code' : section === 'stories' ? 'story' : section.slice(0, -1)}</button>}</div></div>
    {notice && <p role="status" className="promotion-notice">{notice}</p>}
    <Table caption={sections[section]} columns={columns} data={rows.slice((page - 1) * 10, page * 10)} rowKey={row => row.id} total={rows.length} page={page} pageSize={10} loading={state.loading} error={state.error} search={search} sortBy={sort.key} sortOrder={sort.order} onPageChange={setPage} onSearch={setSearch} onSort={(key, order) => setSort({ key, order })} onRetry={state.refresh} onRowClick={row => setEditor({ type: 'detail', id: row.id })} filters={<div className="promotion-filters"><label>Status<select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option>{(section === 'stories' ? storyStatuses : campaignStatuses).map(value => <option key={value}>{value}</option>)}</select></label><label>Sort by<select value={sort.key} onChange={e => { setSort({ ...sort, key: e.target.value }); setPage(1); }}><option value="id">Record ID</option>{columns.filter(col => col.sortable).map(col => <option key={col.key} value={col.key}>{col.label}</option>)}</select></label><label>Order<select value={sort.order} onChange={e => { setSort({ ...sort, order: e.target.value as SortOrder }); setPage(1); }}><option value="desc">Descending</option><option value="asc">Ascending</option></select></label></div>} />
    <Modal isOpen={!!editor} title={`${editor?.type === 'detail' ? 'Details' : editor?.type === 'create' ? 'Create' : editor?.type === 'delete' ? 'Delete record' : editor?.type === 'status' ? 'Change status' : 'Edit'} · ${sections[section]}`} onClose={close}>
      {editor && <RecordPanel section={section} editor={editor} onClose={close} onBusy={setBusy} onSaved={() => { setEditor(null); setBusy(false); state.refresh(); setNotice('Changes saved. The list is updating.'); }} />}
    </Modal>
  </section>;
}
function Referrals() {
  const state = usePromotionData(getReferral), { can } = usePermissions();
  const [editing, setEditing] = useState(false), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  return <section className="promotion-referrals"><div className="promotion-panel-heading"><h2>Referral settings</h2><div className="promotion-actions"><button disabled={state.loading} onClick={state.refresh}><Icon name="refresh" />Refresh</button>{can('promotions.edit') && <button className="btn-soft-primary" disabled={!state.data} onClick={() => setEditing(true)}><Icon name="edit" />Edit settings</button>}</div></div>{notice && <p role="status" className="promotion-notice">{notice}</p>}{state.loading ? <LoadingState /> : state.error ? <ErrorState message={state.error} onRetry={state.refresh} /> : state.data && <PromotionFields row={state.data} />}
    <Modal isOpen={editing} title="Edit referral settings" onClose={() => { if (!busy) setEditing(false); }}>{editing && <RecordPanel section="referrals" editor={{ type: 'edit', id: 0 }} onBusy={setBusy} onClose={() => { if (!busy) setEditing(false); }} onSaved={() => { setEditing(false); setBusy(false); state.refresh(); setNotice('Referral settings saved.'); }} />}</Modal></section>;
}
export default function Promotions() {
  const [area, setArea] = useState<Area>('promotions');
  return <div className="promotions-module"><header className="promotion-heading"><h1>Promotions & engagement</h1><p>Campaigns, discounts, stories and referral rewards</p></header><nav className="promotion-tabs" aria-label="Promotion sections">{(Object.keys(titles) as Area[]).map(key => <button key={key} aria-pressed={area === key} onClick={() => setArea(key)}>{titles[key]}</button>)}</nav>{area === 'referrals' ? <Referrals /> : <ListSection section={area} key={area} />}</div>;
}
