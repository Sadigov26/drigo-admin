import { useState } from 'react';
import { usePermissions } from './PermissionsContext';
import { Table } from '../components/Table';
import type { Column, SortOrder } from '../components/Table';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';

type PermissionRow = { code: string; status: string };

export function PermissionsTable() {
  const { state, retry } = usePermissions();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const pageSize = 5;

  // This endpoint returns all permissions, not a paginated API result.
  const rows: PermissionRow[] = state.status === 'ready'
    ? state.data.permissionCodes.filter(code => code.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => sortOrder === 'asc' ? a.localeCompare(b) : b.localeCompare(a))
      .map(code => ({ code, status: 'Granted' })) : [];

  const columns: Column<PermissionRow>[] = [
    { key: 'code', label: 'Permission', sortable: true, render: row => (
      <button type="button" className="table-link" onClick={() => setSelectedCode(row.code)}>{row.code}</button>
    ) },
    { key: 'status', label: 'Status', render: row => <StatusBadge status={row.status} /> },
  ];

  return (
    <section className="permissions-section" aria-labelledby="permissions-title">
      <h2 id="permissions-title">Your permissions</h2>
      <p className="page-description">Permissions assigned to your account. Select one to view its details.</p>
      <Table caption="Permissions" columns={columns} rowKey={row => row.code}
        data={rows.slice((page - 1) * pageSize, page * pageSize)} total={rows.length}
        page={page} pageSize={pageSize} loading={state.status === 'loading'}
        error={state.status === 'error' ? state.message : null}
        search={search} sortBy="code" sortOrder={sortOrder}
        onPageChange={setPage} onSearch={setSearch} onSort={(_, order) => setSortOrder(order)} onRetry={retry} />
      <Modal isOpen={selectedCode !== null} title="Permission details" onClose={() => setSelectedCode(null)}>
        <dl className="connection-details">
          <div><dt>Permission</dt><dd>{selectedCode}</dd></div>
          <div><dt>Module</dt><dd>{selectedCode?.split('.')[0]}</dd></div>
          <div><dt>Action</dt><dd>{selectedCode?.split('.').slice(1).join('.')}</dd></div>
          <div><dt>Status</dt><dd><StatusBadge status="Granted" /></dd></div>
        </dl>
      </Modal>
    </section>
  );
}
