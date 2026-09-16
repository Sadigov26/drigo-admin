import { useId, useState } from 'react';
import { Table } from '../components/Table';
import type { Column, SortOrder } from '../components/Table';

// These dashboard endpoints return bounded snapshots, not server-paginated collections.
export function SnapshotTable<T extends { id: string | number }>({ title, rows, columns, filterKey, filterLabel, pageSize = 6 }: {
  title: string; rows: T[]; columns: Column<T>[]; filterKey: Extract<keyof T, string>; filterLabel: string; pageSize?: number;
}) {
  const filterId = useId();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: string; order: SortOrder }>({ key: '', order: 'asc' });
  const options = [...new Set(rows.map(row => String(row[filterKey])))].sort();
  const filtered = rows.filter(row => (!filter || String(row[filterKey]) === filter)
    && Object.values(row).some(value => String(value ?? '').toLowerCase().includes(search.trim().toLowerCase())));
  const sortKey = columns.find(column => column.key === sort.key)?.key;
  if (sortKey) filtered.sort((a, b) => {
    const left = a[sortKey], right = b[sortKey];
    const comparison = typeof left === 'number' && typeof right === 'number' ? left - right
      : String(left ?? '').localeCompare(String(right ?? ''), 'en', { numeric: true });
    return sort.order === 'asc' ? comparison : -comparison;
  });
  const filters = <div className="snapshot-filter"><label htmlFor={filterId}>{filterLabel}</label>
      <select id={filterId} value={filter} onChange={event => { setFilter(event.target.value); setPage(1); }}>
        <option value="">All</option>{options.map(option => <option key={option}>{option}</option>)}
      </select>
    </div>;
  return <Table caption={title} columns={columns} filters={filters} data={filtered.slice((page - 1) * pageSize, page * pageSize)} rowKey={row => row.id}
      total={filtered.length} page={page} pageSize={pageSize} loading={false} error={null} search={search}
      sortBy={sort.key} sortOrder={sort.order} onSearch={setSearch} onPageChange={setPage}
      onSort={(key, order) => setSort({ key, order })} onRetry={() => {}} />
}
