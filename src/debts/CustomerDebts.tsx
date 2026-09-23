import { useEffect, useRef, useState } from 'react';
import { getCustomer } from '../customers/customersApi';
import { getCustomerTab, type TabData, type Row } from '../customers/customerTabsApi';
import { Table } from '../components/Table';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState, LoadingState } from '../components/States';
import { Icon } from '../components/Icon';
import { actOnDebt, splitAmounts, type DebtAction } from './debtsApi';
import { date } from '../customers/CustomerDetails';

export const money = (value: unknown, currency: unknown = 'AED') => typeof value === 'number' && Number.isFinite(value) ? `${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}` : '—';
type Query = { page: number; search: string; sortBy: string; sortOrder: 'asc' | 'desc' };
export function visibleRows<T extends Row>(rows: T[], query: Query, keys: string[]) {
  const needle = query.search.trim().toLowerCase();
  return rows.filter(row => !needle || keys.some(key => String(row[key] ?? '').toLowerCase().includes(needle))).sort((a, b) => {
    const first = a[query.sortBy], second = b[query.sortBy];
    const comparison = typeof first === 'number' && typeof second === 'number' ? first - second : String(first ?? '').localeCompare(String(second ?? ''), 'en', { numeric: true });
    return query.sortOrder === 'asc' ? comparison : -comparison;
  });
}
export default function CustomerDebts({ id, canEdit, canCreate, canDelete, onBusy, onChanged }: { id: string; canEdit: boolean; canCreate: boolean; canDelete: boolean; onBusy: (value: boolean) => void; onChanged: () => void }) {
  const [data, setData] = useState<TabData | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [query, setQuery] = useState<Query>({ page: 1, search: '', sortBy: 'createdAt', sortOrder: 'desc' });
  const [action, setAction] = useState<DebtAction | null>(null);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [amount, setAmount] = useState('');
  const [debtType, setDebtType] = useState('Manual');
  const [description, setDescription] = useState('');
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setAction(null); setSelected([]); setActionError('');
    Promise.all([getCustomer(id, controller.signal), getCustomerTab(id, 'Debt', 1, controller.signal)]).then(([user, debts]) => {
      if (!controller.signal.aborted) { setName(user.fullName || id); setData(debts); setNeedsRefresh(false); }
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load debts.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, attempt]);
  function open(next: DebtAction) { setAction(next); setReview(['all', 'selected', 'pay', 'delete'].includes(next.type)); setActionError(''); setAmount(''); setDebtType('Manual'); setDescription(''); }
  async function confirm() {
    if (!action || !data || lock.current || needsRefresh || (action.type === 'delete' ? !canDelete : action.type === 'add' ? !canCreate : !canEdit)) return;
    lock.current = true; setBusy(true); onBusy(true); setActionError(''); setNotice('');
    let applied = false;
    try {
      await actOnDebt(id, action, data); applied = true;
      if (!alive.current) return;
      onChanged(); setSelected([]); setAction(null);
      const refreshed = await getCustomerTab(id, 'Debt');
      if (alive.current) { setData(refreshed); setNotice('Saved. Debt records have been refreshed.'); }
    } catch (cause) {
      if (alive.current) { setNeedsRefresh(true); setActionError(`${applied ? 'Saved, but refresh failed. ' : ''}${cause instanceof Error ? cause.message : 'Action failed.'} Refresh debts before another action.`); }
    } finally { lock.current = false; if (alive.current) { setBusy(false); onBusy(false); } }
  }
  if (loading) return <LoadingState message="Loading customer debts…" />;
  if (error) return <ErrorState message={error} onRetry={() => setAttempt(n => n + 1)} />;
  if (!data) return null;
  const unpaid = data.rows.filter(row => row.isPaid === false);
  const filtered = visibleRows(data.rows, query, ['id', 'type', 'description']);
  const disabled = busy || needsRefresh || action !== null;
  const affected = action?.type === 'all' ? unpaid : action?.type === 'selected' ? data.rows.filter(row => action.ids.includes(Number(row.id))) : action && 'id' in action ? data.rows.filter(row => row.id === action.id) : [];
  const total = affected.reduce((sum, row) => sum + Number(row.amount), 0);
  return <div className="debt-customer">
    <header className="debt-summary"><div><span>Customer account</span><h3>{name || id}</h3><small>{id}</small></div><div><span>Outstanding debt</span><strong>{money(data.summary.totalDebt, data.summary.currency)}</strong><small>{unpaid.length} unpaid records</small></div></header>
    {notice && <p role="status" className="debt-notice">{notice}</p>}
    {actionError && <p role="alert" className="error-message">{actionError}</p>}
    <div className="debt-actions">
      <button disabled={busy} onClick={() => { onChanged(); setAttempt(n => n + 1); }}><Icon name="refresh" />Refresh debts</button>
      {canCreate && <button className="btn-soft-primary" disabled={disabled} onClick={() => open({ type: 'add', amount: 0, debtType: 'Manual', description: '' })}><Icon name="plus" />Add debt</button>}
      {canEdit && <><button className="btn-soft-primary" disabled={disabled || !unpaid.length} onClick={() => open({ type: 'all' })}>Pay all ({unpaid.length})</button><button className="btn-soft-primary" disabled={disabled || !selected.length} onClick={() => open({ type: 'selected', ids: [...selected] })}>Pay selected ({selected.length})</button></>}
    </div>
    {action && <form className="debt-confirm" onSubmit={event => {
      event.preventDefault(); if (review) { void confirm(); return; }
      try {
        if (action.type === 'split') splitAmounts(total, action.parts);
        if (action.type === 'add') {
          const number = Number(amount);
          if (!Number.isFinite(number) || number <= 0 || number > 1_000_000 || Math.abs(number * 100 - Math.round(number * 100)) > 0.000001 || !debtType.trim() || !description.trim()) throw new Error('Enter a positive amount (up to two decimals), type and description.');
          setAction({ type: 'add', amount: number, debtType, description });
        }
        setActionError(''); setReview(true);
      } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Check the form.'); }
    }}><h3>{action.type === 'delete' ? 'Delete debt permanently?' : action.type === 'split' ? 'Split debt' : action.type === 'add' ? 'Add debt' : 'Confirm debt payment'}</h3>
      {action.type !== 'add' && <p>{affected.length} record(s) · {money(total)} · {name}</p>}
      {action.type === 'delete' && <p>This removes the record permanently. It cannot be restored from this panel.</p>}
      {action.type === 'split' && <label>Number of equal parts (2–12)<input type="number" min="2" max="12" step="1" value={action.parts} disabled={review || busy} onChange={event => setAction({ ...action, parts: Number(event.target.value) })} required /></label>}
      {action.type === 'add' && (!review ? <div className="debt-form-grid"><label>Amount · AED<input type="number" min="0.01" max="1000000" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)} /></label><label>Type<input maxLength={80} required value={debtType} onChange={event => setDebtType(event.target.value)} /></label><label className="debt-wide">Description<textarea maxLength={500} required value={description} onChange={event => setDescription(event.target.value)} /></label></div> : <p>{money(action.amount)} · {action.debtType} · {action.description}</p>)}
      <div className="debt-actions"><button type="button" disabled={busy} onClick={() => setAction(null)}>Cancel</button>{review && ['add', 'split'].includes(action.type) && <button type="button" disabled={busy} onClick={() => setReview(false)}>Edit</button>}<button disabled={busy || needsRefresh} className={action.type === 'delete' ? 'btn-danger' : 'btn-primary'}>{busy ? 'Saving…' : review ? 'Confirm action' : 'Review action'}</button></div>
    </form>}
    <Table caption="Customer debts" data={filtered.slice((query.page - 1) * 10, query.page * 10)} total={filtered.length} page={query.page} pageSize={10} rowKey={row => Number(row.id)} loading={false} error={null} search={query.search} sortBy={query.sortBy} sortOrder={query.sortOrder} onSearch={search => setQuery(q => ({ ...q, search, page: 1 }))} onSort={(sortBy, sortOrder) => setQuery(q => ({ ...q, sortBy, sortOrder, page: 1 }))} onPageChange={page => setQuery(q => q.page === page ? q : { ...q, page })} onRetry={() => setAttempt(n => n + 1)} columns={[
      ...(canEdit ? [{ key: 'select', label: 'Select', render: (row: Row) => <input type="checkbox" aria-label={`Select debt ${row.id}`} checked={selected.includes(Number(row.id))} disabled={disabled || row.isPaid === true} onChange={event => setSelected(ids => event.target.checked ? [...ids, Number(row.id)] : ids.filter(id => id !== row.id))} /> }] : []),
      { key: 'id', label: 'Debt', sortable: true }, { key: 'amount', label: 'Amount', sortable: true, render: row => money(row.amount, row.currency) }, { key: 'type', label: 'Type' }, { key: 'isPaid', label: 'Status', render: row => <StatusBadge status={row.isPaid ? 'Paid' : 'Unpaid'} /> }, { key: 'description', label: 'Description' }, { key: 'createdAt', label: 'Created · Dubai', render: row => date(row.createdAt) },
      { key: 'actions', label: 'Actions', render: row => <div className="debt-actions">{canEdit && !row.isPaid && <><button disabled={disabled} onClick={() => open({ type: 'pay', id: Number(row.id) })}>Pay</button><button disabled={disabled} onClick={() => open({ type: 'split', id: Number(row.id), parts: 2 })}>Split</button></>}{canDelete && <button className="btn-soft-danger" disabled={disabled} onClick={() => open({ type: 'delete', id: Number(row.id) })}><Icon name="trash" />Delete</button>}</div> },
    ]} />
  </div>;
}
