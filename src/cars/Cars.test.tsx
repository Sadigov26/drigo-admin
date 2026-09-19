import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Cars from './Cars';
import { CarForm } from './CarForm';
import { CarDetails } from './CarDetails';
import { carStatus, deleteCar, getCar, getCars, parsePage, saveCar } from './carsApi';
import type { Car, Query } from './carsApi';
import { SESSION_EXPIRED_EVENT } from '../api/client';

const permissions = vi.hoisted(() => ({ codes: ['cars.view', 'cars.create', 'cars.edit', 'cars.delete'] }));
vi.mock('../permissions/PermissionsContext', () => ({ usePermissions: () => ({ can: (code: string) => permissions.codes.includes(code) }) }));
const row: Car = { id: 1, plateNumber: 'TEST-1', brandName: 'Toyota', modelName: 'Yaris', isActive: true, activeRentalId: null, fuelLevel: 0 };
const detail = { ...row, brandId: 1, modelId: 1, colorId: 1, fuelTypeId: 1, manufactureYear: 2023, maxSpeed: 180, engineCapacity: 2, distance: 0, transmission: 0, location: { city: 'Dubai' } };
const query: Query = { page: 1, pageSize: 10, search: '', sortBy: 'createdAt', sortOrder: 'desc', status: '' };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const envelope = (data: Car[], total = data.length) => ({ data, total, page: 1, pageSize: 10 });
function mockServer() {
  const fn = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = new URL(String(input));
    if (options?.method === 'DELETE') return json({ success: true });
    if (options?.method === 'PUT' || options?.method === 'POST') return json({ id: 1 });
    if (url.pathname === '/api/admin/cars') return json(envelope([row]));
    if (url.pathname === '/api/admin/cars/1') return json(detail);
    if (url.pathname === '/api/admin/cars/1/status') return json({ carId: 1, engineOn: false, doorsLocked: true, online: true, speed: 0, fuelLevel: 0, activeRentalId: 99 });
    if (url.pathname === '/api/admin/brands') return json({ data: [{ id: 1, name: 'Toyota' }], total: 1 });
    return json([{ id: 1, name: url.pathname === '/api/admin/cities' ? 'Dubai' : 'Option' }]);
  });
  vi.stubGlobal('fetch', fn); return fn;
}
const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  permissions.codes = ['cars.view', 'cars.create', 'cars.edit', 'cars.delete'];
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  for (const [key, descriptor] of [['showModal', originalShow], ['close', originalClose]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, key, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, key);
  }
});

describe('Cars API contracts', () => {
  it('guards null fields, zero fuel, invalid counts and duplicate IDs', () => {
    expect(parsePage(envelope([{ ...row, plateNumber: null }])).data[0].fuelLevel).toBe(0);
    expect(() => parsePage({ ...envelope([]), total: -1 })).toThrow();
    expect(() => parsePage(envelope([row, row]))).toThrow();
    expect(() => parsePage(envelope([{ ...row, fuelLevel: 101 }]))).toThrow();
    expect(carStatus({ ...row, activeRentalId: 5 })).toBe('Rented');
    expect(carStatus({ ...row, isActive: false })).toBe('Inactive');
  });
  it('sends real server paging/search/sort parameters with cookies', async () => {
    const fn = mockServer();
    await getCars({ ...query, page: 2, search: 'Toyota & Kia', sortBy: 'plateNumber', sortOrder: 'asc' }, new AbortController().signal);
    const url = new URL(String(fn.mock.calls[0][0]));
    expect(url.searchParams.get('page')).toBe('2'); expect(url.searchParams.get('search')).toBe('Toyota & Kia');
    expect(url.searchParams.get('sortBy')).toBe('plateNumber'); expect(fn.mock.calls[0][1]?.credentials).toBe('include');
  });
  it('filters across all server pages before paging the result', async () => {
    const fn = vi.fn().mockResolvedValueOnce(json({ data: [row], total: 2, page: 1, pageSize: 1 }))
      .mockResolvedValueOnce(json({ data: [{ ...row, id: 2, isActive: false }], total: 2, page: 2, pageSize: 1 }));
    vi.stubGlobal('fetch', fn);
    const result = await getCars({ ...query, status: 'Inactive' }, new AbortController().signal);
    expect(result.total).toBe(1); expect(result.data[0].id).toBe(2); expect(fn).toHaveBeenCalledTimes(2);
    expect(String(fn.mock.calls[0][0])).not.toContain('status=');
  });
  it('rejects a mismatched detail and uses POST, PUT and DELETE', async () => {
    const fn = mockServer();
    await saveCar(null, { plateNumber: 'NEW' }); await saveCar(1, { maxSpeed: 200 }); await deleteCar(1);
    expect(fn.mock.calls.map(call => call[1]?.method)).toEqual(['POST', 'PUT', 'DELETE']);
    fn.mockResolvedValueOnce(json({ id: 2 })); await expect(getCar(1)).rejects.toThrow('does not match');
  });
  it('propagates 401 to the shared session-expiry handler', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ message: 'Not authenticated' }, 401)));
    const expired = vi.fn(); window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    try { await expect(getCar(1)).rejects.toThrow('Not authenticated'); expect(expired).toHaveBeenCalledOnce(); }
    finally { window.removeEventListener(SESSION_EXPIRED_EVENT, expired); }
  });
});
describe('Cars UI', () => {
  it('formats summary values and renders feature names without internal metadata', () => {
    render(<CarDetails car={{ ...detail, fuelLevel: 15.99000000000002, price: 199, tariffPackageId: 5, carFeatures: [{ id: 4, name: 'Sunroof', icon: null }] }} />);
    expect(screen.getByText('16%')).toBeTruthy(); expect(screen.getByText('199 AED')).toBeTruthy();
    expect(screen.getByText('180 km/h')).toBeTruthy(); expect(screen.getByText('Sunroof')).toBeTruthy();
    expect(screen.queryByText('Icon')).toBeNull(); expect(screen.queryByText('Not provided')).toBeNull();
  });
  it('loads real rows and opens null-safe detail without rendering HTML', async () => {
    mockServer(); render(<Cars />);
    fireEvent.click(await screen.findByRole('button', { name: 'TEST-1' }));
    const modal = screen.getByRole('dialog'); expect(await within(modal).findByText('Max speed')).toBeTruthy();
    expect(within(modal).getByText('Rented')).toBeTruthy();
    expect(within(modal).getByText('#99')).toBeTruthy();
    expect(within(modal).getAllByText('—').length).toBeGreaterThan(0);
    cleanup(); render(<CarDetails car={{ id: 1, plateNumber: '<img src=x onerror=alert(1)>' }} />);
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy(); expect(document.querySelector('img')).toBeNull();
  });
  it('hides all mutation controls for view-only permission', async () => {
    permissions.codes = ['cars.view']; mockServer(); render(<Cars />);
    await screen.findByRole('button', { name: 'TEST-1' });
    expect(screen.queryByRole('button', { name: 'Add car' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit TEST-1' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete TEST-1' })).toBeNull();
  });
  it('requires delete confirmation and preserves the dialog on 409', async () => {
    const fn = mockServer(); render(<Cars />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete TEST-1' }));
    expect(fn.mock.calls.some(call => call[1]?.method === 'DELETE')).toBe(false);
    fn.mockResolvedValueOnce(json({ message: 'Cannot delete a car with an active rental' }, 409));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect(await screen.findByRole('alert')).toBeTruthy(); expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('active rental');
  });
  it('refreshes the list after successful deletion', async () => {
    const fn = mockServer(); render(<Cars />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete TEST-1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    await screen.findByText('Car deleted. The list has been refreshed.');
    await waitFor(() => expect(fn.mock.calls.filter(call => new URL(String(call[0])).pathname === '/api/admin/cars').length).toBe(2));
  });
  it('shows list errors with retry and recovers to an empty list', async () => {
    const fn = vi.fn().mockResolvedValueOnce(json({ message: 'Service unavailable' }, 503)).mockResolvedValue(json(envelope([])));
    vi.stubGlobal('fetch', fn); render(<Cars />);
    await screen.findByText('Service unavailable'); fireEvent.click(screen.getByRole('button', { name: /retry|try again/i }));
    await waitFor(() => expect(screen.queryByText('Service unavailable')).toBeNull());
    await screen.findByText('0 results');
  });
  it('submits numeric edit fields and never sends unsupported city changes', async () => {
    mockServer(); const save = vi.fn(); render(<CarForm car={detail} busy={false} onSave={save} onCancel={() => {}} />);
    await screen.findByLabelText('Maximum speed (km/h)');
    await waitFor(() => expect((screen.getByLabelText('Model') as HTMLSelectElement).disabled).toBe(false));
    fireEvent.change(screen.getByLabelText('Maximum speed (km/h)'), { target: { value: '220' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save car' }).closest('form')!);
    expect(save).toHaveBeenCalledOnce(); expect(save.mock.calls[0][0].maxSpeed).toBe(220);
    expect(save.mock.calls[0][0]).not.toHaveProperty('city');
    expect(save.mock.calls[0][0]).not.toHaveProperty('distance');
  });
  it('clears model/color after changing brands', async () => {
    mockServer(); render(<CarForm car={detail} busy={false} onSave={() => {}} onCancel={() => {}} />);
    await screen.findByLabelText('Brand');
    await waitFor(() => expect((screen.getByLabelText('Model') as HTMLSelectElement).disabled).toBe(false));
    fireEvent.change(screen.getByLabelText('Brand'), { target: { value: '' } });
    expect((screen.getByLabelText('Model') as HTMLSelectElement).value).toBe('');
    expect((screen.getByLabelText('Color') as HTMLSelectElement).value).toBe('');
  });
});
