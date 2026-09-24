import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Fines from './Fines';
import { applyFine, loadRecords, validateAccident, type AccidentInput } from './finesApi';
const id = '11111111-1111-4111-8111-111111111111';
const fine = { id: 1, carId: 1, userId: id, amount: 125, status: 'Pending', plateNumber: 'ABC', fineDate: '2026-09-01T00:00:00Z', referenceNumber: 'FN-1' };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const page = (data: unknown[]) => ({ data, total: data.length, page: 1, pageSize: 200 });
vi.mock('../permissions/PermissionsContext', () => ({ usePermissions: () => ({ can: () => true }) }));
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('reads all pages before local search and rejects partial snapshots', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(json({ ...page([fine]), total: 2 })).mockResolvedValueOnce(json({ ...page([{ ...fine, id: 2 }]), total: 2 })); vi.stubGlobal('fetch', fetcher);
  expect(await loadRecords('Manual fines')).toHaveLength(2);
  expect(fetcher.mock.calls[1][0]).toContain('page=2');
  fetcher.mockResolvedValueOnce(json({ ...page([fine]), total: 2 })).mockResolvedValueOnce(json({ ...page([]), total: 2 }));
  await expect(loadRecords('Manual fines')).rejects.toThrow('incomplete');
});
it('uses the array review contract and normalizes car IDs', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json([fine])).mockResolvedValueOnce(json(page([{ carId: 3, totalAmount: 42 }]))));
  expect((await loadRecords('Review'))[0].id).toBe(1);
  expect((await loadRecords('Car fines'))[0].id).toBe(3);
});
it.each(['bill-customer', 'bill-company', 'dismiss'] as const)('posts %s after rechecking the fine', async action => {
  const fetcher = vi.fn().mockImplementation((url: string, options: RequestInit) => Promise.resolve(json(options.method === 'POST' ? { success: true } : url.includes('/users/') ? { id } : page([fine])))); vi.stubGlobal('fetch', fetcher);
  await applyFine(fine, action);
  const call = fetcher.mock.calls.find(call => call[1].method === 'POST');
  expect(call?.[0]).toContain(`/manual-fines/1/${action}`); expect(call?.[1].credentials).toBe('include');
});
it('blocks unlinked billing and terminal/stale fines before POST', async () => {
  const fetcher = vi.fn().mockImplementation(() => Promise.resolve(json(page([{ ...fine, userId: null }])))); vi.stubGlobal('fetch', fetcher);
  await expect(applyFine({ ...fine, userId: null }, 'bill-customer')).rejects.toThrow('linked customer');
  fetcher.mockImplementation(() => Promise.resolve(json(page([{ ...fine, status: 'Billed' }]))));
  await expect(applyFine(fine, 'bill-customer')).rejects.toThrow('no longer');
  expect(fetcher.mock.calls.every(call => call[1].method !== 'POST')).toBe(true);
});
it('validates accident amounts, dates and references', () => {
  const input: AccidentInput = { carId: null, rentalId: null, userId: null, status: 'Reported', faultParty: 'Unknown', estimatedCost: 0, location: 'Dubai', description: 'Damage', accidentDate: '2026-09-24T10:00:00Z' };
  expect(() => validateAccident(input)).not.toThrow();
  for (const patch of [{ estimatedCost: -1 }, { estimatedCost: 1.234 }, { carId: -1 }, { userId: 'bad' }, { accidentDate: 'bad' }, { status: 'Invalid' }]) expect(() => validateAccident({ ...input, ...patch })).toThrow();
});
it('requires confirmation and blocks double-submit before refreshing billing status', async () => {
  let billed = false;
  const fetcher = vi.fn().mockImplementation((url: string, options: RequestInit) => {
    if (options.method === 'POST') { billed = true; return Promise.resolve(json({ success: true })); }
    return Promise.resolve(json(url.includes('/users/') ? { id } : page([{ ...fine, status: billed ? 'Billed' : 'Pending' }])));
  }); vi.stubGlobal('fetch', fetcher);
  render(<Fines />); fireEvent.click(await screen.findByRole('button', { name: '#1' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Bill customer' })); expect(billed).toBe(false);
  const confirm = screen.getByRole('button', { name: 'Confirm action' }); fireEvent.click(confirm); fireEvent.click(confirm);
  await waitFor(() => expect(fetcher.mock.calls.filter(call => call[1].method === 'POST')).toHaveLength(1));
  await screen.findByText('Saved. Records have been refreshed.');
  expect(screen.queryByRole('button', { name: 'Bill customer' })).toBeNull();
});
it('shows request failure and retry with an empty list', async () => {
  const fetcher = vi.fn().mockImplementation(() => Promise.resolve(json({ message: 'Offline' }, 500))); vi.stubGlobal('fetch', fetcher);
  render(<Fines />); await screen.findByText('Offline');
  fetcher.mockImplementation(() => Promise.resolve(json(page([])))); fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('0 results');
});
