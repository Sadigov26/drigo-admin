import { useEffect, useState } from 'react';
import { Table } from '../components/Table';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { StatusBadge } from '../components/StatusBadge';
import { usePermissions } from '../permissions/PermissionsContext';
import CustomerDetails, { date } from './CustomerDetails';
import { customerStatus, getCustomers, validId } from './customersApi';
import type { CustomerPage, Query } from './customersApi';
import './customers.css';

const initial: Query = { page: 1, pageSize: 10, search: '', approvalStatus: '', sortBy: 'createdAt', sortOrder: 'desc' };
export default function Customers() {
  const { can } = usePermissions();
  const [query, setQuery] = useState(initial);
  const [data, setData] = useState<CustomerPage>({ data: [], total: 0, page: 1, pageSize: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lookup, setLookup] = useState('');
  const [lookupError, setLookupError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const timer = setTimeout(() => {
      getCustomers(query, controller.signal).then(result => { if (!controller.signal.aborted) setData(result); })
        .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load customers.'); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, attempt]);
  return <section className="customers-page">
    <header className="customers-heading"><div><h1>Customers</h1><p>Profiles, documents and account access</p></div><button disabled={loading} onClick={() => setAttempt(value => value + 1)}><Icon name="refresh" />Refresh customers</button></header>
    <Table caption="Customers" onRowClick={row => setSelected(row.id)} columns={[
      { key: 'fullName', label: 'Customer', sortable: true, render: row => <button className="table-link" onClick={() => setSelected(row.id)}>{row.fullName || 'Unnamed customer'}</button> },
      { key: 'email', label: 'Email', sortable: true }, { key: 'phoneNumber', label: 'Phone' },
      { key: 'isApproved', label: 'Status', render: row => <div className="customer-statuses"><StatusBadge status={customerStatus(row)} />{row.isBlocked && row.isApproved && <StatusBadge status="Approved" />}</div> },
      { key: 'createdAt', label: 'Registered · Dubai', sortable: true, render: row => date(row.createdAt) },
    ]} data={data.data} total={data.total} page={query.page} pageSize={query.pageSize} rowKey={row => row.id} loading={loading} error={error || null} search={query.search} sortBy={query.sortBy} sortOrder={query.sortOrder}
      onSearch={search => setQuery(previous => ({ ...previous, search, page: 1 }))} onSort={(sortBy, sortOrder) => setQuery(previous => ({ ...previous, sortBy, sortOrder, page: 1 }))} onPageChange={page => setQuery(previous => previous.page === page ? previous : { ...previous, page })} onRetry={() => setAttempt(value => value + 1)}
      filters={<>
        <label>Approval status<select value={query.approvalStatus} onChange={event => setQuery(previous => ({ ...previous, approvalStatus: event.target.value, page: 1 }))}><option value="">All customers</option><option value="approved">Approved</option><option value="pending">Pending verification</option><option value="blocked">Blocked</option></select></label>
        <label>Sort by<select value={query.sortBy} onChange={event => setQuery(previous => ({ ...previous, sortBy: event.target.value, page: 1 }))}><option value="createdAt">Registration date</option><option value="fullName">Name</option><option value="email">Email</option></select></label>
        <label>Order<select value={query.sortOrder} onChange={event => setQuery(previous => ({ ...previous, sortOrder: event.target.value as 'asc' | 'desc', page: 1 }))}><option value="desc">Descending</option><option value="asc">Ascending</option></select></label>
        <button onClick={() => setQuery(initial)}>Clear filters</button>
      </>} />
    <details className="customer-lookup"><summary><Icon name="search" />Open customer by UUID</summary><p>Find a specific record, including a deleted customer you want to restore.</p><form onSubmit={event => { event.preventDefault(); const id = lookup.trim().toLowerCase(); if (!validId(id)) { setLookupError('Enter a valid customer UUID.'); return; } setLookupError(''); setSelected(id); }}><label>Customer UUID<input value={lookup} placeholder="Enter the customer's UUID" autoComplete="off" spellCheck={false} aria-invalid={!!lookupError} aria-describedby={lookupError ? 'customer-lookup-error' : undefined} onChange={event => { setLookup(event.target.value); setLookupError(''); }} required /></label><button className="btn-soft-primary"><Icon name="search" />Open customer</button></form>{lookupError && <p id="customer-lookup-error" role="alert" className="error-message">{lookupError}</p>}</details>
    <Modal isOpen={selected !== null} title="Customer details" onClose={() => { if (!busy) setSelected(null); }}>{selected && <CustomerDetails key={selected} id={selected} canEdit={can('customers.edit')} canDelete={can('customers.delete')} canPay={can('debts.edit')} onBusy={setBusy} onChanged={() => setAttempt(value => value + 1)} />}</Modal>
  </section>;
}
