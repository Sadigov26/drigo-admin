import { useEffect, useId } from 'react';
import type { ReactNode } from 'react';
import { EmptyState, ErrorState, LoadingState } from './States';
import { Icon } from './Icon';

export type SortOrder = 'asc' | 'desc';
export type Column<T> = {
  key: Extract<keyof T, string>;
  label: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
};

export type TableProps<T> = {
  caption: string;
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string | number;
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
  search: string;
  sortBy: string;
  sortOrder: SortOrder;
  onPageChange: (page: number) => void;
  onSort: (sortBy: string, sortOrder: SortOrder) => void;
  onSearch: (search: string) => void;
  onRetry: () => void;
  filters?: ReactNode;
  onRowClick?: (row: T) => void;
};

// Parents own query state and fetching. This component never invents API parameters.
export function Table<T>({ caption, columns, data, rowKey, total, page, pageSize, loading,
  error, search, sortBy, sortOrder, onPageChange, onSort, onSearch, onRetry, filters, onRowClick }: TableProps<T>) {
  const searchId = useId();
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

  useEffect(() => {
    if (!loading && !error && (page > pageCount || page < 1)) {
      onPageChange(Math.min(pageCount, Math.max(1, page)));
    }
  }, [page, pageCount, loading, error, onPageChange]);

  return (
    <div className="data-table">
      <div className="table-toolbar">
        <div className="table-search">
        <label htmlFor={searchId}><Icon name="search" />Search {caption.toLowerCase()}</label>
        <input id={searchId} type="search" value={search} onChange={event => {
          onSearch(event.target.value);
          onPageChange(1);
        }} />
        </div>
        {filters}
      </div>
      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={onRetry} />
        : data.length === 0 ? <EmptyState /> : (
          <div className="table-scroll" role="region" aria-label={caption} tabIndex={0}>
            <table>
              <caption className="sr-only">{caption}</caption>
              <thead><tr>{columns.map(column => (
                <th key={column.key} scope="col" aria-sort={column.sortable
                  ? sortBy === column.key ? sortOrder === 'asc' ? 'ascending' : 'descending' : 'none'
                  : undefined}>
                  {column.sortable ? (
                    <button type="button" onClick={() => {
                      onSort(column.key, sortBy === column.key && sortOrder === 'asc' ? 'desc' : 'asc');
                      onPageChange(1);
                    }}>
                      {column.label}
                      {sortBy === column.key && <span aria-hidden="true"> {sortOrder === 'asc' ? '↑' : '↓'}</span>}
                    </button>
                  ) : column.label}
                </th>
              ))}</tr></thead>
              <tbody>{data.map(row => (
                <tr key={rowKey(row)} className={onRowClick ? 'clickable-row' : undefined} onClick={onRowClick ? event => {
                  // Keep links, buttons and text selection independent of the row shortcut.
                  if ((event.target as HTMLElement).closest('button, a, input, select, textarea, summary') || window.getSelection()?.toString()) return;
                  onRowClick(row);
                } : undefined}>{columns.map(column => (
                  <td key={column.key}>{column.render ? column.render(row) : String(row[column.key] ?? '—')}</td>
                ))}</tr>
              ))}</tbody>
            </table>
          </div>
        )}
      <div className="table-pagination">
        <span>{loading ? 'Loading results…' : error ? 'Results unavailable' : `${total} results`}</span>
        <div>
          <button type="button" disabled={loading || !!error || page <= 1} onClick={() => onPageChange(page - 1)}><Icon name="left" />Previous</button>
          <span>Page {Math.min(Math.max(1, page), pageCount)} of {pageCount}</span>
          <button type="button" disabled={loading || !!error || page >= pageCount} onClick={() => onPageChange(page + 1)}>Next<Icon name="right" /></button>
        </div>
      </div>
    </div>
  );
}
