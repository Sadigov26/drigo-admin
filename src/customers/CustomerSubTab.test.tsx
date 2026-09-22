import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CustomerSubTab from './CustomerSubTab';
import { customerTabs, getCustomerTab, payAllDebts } from './customerTabsApi';

it('opens payment fields in a separate record sheet without expanding the table row', async () => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ data: [{ id: 1, amount: 25, currency: 'AED', status: 'Failed', serviceFee: 9.99, isFinalPayment: true, failureReason: 'Declined' }], total: 1, page: 1, pageSize: 10 })));
  render(<CustomerSubTab {...props} tab="Payments" />);
  fireEvent.click(await screen.findByRole('button', { name: 'View payments record 1' }));
  expect(screen.getByRole('dialog', { name: 'Payment #1' })).toBeTruthy();
  expect(screen.getByText('9.99 AED')).toBeTruthy();
  expect(screen.getByText('Yes')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});

const id = '11111111-1111-4111-8111-111111111111';
const debt = { userId: id, currency: 'AED', totalDebt: 25, debts: [{ id: 1, amount: 25, currency: 'AED', isPaid: false, description: 'Service fee' }] };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const props = { id, canPay: true, onBusy: vi.fn(), onChanged: vi.fn() };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it.each(customerTabs)('loads %s through the cookie-based wrapper', async tab => {
  const payload = tab === 'Debt' ? debt : tab === 'Devices' ? [] : tab === 'Bonus' ? { userId: id, balance: 10, currency: 'AED', history: [] } : tab === 'Revenue' ? { userId: id, currency: 'AED', totalRevenue: 0, totalRentals: 0, averageRentalValue: 0 } : { data: [], total: 0, page: 1, pageSize: 10 };
  const fetcher = vi.fn().mockResolvedValue(json(payload)); vi.stubGlobal('fetch', fetcher);
  await getCustomerTab(id, tab);
  expect(fetcher.mock.calls[0][1].credentials).toBe('include');
  expect(String(fetcher.mock.calls[0][0])).toContain(`/users/${id}/`);
});
it('rejects mismatched accounts and changed debt before mutation', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(json({ ...debt, userId: 'wrong' })).mockResolvedValueOnce(json(debt));
  vi.stubGlobal('fetch', fetcher);
  await expect(getCustomerTab(id, 'Debt')).rejects.toThrow('match');
  await expect(payAllDebts(id, { rows: [], total: 0, summary: {} })).rejects.toThrow('changed');
  expect(fetcher.mock.calls.every(call => call[1].method !== 'POST')).toBe(true);
});
it('shows payment failure reasons and fetches the next server page', async () => {
  const fetcher = vi.fn().mockImplementation((url: string) => Promise.resolve(json({ data: [{ id: 1, amount: 12, status: 'Failed', failureReason: 'Card declined' }], total: 11, page: url.includes('page=2') ? 2 : 1, pageSize: 10 })));
  vi.stubGlobal('fetch', fetcher);
  render(<CustomerSubTab {...props} tab="Payments" />);
  expect(await screen.findByText('Card declined')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('Page 2 of 2');
  expect(fetcher.mock.calls[1][0]).toContain('page=2&pageSize=10');
});
it('confirms once, then refetches paid debt instead of changing it optimistically', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(json(debt)).mockResolvedValueOnce(json(debt)).mockResolvedValueOnce(json({ success: true, paidCount: 1 })).mockResolvedValueOnce(json({ ...debt, totalDebt: 0, debts: [{ ...debt.debts[0], isPaid: true }] }));
  vi.stubGlobal('fetch', fetcher);
  render(<CustomerSubTab {...props} tab="Debt" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Pay all debts' }));
  expect(fetcher).toHaveBeenCalledTimes(1);
  const confirm = screen.getByRole('button', { name: 'Confirm payment' });
  fireEvent.click(confirm); fireEvent.click(confirm);
  await screen.findByText('Paid');
  expect(fetcher.mock.calls.filter(call => call[1].method === 'POST')).toHaveLength(1);
  expect(props.onChanged).toHaveBeenCalledOnce();
  expect(screen.queryByRole('button', { name: 'Pay all debts' })).toBeNull();
});
it('omits payment action without debt permission', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(debt)));
  render(<CustomerSubTab {...props} canPay={false} tab="Debt" />);
  await screen.findByText('Unpaid');
  expect(screen.queryByRole('button', { name: 'Pay all debts' })).toBeNull();
});
it('recovers from a failed tab request and displays an honest empty state', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({ message: 'Temporary failure' }, 500)).mockResolvedValueOnce(json([])));
  render(<CustomerSubTab {...props} tab="Devices" />);
  await screen.findByText('Temporary failure');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.getByText('No devices found.')).toBeTruthy());
});
