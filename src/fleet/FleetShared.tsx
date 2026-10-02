import { useState } from 'react';
import type { ReactNode } from 'react';
import { Table, type Column } from '../components/Table';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import type { Row } from './fleetApi';
import { RecordMedia, RecordLink } from '../components/RecordMedia';
export const label = (key: string) => ({ id: 'Record ID', carId: 'Vehicle ID', imei: 'IMEI', online: 'Connection', url: 'Photo', api: 'Application', database: 'Data storage', redis: 'Cache', docker: 'Services', teltonika: 'Vehicle connectivity' }[key] ?? key.replace(/Urls?$/i, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase()).replace(/^Is /, '').replace(/ Mb$/, ' (MB)').replace(/ Km$/, ' (km)').replace(/ Ms$/, ' (ms)'));
export function regionName(code: unknown): string | null {
  if (typeof code !== 'string' || !/^[A-Za-z]{2}$/.test(code)) return null;
  try { const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()); return name && name !== code.toUpperCase() ? name : null; } catch { return null; }
}
export function valueView(value: unknown, key = ''): ReactNode {
  if (value == null || value === '') return '—';
  if (key === 'countryCode' && regionName(value)) return <span className="fleet-country">{String(value).toUpperCase()} · {regionName(value)}</span>;
  if (typeof value === 'boolean') {
    if (key === 'isSuperAdmin') return <span className={`status-badge ${value ? 'status-info' : 'status-neutral'}`}>{value ? 'Super admin' : 'Standard admin'}</span>;
    if (key === 'isActive') return <StatusBadge status={value ? 'Active' : 'Inactive'} />;
    return key === 'online' ? <StatusBadge status={value ? 'Online' : 'Offline'} /> : value ? 'Yes' : 'No';
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '—';
    if (/^(lat|lng|latitude|longitude)$/.test(key)) return value.toFixed(6);
    if (/^(id|carId)$/.test(key)) return String(value);
    if (/fuelLevel|utilizationRate/.test(key)) return `${value.toFixed(0)}%`;
    const unit = /revenue/i.test(key) ? ' AED' : /distance|odometer/i.test(key) ? ' km' : key === 'radiusMeters' ? ' m' : '';
    return value.toLocaleString('en-GB', { maximumFractionDigits: 2, minimumFractionDigits: unit === ' AED' ? 2 : 0 }) + unit;
  }
  if (Array.isArray(value) && value.length && value.every(item => item == null || typeof item !== 'object')) return <ul className="fleet-chips">{value.map((item, i) => <li key={i}>{valueView(item, key)}</li>)}</ul>;
  if (typeof value === 'object') return Array.isArray(value) ? value.length ? <div className="fleet-nested">{value.map((item, i) => <article className="fleet-record-card" key={i}><header><strong>{item && typeof item === 'object' ? String((item as Row).plateNumber ?? (item as Row).source ?? (item as Row).name ?? `Record ${i + 1}`) : `Record ${i + 1}`}</strong>{item && typeof item === 'object' && (item as Row).id != null && <span className="fleet-record-id">#{String((item as Row).id)}</span>}</header>{valueView(item, key)}</article>)}</div> : 'No records' : <Fields row={value as Row} />;
  if (typeof value === 'string' && /^(https?:\/\/)/i.test(value)) return /photo|image|thumbnail|medium|media|^url$/i.test(key) ? <RecordMedia value={value} title={label(key.replace(/url$/i, '') || 'Photo')} /> : <RecordLink value={value} />;
  if (/At$/.test(key)) { const date = new Date(String(value)); return Number.isFinite(date.getTime()) ? date.toLocaleString('en-GB', { timeZone: 'Asia/Dubai' }) : String(value); }
  if (key === 'status') return <StatusBadge status={String(value)} />;
  return String(value);
}
// A compact table for lists of records, used instead of one large card per row.
export function CompactTable({ rows }: { rows: Row[] }) {
  const keys = [...new Set(rows.flatMap(row => Object.keys(row)))];
  return <div className="table-scroll fleet-compact" role="region" tabIndex={0} aria-label="Records"><table><thead><tr>{keys.map(key => <th key={key} scope="col">{label(key)}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id ?? row.name ?? index)}>{keys.map(key => <td key={key}>{valueView(row[key], key)}</td>)}</tr>)}</tbody></table></div>;
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
  return <><Table caption={title} columns={columns} data={filtered.slice((page - 1) * 10, page * 10)} rowKey={row => String(row.id ?? row.carId ?? row.city ?? row.entry ?? row.countryCode)} total={filtered.length} page={page} pageSize={10} loading={loading} error={error} search={search} sortBy={sort.key} sortOrder={sort.order} onSearch={setSearch} onSort={(key, order) => setSort({ key, order })} onPageChange={setPage} onRetry={refresh} onRowClick={setDetail} filters={filterStatus && <label>Status<select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option>{[...new Set(data.map(row => String(row.status ?? '')))].filter(Boolean).map(s => <option key={s}>{s}</option>)}</select></label>} />
    {detail && <Modal isOpen title={`${title} · ${detail.id ?? detail.carId ?? detail.city ?? ''}`} onClose={() => setDetail(null)}><div className="fleet-detail"><p className="fleet-note">Dates are shown in Dubai time.</p><Fields row={detail} /></div></Modal>}
  </>;
}
