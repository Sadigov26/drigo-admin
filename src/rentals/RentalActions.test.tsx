import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { performRentalAction, getPackages } from './rentalActionsApi';
import RentalDetails from './RentalDetails';
const rental = { id: 1, status: 'Active', user: null, car: { id: 7 }, startDate: null, totalPrice: 199 };
const option = { id: 1, km: 50, price: 25, currency: 'AED' };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('ends with uncached GET after checking the current rental', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(json(rental)).mockResolvedValueOnce(json({ ...rental, status: 'Completed' }));
  vi.stubGlobal('fetch', fetcher);
  await performRentalAction(1, { type: 'end' });
  expect(fetcher.mock.calls[1][0]).toContain('/rentals/1/end');
  expect(fetcher.mock.calls[1][1]).toMatchObject({ method: 'GET', credentials: 'include', cache: 'no-store' });
});
it.each(['Completed', 'Cancelled', 'PaymentPending'])('does not end a %s rental', async status => {
  const fetcher = vi.fn().mockResolvedValue(json({ ...rental, status })); vi.stubGlobal('fetch', fetcher);
  await expect(performRentalAction(1, { type: 'end' })).rejects.toThrow('no longer active');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each([0, -1, NaN, Infinity])('rejects invalid compensation %s without a request', async km => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  await expect(performRentalAction(1, { type: 'comp', km, reason: '' })).rejects.toThrow('positive');
  expect(fetcher).not.toHaveBeenCalled();
});
it('sends the compensation body, not a guessed field', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(json(rental)).mockResolvedValueOnce(json({ success: true })); vi.stubGlobal('fetch', fetcher);
  await performRentalAction(1, { type: 'comp', km: 12.5, reason: ' Delay ' });
  expect(fetcher.mock.calls[1][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ km: 12.5, reason: 'Delay' }) });
});
it('rechecks package options and submits their km and price', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(json(rental)).mockResolvedValueOnce(json([option])).mockResolvedValueOnce(json({ success: true })); vi.stubGlobal('fetch', fetcher);
  await performRentalAction(1, { type: 'package', package: option });
  expect(fetcher.mock.calls[2][0]).toContain('/add-km-package');
  expect(fetcher.mock.calls[2][1].body).toBe(JSON.stringify({ km: 50, price: 25 }));
});
it('rejects changed package prices without buying', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(json(rental)).mockResolvedValueOnce(json([{ ...option, price: 40 }])); vi.stubGlobal('fetch', fetcher);
  await expect(performRentalAction(1, { type: 'package', package: option })).rejects.toThrow('Package changed');
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('uses the actual GET status endpoint', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(json(rental)).mockResolvedValueOnce(json({ success: true })); vi.stubGlobal('fetch', fetcher);
  await performRentalAction(1, { type: 'status', status: 'Cancelled' });
  expect(fetcher.mock.calls[1][0]).toContain('/status?status=Cancelled');
  expect(fetcher.mock.calls[1][1].method).toBe('GET');
});
it('refuses switching to the current car', async () => {
  const fetcher = vi.fn().mockResolvedValue(json(rental)); vi.stubGlobal('fetch', fetcher);
  await expect(performRentalAction(1, { type: 'switch', carId: 7 })).rejects.toThrow('different car');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('shows a server conflict without retrying the mutation', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(json(rental)).mockResolvedValueOnce(json({ message: 'Rental is not active' }, 409)); vi.stubGlobal('fetch', fetcher);
  await expect(performRentalAction(1, { type: 'end' })).rejects.toThrow('Rental is not active');
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('rejects malformed package data', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([{ ...option, price: null }])));
  await expect(getPackages(1)).rejects.toThrow('Invalid');
});
it('requires confirmation, blocks double submission and refreshes the detail and list', async () => {
  let ended = false;
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).endsWith('/end')) { ended = true; return json({ ...rental, status: 'Completed' }); }
    return json({ ...rental, status: ended ? 'Completed' : 'Active' });
  });
  vi.stubGlobal('fetch', fetcher);
  const changed = vi.fn();
  render(<RentalDetails rentalId={1} canEdit onChanged={changed} />);
  fireEvent.click(await screen.findByRole('button', { name: 'End rental' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Review action' }).hasAttribute('disabled')).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Review action' }));
  expect(ended).toBe(false);
  expect(screen.getByText('End rental #1? This cannot be undone.')).toBeTruthy();
  const confirm = screen.getByRole('button', { name: 'Confirm action' });
  fireEvent.click(confirm); fireEvent.click(confirm);
  await screen.findByText('Completed', { selector: '.status-badge' });
  expect(changed).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls.filter(call => String(call[0]).endsWith('/end'))).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'End rental' })).toBeNull();
});
it('keeps actions hidden for a read-only admin', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(rental)));
  render(<RentalDetails rentalId={1} />);
  await screen.findByText('Active', { selector: '.status-badge' });
  expect(screen.queryByRole('button', { name: 'End rental' })).toBeNull();
});
