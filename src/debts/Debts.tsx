import { useEffect, useRef, useState } from 'react';
import { Table } from '../components/Table';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { StatusBadge } from '../components/StatusBadge';
import { usePermissions } from '../permissions/PermissionsContext';
import { validId } from '../customers/customersApi';
import { date } from '../customers/CustomerDetails';
import CustomerDebts, { money, visibleRows } from './CustomerDebts';
import { downloadDebtors, getDebtLists, type Debtor, type Debt } from './debtsApi';
import './debts.css';

export default function Debts() {
  const { can } = usePermissions();
  const [view, setView] = useState('Debtors');
  const [data, setData] = useState<{ debtors: Debtor[]; debts: Debt[] }>({ debtors: [], debts: [] });
  const [query, setQuery] = useState<{ page: number; search: string; sortBy: string; sortOrder: 'asc' | 'desc' }>({ page: 1, search: '', sortBy: 'totalDebt', sortOrder: 'desc' });
  const [paid, setPaid] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lookup, setLookup] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const download = useRef<AbortController | null>(null);
  useEffect(() => () => download.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    getDebtLists(controller.signal).then(rows => { if (!controller.signal.aborted) setData(rows); }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load debts.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  async function exportReport() {
    if (download.current) return;
    const controller = new AbortController(); download.current = controller; setDownloading(true); setDownloadError('');
    try { await downloadDebtors(controller.signal); }
    catch (cause) { if (!controller.signal.aborted) setDownloadError(cause instanceof Error ? cause.message : 'Download failed.'); }
    finally { if (!controller.signal.aborted) setDownloading(false); download.current = null; }
  }
  const rows = visibleRows<Debtor | Debt>(view === 'Debtors' ? data.debtors : data.debts.filter(row => paid === '' || String(row.isPaid) === paid), query, view === 'Debtors' ? ['fullName', 'email', 'phoneNumber'] : ['userName', 'userPhone', 'type', 'description', 'id']);
  return <section className="debts-page">
    <header className="debts-heading"><div><h1>Debts</h1><p>Customer balances and debt collection</p></div><div className="debt-actions"><button disabled={loading} onClick={() => setAttempt(n => n + 1)}><Icon name="refresh" />Refresh</button><button disabled={downloading} onClick={() => { void exportReport(); }}><Icon name="receipt" />{downloading ? 'Downloading…' : 'Download all debtors CSV'}</button></div></header>
    {downloadError && <p role="alert" className="error-message">{downloadError}</p>}
    <nav className="debt-tabs" aria-label="Debt views">{['Debtors', 'All debts'].map(item => <button key={item} aria-pressed={view === item} onClick={() => { setView(item); setPaid(''); setQuery({ page: 1, search: '', sortBy: item === 'Debtors' ? 'totalDebt' : 'createdAt', sortOrder: 'desc' }); }}>{item}</button>)}</nav>
    <Table<Debtor | Debt> caption={view} data={rows.slice((query.page - 1) * 10, query.page * 10)} total={rows.length} page={query.page} pageSize={10} rowKey={row => row.id} loading={loading} error={error || null} search={query.search} sortBy={query.sortBy} sortOrder={query.sortOrder} onSearch={search => setQuery(q => ({ ...q, search, page: 1 }))} onSort={(sortBy, sortOrder) => setQuery(q => ({ ...q, sortBy, sortOrder, page: 1 }))} onPageChange={page => setQuery(q => q.page === page ? q : { ...q, page })} onRetry={() => setAttempt(n => n + 1)} onRowClick={row => setSelected(String(view === 'Debtors' ? row.id : row.userId))} filters={<>{view === 'All debts' && <label>Payment status<select value={paid} onChange={event => { setPaid(event.target.value); setQuery(q => ({ ...q, page: 1 })); }}><option value="">All debts</option><option value="false">Unpaid</option><option value="true">Paid</option></select></label>}<label>Sort by<select value={query.sortBy} onChange={event => setQuery(q => ({ ...q, sortBy: event.target.value, page: 1 }))}>{(view === 'Debtors' ? [['totalDebt', 'Outstanding amount'], ['fullName', 'Customer'], ['unpaidCount', 'Unpaid count']] : [['createdAt', 'Created date'], ['amount', 'Amount'], ['userName', 'Customer']]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Order<select value={query.sortOrder} onChange={event => setQuery(q => ({ ...q, sortOrder: event.target.value as 'asc' | 'desc', page: 1 }))}><option value="desc">Descending</option><option value="asc">Ascending</option></select></label></>} columns={view === 'Debtors' ? [
      { key: 'fullName', label: 'Customer', sortable: true, render: row => <button className="table-link" onClick={() => setSelected(String(row.id))}>{String(row.fullName)}</button> }, { key: 'email', label: 'Email' }, { key: 'phoneNumber', label: 'Phone' }, { key: 'totalDebt', label: 'Outstanding debt', sortable: true, render: row => money(row.totalDebt) }, { key: 'unpaidCount', label: 'Unpaid records', sortable: true },
    ] : [
      { key: 'id', label: 'Debt' }, { key: 'userName', label: 'Customer', render: row => <button className="table-link" onClick={() => setSelected(String(row.userId))}>{String(row.userName || row.userId)}</button> }, { key: 'amount', label: 'Amount', sortable: true, render: row => money(row.amount, row.currency) }, { key: 'type', label: 'Type' }, { key: 'isPaid', label: 'Status', render: row => <StatusBadge status={row.isPaid ? 'Paid' : 'Unpaid'} /> }, { key: 'createdAt', label: 'Created · Dubai', sortable: true, render: row => date(row.createdAt) },
    ]} />
    <form className="debt-lookup" onSubmit={event => { event.preventDefault(); const id = lookup.trim().toLowerCase(); if (!validId(id)) { setLookupError('Enter a valid customer UUID.'); return; } setLookupError(''); setSelected(id); }}><label>Open customer by UUID<input value={lookup} placeholder="Customer UUID, including accounts without debt" onChange={event => setLookup(event.target.value)} required /></label><button><Icon name="search" />Open debt account</button>{lookupError && <p role="alert">{lookupError}</p>}</form>
    <Modal isOpen={selected !== null} title="Customer debt account" onClose={() => { if (!busy) setSelected(null); }}>{selected && <CustomerDebts key={selected} id={selected} canEdit={can('debts.edit')} canCreate={can('debts.create')} canDelete={can('debts.delete')} onBusy={setBusy} onChanged={() => setAttempt(n => n + 1)} />}</Modal>
  </section>;
}
