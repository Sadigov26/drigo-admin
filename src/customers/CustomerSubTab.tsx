import { useEffect, useRef, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { getCustomerTab, payAllDebts, serverPaged } from './customerTabsApi';
import type { CustomerTab, Row, TabData } from './customerTabsApi';

const text = (value: unknown) => value == null || value === '' ? '—' : String(value);
function date(value: unknown) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dubai' }).format(new Date(value)) : '—';
}
function money(value: unknown, currency: unknown = 'AED') {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${text(currency)}` : '—';
}
const columns: Record<Exclude<CustomerTab, 'Revenue' | 'Bonus'>, [string, string][]> = {
  Payments: [['id', 'Payment'], ['amount', 'Amount'], ['status', 'Status'], ['transactionType', 'Type'], ['createdAt', 'Date · Dubai'], ['failureReason', 'Failure reason']],
  Debt: [['id', 'Debt'], ['amount', 'Amount'], ['type', 'Type'], ['isPaid', 'Status'], ['createdAt', 'Created · Dubai'], ['paidAt', 'Paid · Dubai'], ['description', 'Description']],
  Devices: [['model', 'Device'], ['platform', 'Platform'], ['appVersion', 'App version'], ['lastSeenAt', 'Last active · Dubai'], ['isCurrent', 'Current device'], ['deviceId', 'Device ID']],
  'Login history': [['at', 'Date · Dubai'], ['ip', 'IP address'], ['device', 'Device'], ['platform', 'Platform'], ['city', 'Location'], ['success', 'Result']],
  Reservations: [['id', 'Reservation'], ['carName', 'Car'], ['plateNumber', 'Plate'], ['status', 'Status'], ['reservationDate', 'Reserved · Dubai'], ['totalPrice', 'Amount'], ['scheduledDeliveryDate', 'Delivery · Dubai']],
};
function Cell({ row, field }: { row: Row; field: string }) {
  const value = row[field];
  if (value == null) return <>—</>;
  if (['amount', 'totalPrice', 'serviceFee'].includes(field)) return <>{money(value, row.currency ?? 'AED')}</>;
  if (/(At|Date|Start|End)$/.test(field) || field === 'at') return <>{date(value)}</>;
  if (field === 'status') return <StatusBadge status={text(value)} />;
  if (field === 'isPaid') return <StatusBadge status={value === true ? 'Paid' : 'Unpaid'} />;
  if (field === 'success') return <StatusBadge status={value === true ? 'Succeeded' : 'Failed'} />;
  if (typeof value === 'boolean') return <>{value ? 'Yes' : 'No'}</>;
  if (Array.isArray(value)) return value.length ? <ul className="customer-record-list">{value.map((item, index) => <li key={index}><Cell row={{ item }} field="item" /></li>)}</ul> : <>—</>;
  if (typeof value === 'object') return <dl className="customer-record-extra">{Object.entries(value as Row).map(([key, item]) => <div key={key}><dt>{key.replace(/([a-z])([A-Z])/g, '$1 $2')}</dt><dd><Cell row={{ [key]: item }} field={key} /></dd></div>)}</dl>;
  return <>{text(value)}</>;
}
function Records({ tab, rows }: { tab: CustomerTab; rows: Row[] }) {
  const [selected, setSelected] = useState<Row | null>(null);
  if (!rows.length) return <EmptyState message={tab === 'Bonus' ? 'No bonus history available.' : `No ${tab.toLowerCase()} found.`} />;
  // Bonus history is currently always empty. If the server starts returning it,
  // preserve its actual fields instead of inventing a history schema.
  const fields: [string, string][] = tab === 'Bonus' ? [...new Set(rows.flatMap(Object.keys))].map(key => [key, key.replace(/([a-z])([A-Z])/g, '$1 $2')]) : columns[tab as keyof typeof columns];
  return <><div className="table-scroll customer-subtable" tabIndex={0} role="region" aria-label={`${tab} records`}><table><caption className="sr-only">{tab}</caption><thead><tr>{fields.map(([key, name]) => <th key={key} scope="col">{name}</th>)}{['Payments', 'Debt', 'Reservations'].includes(tab) && <th scope="col">Details</th>}</tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id ?? row.deviceId ?? index)}>{fields.map(([key]) => <td key={key}><Cell row={row} field={key} /></td>)}{['Payments', 'Debt', 'Reservations'].includes(tab) && <td><button className="btn-soft-primary" onClick={() => setSelected(row)} aria-label={`View ${tab.toLowerCase()} record ${text(row.id)}`}><Icon name={tab === 'Payments' ? 'receipt' : 'info'} />Details</button></td>}</tr>)}</tbody></table></div>
    <Modal isOpen={selected !== null} title={`${tab === 'Payments' ? 'Payment' : tab === 'Reservations' ? 'Reservation' : 'Debt'} #${text(selected?.id)}`} onClose={() => setSelected(null)}>{selected && <section className="customer-record-sheet">
      <header><span>{tab === 'Payments' ? 'Payment record' : 'Record details'}</span><strong>{money(selected.amount ?? selected.totalPrice, selected.currency ?? 'AED')}</strong><Cell row={selected} field={tab === 'Debt' ? 'isPaid' : 'status'} /></header>
      <dl className="customer-record-grid">{Object.keys(selected).filter(key => !['id', 'amount', 'totalPrice', 'status', 'isPaid'].includes(key)).map(key => <div key={key}><dt>{key.replace(/([a-z])([A-Z])/g, '$1 $2')}</dt><dd><Cell row={selected} field={key} /></dd></div>)}</dl>
    </section>}</Modal></>;
}
export default function CustomerSubTab({ id, tab, canPay, onBusy, onChanged }: { id: string; tab: CustomerTab; canPay: boolean; onBusy: (value: boolean) => void; onChanged: () => void }) {
  const [data, setData] = useState<TabData | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [review, setReview] = useState<TabData | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setReview(null); setActionError('');
    getCustomerTab(id, tab, page, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      if (serverPaged(tab) && page > Math.max(1, Math.ceil(result.total / 10))) { setPage(Math.max(1, Math.ceil(result.total / 10))); return; }
      setData(result);
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load this tab.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, tab, page, attempt]);
  async function confirmPayment() {
    if (!review || !canPay || lock.current) return;
    lock.current = true; setBusy(true); onBusy(true); setNotice('');
    let applied = false;
    try {
      const paidCount = await payAllDebts(id, review); applied = true;
      if (!alive.current) return;
      setReview(null); onChanged();
      const refreshed = await getCustomerTab(id, 'Debt');
      if (!alive.current) return;
      setData(refreshed);
      setNotice(`${paidCount} debt record(s) marked paid. ${refreshed.rows.some(row => !row.isPaid) ? 'There are still unpaid debts; review the refreshed list.' : 'No unpaid debts remain.'}`);
    } catch (cause) {
      if (alive.current) setActionError(`${applied ? 'Payment saved, but refresh failed. ' : ''}${cause instanceof Error ? cause.message : 'Payment failed.'} Refresh before trying again.`);
    } finally {
      lock.current = false;
      if (alive.current) { setBusy(false); onBusy(false); }
    }
  }
  const refresh = () => { setNotice(''); setAttempt(value => value + 1); };
  const count = data?.rows.filter(row => row.isPaid === false).length ?? 0;
  return <section className="customer-subtab" aria-label={tab}>
    <header className="customer-subtab-heading"><h3>{tab}</h3><button disabled={loading || busy} onClick={refresh}><Icon name="refresh" />Refresh {tab.toLowerCase()}</button></header>
    {notice && <p role="status" className="customer-notice">{notice}</p>}
    {actionError && <p role="alert" className="error-message">{actionError}</p>}
    {loading ? <LoadingState message={`Loading ${tab.toLowerCase()}…`} /> : error ? <ErrorState message={error} onRetry={refresh} /> : data && <>
      {tab === 'Debt' && <div className="customer-financial-summary"><div><span>Outstanding debt</span><strong>{money(data.summary.totalDebt, data.summary.currency)}</strong><small>{count} unpaid record(s)</small></div>{canPay && count > 0 && <button className="btn-soft-primary" disabled={busy || !!actionError} onClick={() => setReview(data)}><Icon name="check" />Pay all debts</button>}</div>}
      {review && !actionError && <div className="customer-confirm"><h3>Pay all outstanding debts?</h3><p>{review.rows.filter(row => !row.isPaid).length} record(s) · {money(review.summary.totalDebt, review.summary.currency)}</p><p>This marks all currently unpaid debts for this customer as paid.</p><div className="customer-actions"><button disabled={busy} onClick={() => setReview(null)}>Cancel</button><button className="btn-primary" disabled={busy} onClick={() => { void confirmPayment(); }}>{busy ? 'Saving…' : 'Confirm payment'}</button></div></div>}
      {tab === 'Bonus' && <div className="customer-financial-summary"><div><span>Bonus balance</span><strong>{money(data.summary.balance, data.summary.currency)}</strong></div></div>}
      {tab === 'Revenue' ? <div className="customer-revenue-grid"><div><span>Successful payments</span><strong>{money(data.summary.totalRevenue, data.summary.currency)}</strong></div><div><span>Total rentals</span><strong>{text(data.summary.totalRentals)}</strong></div><div><span>Average rental value</span><strong>{money(data.summary.averageRentalValue, data.summary.currency)}</strong></div></div> : <Records tab={tab} rows={data.rows} />}
      {serverPaged(tab) && <div className="table-pagination"><span>{data.total} results</span><div><button disabled={page <= 1 || busy} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page} of {Math.max(1, Math.ceil(data.total / 10))}</span><button disabled={page * 10 >= data.total || busy} onClick={() => setPage(value => value + 1)}>Next</button></div></div>}
    </>}
  </section>;
}
