import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiRequest, SESSION_EXPIRED_EVENT } from '../api/client';
import { actOnDebt, getDebtLists, splitAmounts, downloadDebtors, excelCompatibleCsv } from './debtsApi';
import CustomerDebts, { visibleRows } from './CustomerDebts';
import Debts from './Debts';

const id = '11111111-1111-4111-8111-111111111111';
const user = { id, fullName: 'Test Debtor', email: null, phoneNumber: null, createdAt: '2026-09-01T00:00:00Z', isApproved: true, isVerified: true, isBlocked: false, isDeleted: false };
const debt = { id: 1, userId: id, userName: 'Test Debtor', amount: 12, currency: 'AED', isPaid: false, type: 'Manual', description: 'Test debt', createdAt: '2026-09-01T00:00:00Z' };
const payload = { userId: id, totalDebt: 12, currency: 'AED', debts: [debt] };
const expected = { rows: [debt], total: 1, summary: { totalDebt: 12, currency: 'AED' } };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const props = { id, canEdit: true, canCreate: true, canDelete: true, onBusy: vi.fn(), onChanged: vi.fn() };
vi.mock('../permissions/PermissionsContext', () => ({ usePermissions: () => ({ can: () => true }) }));
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('loads full debtor/debt snapshots and counts only unpaid records', async () => {
  const fetcher = vi.fn().mockImplementation((url: string) => Promise.resolve(json({ data: url.includes('with-debt') ? [{ ...user, totalDebt: 12 }] : [debt, { ...debt, id: 2, isPaid: true }], total: url.includes('with-debt') ? 1 : 2, page: 1, pageSize: 200 })));
  vi.stubGlobal('fetch', fetcher);
  const result = await getDebtLists();
  expect(result.debtors[0].unpaidCount).toBe(1);
  expect(fetcher.mock.calls.every(call => call[1].credentials === 'include')).toBe(true);
  expect(visibleRows(result.debts, { page: 1, search: 'test', sortBy: 'id', sortOrder: 'desc' }, ['userName']).map(row => row.id)).toEqual([2, 1]);
});
it('rejects incomplete snapshots rather than presenting a partial search', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(json({ data: [], total: 2, page: 1, pageSize: 200 }))));
  await expect(getDebtLists()).rejects.toThrow('Incomplete');
});
it.each([
  [{ type: 'pay', id: 1 }, '/1/pay', undefined, 'POST'],
  [{ type: 'selected', ids: [1] }, '/pay-selected', { debtIds: [1] }, 'POST'],
  [{ type: 'split', id: 1, parts: 3 }, '/1/split', { parts: 3 }, 'POST'],
  [{ type: 'delete', id: 1 }, '/1', undefined, 'DELETE'],
] as const)('uses the actual action contract %j', async (action, suffix, body, method) => {
  const fetcher = vi.fn().mockResolvedValueOnce(json(payload)).mockResolvedValueOnce(json({ success: true })); vi.stubGlobal('fetch', fetcher);
  await actOnDebt(id, action.type === 'selected' ? { type: 'selected', ids: [...action.ids] } : action, expected);
  expect(fetcher.mock.calls[1][0]).toContain(`/users/${id}/debt${suffix}`);
  expect(fetcher.mock.calls[1][1].method).toBe(method);
  expect(fetcher.mock.calls[1][1].body).toBe(body ? JSON.stringify(body) : undefined);
});
it('blocks stale selections, already paid debts and rounding-loss splits', async () => {
  const fetcher = vi.fn().mockResolvedValue(json({ ...payload, debts: [{ ...debt, isPaid: true }] })); vi.stubGlobal('fetch', fetcher);
  await expect(actOnDebt(id, { type: 'pay', id: 1 }, expected)).rejects.toThrow('changed');
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(() => splitAmounts(10, 3)).toThrow('changing the total');
  expect(() => splitAmounts(10, 2.5)).toThrow();
  expect(splitAmounts(12, 3)).toBe(4);
});
it('validates add debt and propagates a 409 conflict', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  await expect(actOnDebt(id, { type: 'add', amount: -1, debtType: 'Manual', description: 'note' }, expected)).rejects.toThrow('amount');
  expect(fetcher).not.toHaveBeenCalled();
  fetcher.mockResolvedValueOnce(json(payload)).mockResolvedValueOnce(json({ message: 'Conflict from server' }, 409));
  await expect(actOnDebt(id, { type: 'delete', id: 1 }, expected)).rejects.toThrow('Conflict from server');
});
it('supports blob responses without bypassing cookies or session-expiry errors', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response('Name,Debt\nTest,12', { headers: { 'Content-Type': 'text/csv' } })).mockResolvedValueOnce(json({ message: 'Session expired' }, 401)); vi.stubGlobal('fetch', fetcher);
  const listener = vi.fn(); window.addEventListener(SESSION_EXPIRED_EVENT, listener);
  const blob = await apiRequest('/api/admin/users/with-debt/report', {}, 'blob');
  expect(await blob.text()).toContain('Test,12');
  expect(fetcher.mock.calls[0][1].credentials).toBe('include');
  await expect(apiRequest('/api/admin/users/with-debt/report', {}, 'blob')).rejects.toThrow('Session expired');
  expect(listener).toHaveBeenCalledOnce(); window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
});
it('adds the Excel separator and UTF-8 marker without changing report values', () => {
  const csv = 'Name,Phone,Email,Debt(AED)\n"Əli","+994123","",447.5';
  const result = excelCompatibleCsv(csv);
  expect(result).toBe('\uFEFFsep=,\r\n' + csv.replace(/\n/g, '\r\n'));
  expect(excelCompatibleCsv(result)).toBe(result);
});
it('rejects a non-CSV report', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Error</html>', { headers: { 'Content-Type': 'text/html' } })));
  await expect(downloadDebtors()).rejects.toThrow('CSV');
});
it('shows empty lists and retries failed loads', async () => {
  const fetcher = vi.fn().mockImplementation(() => Promise.resolve(json({ message: 'Offline' }, 500))); vi.stubGlobal('fetch', fetcher);
  render(<Debts />);
  await screen.findByText('Offline');
  fetcher.mockImplementation(() => Promise.resolve(json({ data: [], total: 0, page: 1, pageSize: 200 })));
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('0 results');
});
it('requires confirmation, prevents duplicate payment and refreshes the result', async () => {
  let paid = false;
  const fetcher = vi.fn().mockImplementation((url: string, options: RequestInit) => {
    if (options.method === 'POST') { paid = true; return Promise.resolve(json({ success: true, paidCount: 1 })); }
    return Promise.resolve(json(url.endsWith('/debt') ? { ...payload, totalDebt: paid ? 0 : 12, debts: [{ ...debt, isPaid: paid }] } : user));
  }); vi.stubGlobal('fetch', fetcher);
  render(<CustomerDebts {...props} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Pay all (1)' }));
  expect(paid).toBe(false);
  const confirm = screen.getByRole('button', { name: 'Confirm action' }); fireEvent.click(confirm); fireEvent.click(confirm);
  await screen.findByText('Paid');
  expect(fetcher.mock.calls.filter(call => call[1].method === 'POST')).toHaveLength(1);
  await waitFor(() => expect(props.onChanged).toHaveBeenCalled());
});
it('hides mutation controls for read-only permissions', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => Promise.resolve(json(url.endsWith('/debt') ? payload : user))));
  render(<CustomerDebts {...props} canEdit={false} canCreate={false} canDelete={false} />);
  await screen.findByText('Unpaid');
  expect(screen.queryByRole('button', { name: 'Add debt' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  expect(screen.queryByRole('checkbox')).toBeNull();
});
