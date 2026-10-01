import { useState } from 'react';
import type { ReactNode } from 'react';
import { Table, type Column } from '../components/Table';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import type { Row } from './fleetApi';
export const label = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
export function valueView(value: unknown, key = ''): ReactNode {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '—';
    if (/^(lat|lng|latitude|longitude)$/.test(key)) return value.toFixed(6);
    if (/^(id|carId)$/.test(key)) return String(value);
    if (/fuelLevel|utilizationRate/.test(key)) return `${value.toFixed(0)}%`;
    const unit = /revenue/i.test(key) ? ' AED' : /distance|odometer/i.test(key) ? ' km' : key === 'radiusMeters' ? ' m' : '';
    return value.toLocaleString('en-GB', { maximumFractionDigits: 2, minimumFractionDigits: unit === ' AED' ? 2 : 0 }) + unit;
  }
  if (typeof value === 'object') return Array.isArray(value) ? value.length ? <div className="fleet-nested">{value.map((item, i) => <div key={i}>{valueView(item)}</div>)}</div> : 'No records' : <Fields row={value as Row} />;
  if (/At$/.test(key)) { const date = new Date(String(value)); return Number.isFinite(date.getTime()) ? date.toLocaleString('en-GB', { timeZone: 'Asia/Dubai' }) : String(value); }
  if (key === 'status') return <StatusBadge status={String(value)} />;
  return String(value);
}
export function Fields({ row }: { row: Row }) {
  return <dl className="fleet-fields">{Object.entries(row).map(([key, value]) => <div key={key} className={value && typeof value === 'object' ? 'fleet-wide' : ''}><dt>{label(key)}</dt><dd>{valueView(value, key)}</dd></div>)}</dl>;
}
export function Records({ title, data, loading, error, refresh, keys, actions, filterStatus = false }: {
  title: string; data: Row[]; loading: boolean; error: string | null; refresh: () => void; keys: string[]; actions?: (row: Row) => ReactNode; filterStatus?: boolean;
}) {
  const [page, setPage] = useState(1), [search, setSearch] = useState(''), [status, setStatus] = useState('');
  const [sort, setSort] = useState({ key: keys.includes('createdAt') ? 'createdAt' : keys[0] ?? 'id', order: (keys.includes('createdAt') ? 'desc' : 'asc') as 'asc' | 'desc' });
  const [detail, setDetail] = useState<Row | null>(null);
  const filtered = data.filter(row => (!status || row.status === status) && JSON.stringify(row).toLowerCase().includes(search.toLowerCase())).sort((a, b) => {
    const av = a[sort.key], bv = b[sort.key];
    return (typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true })) * (sort.order === 'asc' ? 1 : -1);
  });
  const columns: Column<Row>[] = keys.map((key, i) => ({ key, label: label(key) + (/At$/.test(key) ? ' · Dubai' : ''), sortable: true, render: row => i === 0 ? <button className="table-link" onClick={() => setDetail(row)}>{valueView(row[key], key)}</button> : valueView(row[key], key) }));
  if (actions) columns.push({ key: 'actions', label: 'Actions', render: row => <div className="fleet-actions">{actions(row)}</div> });
  return <><Table caption={title} columns={columns} data={filtered.slice((page - 1) * 10, page * 10)} rowKey={row => String(row.id ?? row.carId ?? row.city)} total={filtered.length} page={page} pageSize={10} loading={loading} error={error} search={search} sortBy={sort.key} sortOrder={sort.order} onSearch={setSearch} onSort={(key, order) => setSort({ key, order })} onPageChange={setPage} onRetry={refresh} onRowClick={setDetail} filters={filterStatus && <label>Status<select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option>{[...new Set(data.map(row => String(row.status ?? '')))].filter(Boolean).map(s => <option key={s}>{s}</option>)}</select></label>} />
    {detail && <Modal isOpen title={`${title} · ${detail.id ?? detail.carId ?? detail.city ?? ''}`} onClose={() => setDetail(null)}><div className="fleet-detail"><p className="fleet-note">Record snapshot. Dates shown in Dubai time. Close and refresh the list for the latest data.</p><Fields row={detail} /></div></Modal>}
  </>;
}
