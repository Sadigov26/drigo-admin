import { useState } from 'react';
import { getProblems } from './telematicsApi';
import { carStatus } from './carsApi';
import { useVehicleResource } from './useVehicleResource';
import { Table } from '../components/Table';
import { VehicleControls } from './VehicleControls';
import { Modal } from '../components/Modal';
import type { SortOrder } from '../components/Table';
import { StatusBadge } from '../components/StatusBadge';

export default function ProblematicCars() {
  const resource = useVehicleResource(getProblems);
  const [search, setSearch] = useState('');
  const [issue, setIssue] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: 'plateNumber' | 'fuelLevel'; order: SortOrder }>({ key: 'plateNumber', order: 'asc' });
  const [selected, setSelected] = useState<number | null>(null);
  const rows = (resource.data ?? []).filter(car => (!issue || car.issues.includes(issue)) && [car.plateNumber, car.brandName, car.modelName, car.issueText].some(value => value?.toLowerCase().includes(search.trim().toLowerCase())));
  rows.sort((a, b) => { const left = a[sort.key], right = b[sort.key]; const comparison = typeof left === 'number' && typeof right === 'number' ? left - right : String(left ?? '').localeCompare(String(right ?? ''), 'en', { numeric: true }); return sort.order === 'asc' ? comparison : -comparison; });
  const issues = [...new Set((resource.data ?? []).flatMap(car => car.issues))].sort();
  return <section><div className="vehicle-section-heading"><h2>Problematic cars</h2><button disabled={resource.loading} onClick={resource.refresh}>Refresh issues</button></div>
    <Table caption="Problematic cars" columns={[
      { key: 'plateNumber', label: 'Plate', sortable: true, render: car => <button className="car-link" onClick={() => setSelected(car.id)}>{car.plateNumber ?? `#${car.id}`}</button> },
      { key: 'brandName', label: 'Brand' }, { key: 'modelName', label: 'Model' }, { key: 'isActive', label: 'Status', render: car => <StatusBadge status={carStatus(car)} /> },
      { key: 'fuelLevel', label: 'Fuel', sortable: true, render: car => car.fuelLevel == null ? '—' : `${Math.round(car.fuelLevel)}%` }, { key: 'issueText', label: 'Issues' },
    ]} data={rows.slice((page - 1) * 10, page * 10)} rowKey={car => car.id} total={rows.length} page={page} pageSize={10} loading={resource.loading} error={resource.error || null} search={search} sortBy={sort.key} sortOrder={sort.order} onSearch={setSearch} onPageChange={setPage} onSort={(key, order) => setSort({ key: key as 'plateNumber' | 'fuelLevel', order })} onRetry={resource.refresh}
      filters={<label>Issue<select value={issue} onChange={event => { setIssue(event.target.value); setPage(1); }}><option value="">All issues</option>{issues.map(item => <option key={item}>{item}</option>)}</select></label>} />
    <Modal isOpen={selected != null} title="Vehicle status" onClose={() => setSelected(null)}>{selected != null && <VehicleControls key={selected} carId={selected} onChanged={resource.refresh} />}</Modal>
  </section>;
}
