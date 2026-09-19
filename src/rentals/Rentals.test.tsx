import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { durationHours, getRental, getRentals, getRoute, parseRental, statuses } from './rentalsApi';
import type { Query } from './rentalsApi';
import RentalDetails from './RentalDetails';
import Rentals from './Rentals';
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const rental = { id: 1, status: 'Completed', user: null, car: null, startDate: null, totalPrice: 0 };
const query: Query = { page: 1, pageSize: 10, search: '', status: '', sortBy: 'startDate', sortOrder: 'desc' };
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it.each(statuses)('passes the exact %s filter and pagination to the backend', async status => {
  const fetcher = vi.fn().mockResolvedValue(json({ data: [], total: 0, page: 2, pageSize: 10 }));
  vi.stubGlobal('fetch', fetcher);
  await getRentals({ ...query, status, page: 2 });
  const url = new URL(String(fetcher.mock.calls[0][0]));
  expect(url.searchParams.get('status')).toBe(status);
  expect(url.searchParams.get('page')).toBe('2');
  expect(fetcher.mock.calls[0][1].credentials).toBe('include');
});
it('searches all returned pages, not just the visible page', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(json({ data: [rental], total: 2, page: 1, pageSize: 1 })).mockResolvedValueOnce(json({ data: [{ ...rental, id: 2, car: { plateNumber: 'XYZ' } }], total: 2, page: 2, pageSize: 1 }));
  vi.stubGlobal('fetch', fetcher);
  const result = await getRentals({ ...query, search: 'xyz' });
  expect(result.total).toBe(1); expect(result.data[0].id).toBe(2);
});
it('guards nulls and preserves zero and negative backend amounts', () => {
  expect(parseRental(rental).totalPrice).toBe(0);
  expect(parseRental({ ...rental, totalPrice: -35 }).totalPrice).toBe(-35);
  expect(() => parseRental({ ...rental, startDate: 'not-a-date' })).toThrow();
});
it('calculates completed and ongoing durations without inventing missing end times', () => {
  const startDate = '2026-09-18T20:00:00Z';
  expect(durationHours({ ...rental, startDate, endDate: '2026-09-18T22:00:00Z' })).toBe(2);
  expect(durationHours({ ...rental, startDate, status: 'Active' }, Date.parse('2026-09-18T23:00:00Z'))).toBe(3);
  expect(durationHours({ ...rental, startDate })).toBeNull();
  expect(durationHours({ ...rental, startDate, endDate: '2026-09-18T19:00:00Z' })).toBeNull();
});
it('combines inclusive hour bounds and Dubai calendar dates across pages', async () => {
  const inside = { ...rental, id: 2, startDate: '2026-09-18T20:00:00Z', endDate: '2026-09-18T22:00:00Z' };
  const outside = { ...inside, id: 1, startDate: '2026-09-18T19:59:59Z' };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({ data: [outside], total: 2, page: 1, pageSize: 1 })).mockResolvedValueOnce(json({ data: [inside], total: 2, page: 2, pageSize: 1 })));
  const result = await getRentals({ ...query, minHours: '2', maxHours: '2', startFrom: '2026-09-19', startTo: '2026-09-19' });
  expect(result.data.map(row => row.id)).toEqual([2]);
});
it('rejects invalid filter ranges before requesting data', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  await expect(getRentals({ ...query, minHours: '5', maxHours: '1' })).rejects.toThrow('Minimum duration');
  await expect(getRentals({ ...query, startFrom: '2026-09-20', startTo: '2026-09-19' })).rejects.toThrow('reversed');
  await expect(getRentals({ ...query, startFrom: '2026-02-30' })).rejects.toThrow('valid date');
  expect(fetcher).not.toHaveBeenCalled();
});
it('rejects a different rental detail ID', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ ...rental, id: 2 })));
  await expect(getRental(1)).rejects.toThrow('selection');
});
it('validates route coordinates and preserves latitude/longitude order', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(json({ rentalId: 1, distance: 2, coordinates: [{ latitude: 25, longitude: 55, at: '2026-09-19T00:00:00Z' }] })).mockResolvedValueOnce(json({ rentalId: 1, coordinates: [{ latitude: 200, longitude: 55, at: '2026-09-19T00:00:00Z' }] }));
  vi.stubGlobal('fetch', fetcher);
  expect((await getRoute(1)).points[0]).toMatchObject({ latitude: 25, longitude: 55 });
  await expect(getRoute(1)).rejects.toThrow('coordinates');
});
it('renders payment retry state and loads payments only when selected', async () => {
  const fetcher = vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/payments') ? json([{ id: 1, amount: 25, currency: 'AED', status: 'Failed', transactionType: 'InitialCharge', createdAt: null }]) : json({ ...rental, status: 'PaymentPending', paymentRetryState: { attempts: 2, reason: 'Insufficient funds' } }));
  vi.stubGlobal('fetch', fetcher); render(<RentalDetails rentalId={1} />);
  await screen.findByText('Insufficient funds');
  expect(fetcher.mock.calls.some(call => String(call[0]).endsWith('/payments'))).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Payments' }));
  await screen.findByText('25.00 AED'); expect(screen.getByText('Failed', { selector: '.status-badge' })).toBeTruthy();
});
it('renders cancellation reason and missing fields safely', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ ...rental, status: 'Cancelled', cancelReason: 'Customer request' })));
  render(<RentalDetails rentalId={1} />);
  await screen.findByText('Customer request');
  expect(screen.getByText('0.00 AED')).toBeTruthy();
});
it('shows list errors with a retry control', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ message: 'Rentals unavailable' }, 503)));
  render(<Rentals />);
  await screen.findByText('Rentals unavailable');
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
});
