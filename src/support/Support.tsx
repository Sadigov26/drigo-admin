import { useEffect, useState } from 'react';
import { Table, type Column } from '../components/Table';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { StatusBadge } from '../components/StatusBadge';
import { date } from '../customers/CustomerDetails';
import { usePermissions } from '../permissions/PermissionsContext';
import { statuses, tickets, type Ticket } from './supportApi';
import { useSupportData } from './useSupportData';
import { TicketDetail } from './TicketDetail';
import './support.css';

export default function Support() {
  const list = useSupportData(tickets);
  const { can } = usePermissions();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState({ key: 'lastMessageAt', order: 'desc' as 'asc' | 'desc' });
  useEffect(() => { if (list.data) setSelected(previous => previous ? list.data!.find(row => row.id === previous.id) ?? previous : null); }, [list.data]);
  const rows = (list.data ?? []).filter(row => (!status || row.status === status) && [row.id, row.memberName, row.memberPhone, row.lastMessage, row.reasonName].some(value => String(value ?? '').toLowerCase().includes(search.trim().toLowerCase())))
    .sort((a, b) => String(a[sort.key] ?? '').localeCompare(String(b[sort.key] ?? ''), 'en', { numeric: true }) * (sort.order === 'asc' ? 1 : -1));
  const columns: Column<Ticket>[] = [
    { key: 'id', label: 'Ticket', sortable: true, render: row => <button className="text-button" onClick={() => setSelected(row)}>#{row.id}</button> },
    { key: 'memberName', label: 'Customer', sortable: true, render: row => <><strong>{row.memberName || '—'}</strong><small className="support-secondary">{String(row.reasonName ?? '—')}</small></> },
    { key: 'lastMessage', label: 'Last message', render: row => <span className="support-excerpt">{String(row.lastMessage ?? 'No messages yet')}</span> },
    { key: 'status', label: 'Status', render: row => <StatusBadge status={row.status} /> },
    { key: 'unreadCount', label: 'Unread', render: row => <span className={Number(row.unreadCount) > 0 ? 'support-unread' : ''}>{row.unreadCount ?? 0}</span> },
    { key: 'lastMessageAt', label: 'Updated · Dubai', sortable: true, render: row => date(row.lastMessageAt ?? row.updatedAt) },
  ];
  return <section className="support-page">
    <header className="support-heading"><div><h1>Support</h1><p>Conversations and customer care</p></div><button onClick={list.refresh} disabled={list.loading}><Icon name="refresh" />Refresh tickets</button></header>
    <Table caption="Support tickets" columns={columns} data={rows.slice((page - 1) * 10, page * 10)} total={rows.length} rowKey={row => row.id} page={page} pageSize={10} loading={list.loading} error={list.error} search={search} onSearch={setSearch} sortBy={sort.key} sortOrder={sort.order} onSort={(key, order) => setSort({ key, order })} onPageChange={setPage} onRetry={list.refresh} onRowClick={setSelected}
      filters={<label>Status<select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option>{statuses.map(value => <option key={value}>{value}</option>)}</select></label>} />
    <Modal isOpen={!!selected} title={`Support #${selected?.id ?? ''}`} onClose={() => { if (!busy) setSelected(null); }}>
      {selected && <TicketDetail key={selected.id} id={selected.id} unread={selected.unreadCount ?? 0} canEdit={can('support.edit')} onChanged={list.refresh} onBusy={setBusy} />}
    </Modal>
  </section>;
}
