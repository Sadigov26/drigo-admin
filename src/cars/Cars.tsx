import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Table } from '../components/Table';
import type { Column } from '../components/Table';
import { Modal } from '../components/Modal';
import { ErrorState, LoadingState } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import { usePermissions } from '../permissions/PermissionsContext';
import { ApiError } from '../api/client';
import { carStatus, deleteCar, getCar, getCars, saveCar } from './carsApi';
import type { Car, CarDetail, Page, Query } from './carsApi';
import { CarForm } from './CarForm';
import { CarDetails } from './CarDetails';
import { VehicleControls } from './VehicleControls';
import './cars.css';

type Selection = { mode: 'detail' | 'edit' | 'delete'; car: Car } | { mode: 'create' };
const CarRoute = lazy(() => import('./CarRoute'));
const initial: Query = { page: 1, pageSize: 10, search: '', sortBy: 'createdAt', sortOrder: 'desc', status: '' };
const message = (cause: unknown) => cause instanceof Error ? cause.message : 'Unable to complete the request.';
export default function Cars() {
  const { can } = usePermissions();
  const [query, setQuery] = useState(initial);
  const [page, setPage] = useState<Page>({ data: [], total: 0, page: 1, pageSize: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cityError, setCityError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [detail, setDetail] = useState<CarDetail | null>(null);
  const [detailError, setDetailError] = useState('');
  const [detailAttempt, setDetailAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null); setCityError(false);
    // Small debounce also cancels old list and city requests when controls change.
    const timer = window.setTimeout(() => {
      getCars(query, controller.signal).then(async result => {
        if (controller.signal.aborted) return;
        setPage(result); setLoading(false);
        const cities = await Promise.all(result.data.map(async car => {
          try {
            const detail = await getCar(car.id, controller.signal);
            const location = detail.location;
            const city = location && typeof location === 'object' && 'city' in location && typeof location.city === 'string' ? location.city : null;
            return { ...car, city };
          } catch { if (!controller.signal.aborted) setCityError(true); return { ...car, city: 'Unavailable' }; }
        }));
        if (!controller.signal.aborted) setPage({ ...result, data: cities });
      }).catch(cause => { if (!controller.signal.aborted) { setError(message(cause)); setLoading(false); } });
    }, 200);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, revision]);
  const selectedId = selection && selection.mode !== 'create' ? selection.car.id : null;
  useEffect(() => {
    setDetail(null); setDetailError('');
    if (selectedId == null || selection?.mode === 'delete') return;
    const controller = new AbortController();
    getCar(selectedId, controller.signal).then(data => { if (!controller.signal.aborted) setDetail(data); })
      .catch(cause => { if (!controller.signal.aborted) setDetailError(message(cause)); });
    return () => controller.abort();
  }, [selectedId, selection?.mode, detailAttempt]);
  function open(next: Selection) { setDetail(null); setActionError(''); setDetailError(''); setSelection(next); }
  function close() { if (!lock.current) { setSelection(null); setActionError(''); } }
  async function save(body: Record<string, string | number>) {
    if (!selection || lock.current || !can(selection.mode === 'create' ? 'cars.create' : 'cars.edit')) return;
    lock.current = true; setBusy(true); setActionError('');
    try {
      await saveCar(selection.mode === 'create' ? null : selection.car.id, body);
      if (mounted.current) { setSelection(null); setNotice('Car saved. The list has been refreshed.'); setRevision(value => value + 1); }
    } catch (cause) { if (mounted.current) setActionError(message(cause) + ' If the connection was interrupted, check the list before retrying.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  async function remove() {
    if (!selection || selection.mode !== 'delete' || lock.current || !can('cars.delete')) return;
    lock.current = true; setBusy(true); setActionError('');
    try {
      await deleteCar(selection.car.id);
      if (mounted.current) { setSelection(null); setNotice('Car deleted. The list has been refreshed.'); setRevision(value => value + 1); }
    } catch (cause) { if (mounted.current) setActionError(cause instanceof ApiError && cause.status === 409 ? `Cannot delete this car: ${cause.message}` : message(cause)); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  const columns: Column<Car>[] = [
    { key: 'plateNumber', label: 'Plate', sortable: true, render: car => <button className="car-link" onClick={() => open({ mode: 'detail', car })}>{car.plateNumber ?? `Car #${car.id}`}</button> },
    { key: 'brandName', label: 'Brand', sortable: true }, { key: 'modelName', label: 'Model', sortable: true },
    { key: 'isActive', label: 'Status', render: car => <StatusBadge status={carStatus(car)} /> },
    { key: 'city', label: 'Current city', render: car => car.city === undefined ? 'Loading…' : car.city ?? 'Not provided' },
    { key: 'fuelLevel', label: 'Fuel', sortable: true, render: car => car.fuelLevel == null ? 'Not provided' : `${car.fuelLevel.toFixed(1)}%` },
    { key: 'id', label: 'Actions', render: car => <div className="car-row-actions">{can('cars.edit') && <button onClick={() => open({ mode: 'edit', car })} aria-label={`Edit ${car.plateNumber ?? car.id}`}>Edit</button>}{can('cars.delete') && <button onClick={() => open({ mode: 'delete', car })} aria-label={`Delete ${car.plateNumber ?? car.id}`}>Delete</button>}</div> },
  ];
  return <section className="cars-page">
    <header className="cars-heading"><div><h1>Cars</h1><p>Vehicle records and fleet availability</p></div><div className="car-actions"><button disabled={loading} onClick={() => setRevision(value => value + 1)}>Refresh cars</button>{can('cars.create') && <button className="car-primary" onClick={() => open({ mode: 'create' })}>Add car</button>}</div></header>
    {notice && <p role="status" className="car-notice">{notice}</p>}
    {cityError && <p role="status" className="car-note">Some city details could not be loaded. Use Refresh cars to retry.</p>}
    <Table caption="Cars" columns={columns} data={page.data} rowKey={car => car.id} total={page.total} page={query.page} pageSize={query.pageSize} loading={loading} error={error} search={query.search} sortBy={query.sortBy} sortOrder={query.sortOrder}
      filters={<>
        <label>Status<select value={query.status} onChange={event => setQuery(previous => ({ ...previous, status: event.target.value, page: 1 }))}><option value="">All statuses</option><option>Active</option><option>Inactive</option><option>Rented</option></select></label>
        <label>Sort by<select value={query.sortBy} onChange={event => setQuery(previous => ({ ...previous, sortBy: event.target.value, page: 1 }))}><option value="createdAt">Date added</option><option value="plateNumber">Plate</option><option value="brandName">Brand</option><option value="modelName">Model</option><option value="fuelLevel">Fuel level</option></select></label>
        <label>Order<select value={query.sortOrder} onChange={event => setQuery(previous => ({ ...previous, sortOrder: event.target.value as 'asc' | 'desc', page: 1 }))}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label>
      </>}
      onSearch={search => setQuery(previous => ({ ...previous, search, page: 1 }))} onSort={(sortBy, sortOrder) => setQuery(previous => ({ ...previous, sortBy, sortOrder, page: 1 }))}
      onPageChange={next => setQuery(previous => previous.page === next ? previous : { ...previous, page: next })} onRetry={() => setRevision(value => value + 1)} />
    <Modal isOpen={selection != null} title={selection?.mode === 'create' ? 'Add car' : selection?.mode === 'edit' ? 'Edit car' : selection?.mode === 'delete' ? 'Delete car' : 'Car details'} onClose={close}>
      {actionError && <p className="error-message" role="alert">{actionError}</p>}
      {selection?.mode === 'delete' ? <><p>Delete <strong>{selection.car.plateNumber ?? `car #${selection.car.id}`}</strong>? This cannot be undone.</p><p className="car-note">The backend will reject deletion if the car has an active rental.</p><div className="car-actions"><button disabled={busy} onClick={close}>Cancel</button><button className="car-danger" disabled={busy} onClick={() => void remove()}>{busy ? 'Deleting…' : 'Confirm delete'}</button></div></>
        : selection?.mode === 'create' ? <CarForm car={null} busy={busy} onSave={body => void save(body)} onCancel={close} />
        : detailError ? <ErrorState message={detailError} onRetry={() => setDetailAttempt(value => value + 1)} />
        : !detail ? <LoadingState message="Loading car…" />
        : selection?.mode === 'edit' ? <CarForm car={detail} busy={busy} onSave={body => void save(body)} onCancel={close} />
        : <><CarDetails car={{ ...detail, activeRentalId: selection?.car.activeRentalId ?? null }} /><VehicleControls key={detail.id} carId={detail.id} onChanged={() => { setDetailAttempt(value => value + 1); setRevision(value => value + 1); }} /><Suspense fallback={<LoadingState message="Loading map…" />}><CarRoute key={detail.id} carId={detail.id} /></Suspense></>}
    </Modal>
  </section>;
}
