import { useEffect, useState } from 'react';
import { Table } from '../components/Table';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import RentalDetails, { date, money, text } from './RentalDetails';
import { getRentals, statuses } from './rentalsApi';
import type { Page, Query } from './rentalsApi';
import { usePermissions } from '../permissions/PermissionsContext';
import { Icon } from '../components/Icon';
import './rentals.css';

const initial: Query = { page: 1, pageSize: 10, search: '', status: '', sortBy: 'startDate', sortOrder: 'desc' };
export default function Rentals() {
  const { can } = usePermissions();
  const [actionBusy, setActionBusy] = useState(false);
  const [query, setQuery] = useState(initial);
  const [data, setData] = useState<Page>({ data: [], total: 0, page: 1, pageSize: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const timer = setTimeout(() => {
      getRentals(query, controller.signal).then(result => { if (!controller.signal.aborted) setData(result); })
        .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load rentals.'); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, attempt]);
  return <section className="rentals-page"><header className="rentals-heading"><div><h1>Rentals</h1><p>Trips, payments and rental history</p></div><button disabled={loading} onClick={() => setAttempt(value => value + 1)}><Icon name="refresh" />Refresh rentals</button></header>
    <Table caption="Rentals" onRowClick={row => setSelected(row.id)} columns={[
      { key: 'id', label: 'Rental', render: row => <button className="table-link" onClick={() => setSelected(row.id)}>#{row.id}</button> },
      { key: 'user', label: 'Customer', render: row => text(row.user?.fullName) },
      { key: 'car', label: 'Plate', render: row => text(row.car?.plateNumber) },
      { key: 'status', label: 'Status', sortable: true, render: row => <StatusBadge status={row.status} /> },
      { key: 'startDate', label: 'Started · Dubai', sortable: true, render: row => date(row.startDate) },
      { key: 'totalPrice', label: 'Amount', sortable: true, render: row => money(row.totalPrice) },
    ]} data={data.data} total={data.total} page={query.page} pageSize={query.pageSize} rowKey={row => row.id} loading={loading} error={error || null} search={query.search} sortBy={query.sortBy} sortOrder={query.sortOrder}
      onSearch={search => setQuery(previous => ({ ...previous, search, page: 1 }))} onSort={(sortBy, sortOrder) => setQuery(previous => ({ ...previous, sortBy, sortOrder, page: 1 }))} onPageChange={page => setQuery(previous => previous.page === page ? previous : { ...previous, page })} onRetry={() => setAttempt(value => value + 1)}
      filters={<>
        <label>Status<select value={query.status} onChange={event => setQuery(previous => ({ ...previous, status: event.target.value, page: 1 }))}><option value="">All statuses</option>{statuses.map(status => <option key={status}>{status}</option>)}</select></label>
        <label>Sort by<select value={query.sortBy} onChange={event => setQuery(previous => ({ ...previous, sortBy: event.target.value, page: 1 }))}><option value="startDate">Start date</option><option value="endDate">End date</option><option value="totalPrice">Amount</option><option value="status">Status</option></select></label>
        <label>Order<select value={query.sortOrder} onChange={event => setQuery(previous => ({ ...previous, sortOrder: event.target.value as 'asc' | 'desc', page: 1 }))}><option value="desc">Descending</option><option value="asc">Ascending</option></select></label>
        <label>Started from · Dubai<input type="date" value={query.startFrom ?? ''} onChange={event => setQuery(previous => ({ ...previous, startFrom: event.target.value, page: 1 }))} /></label>
        <label>Started through · Dubai<input type="date" value={query.startTo ?? ''} onChange={event => setQuery(previous => ({ ...previous, startTo: event.target.value, page: 1 }))} /></label>
        <label>Min duration · hours<input type="number" min="0" step="any" value={query.minHours ?? ''} onChange={event => setQuery(previous => ({ ...previous, minHours: event.target.value, page: 1 }))} /></label>
        <label>Max duration · hours<input type="number" min="0" step="any" value={query.maxHours ?? ''} onChange={event => setQuery(previous => ({ ...previous, maxHours: event.target.value, page: 1 }))} /></label>
        <button onClick={() => setQuery(initial)}>Clear filters</button>
      </>} />
    {(query.minHours || query.maxHours) && <p className="rental-note">Duration is start to end; ongoing rentals use the time of refresh.</p>}
    <Modal isOpen={selected != null} title={`Rental #${selected ?? ''}`} onClose={() => { if (!actionBusy) setSelected(null); }}>{selected != null && <RentalDetails key={selected} rentalId={selected} canEdit={can('rentals.edit')} onBusy={setActionBusy} onChanged={() => setAttempt(value => value + 1)} />}</Modal>
  </section>;
}
