import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Promotions from './Promotions';
import * as api from './promotionsApi';
import { ApiError } from '../api/client';
vi.mock('./promotionsApi', async original => ({ ...await original<typeof api>(), listRecords: vi.fn(), getRecord: vi.fn(), saveRecord: vi.fn(), removeRecord: vi.fn(), changeStatus: vi.fn(), getReferral: vi.fn(), saveReferral: vi.fn() }));
let allowed = true;
vi.mock('../permissions/PermissionsContext', () => ({ usePermissions: () => ({ can: () => allowed }) }));
const row = { id: 1, title: 'Weekend', isActive: true, startDate: '2026-01-01T00:00:00Z', endDate: null, imageUrl: 'https://example.com/a.png', actionType: 'None', frequency: 'Once' };
afterEach(cleanup);
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  vi.resetAllMocks(); allowed = true;
  vi.mocked(api.listRecords).mockResolvedValue([row]);
  vi.mocked(api.getRecord).mockResolvedValue(row);
});
it('filters locally, opens full details and retains null fields', async () => {
  render(<Promotions />); fireEvent.click(await screen.findByText('Weekend'));
  await screen.findByText('Promotion image');
  expect(screen.getByText('End Date')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Close/ }));
  fireEvent.change(screen.getByLabelText('Search promotions'), { target: { value: 'missing' } });
  expect(screen.queryByText('Weekend')).toBeNull();
});
it('requires confirmation and displays delete conflicts', async () => {
  vi.mocked(api.removeRecord).mockRejectedValue(new ApiError('Linked record', 409));
  render(<Promotions />); await screen.findByText('Weekend');
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
  expect((await screen.findByRole('alert')).textContent).toContain('in use');
});
it('refreshes the list after status changes and blocks double submit', async () => {
  let finish!: () => void;
  vi.mocked(api.changeStatus).mockReturnValue(new Promise(resolve => { finish = () => resolve({}); }));
  render(<Promotions />); await screen.findByText('Weekend');
  fireEvent.click(screen.getByRole('button', { name: 'Disable' }));
  const confirm = await screen.findByRole('button', { name: 'Confirm' });
  fireEvent.click(confirm); fireEvent.click(confirm);
  expect(api.changeStatus).toHaveBeenCalledTimes(1);
  finish();
  await waitFor(() => expect(api.listRecords).toHaveBeenCalledTimes(2));
});
it('saves a valid promotion and refreshes', async () => {
  render(<Promotions />); await screen.findByText('Weekend');
  fireEvent.click(screen.getByRole('button', { name: 'Add promotion' }));
  fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'New campaign' } });
  fireEvent.change(screen.getByLabelText('Image URL'), { target: { value: 'https://example.com/b.png' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.saveRecord).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(api.listRecords).toHaveBeenCalledTimes(2));
});
it('handles referral updates and preserves read-only access', async () => {
  vi.mocked(api.getReferral).mockResolvedValue({ referrerBonus: 50, refereeBonus: 30, minRentalsToQualify: 1, currency: 'AED', isActive: true });
  render(<Promotions />); await screen.findByText('Weekend');
  fireEvent.click(screen.getByRole('button', { name: 'Referral settings' }));
  await screen.findByText('Referrer Bonus');
  fireEvent.click(screen.getByRole('button', { name: 'Edit settings' }));
  fireEvent.change(await screen.findByLabelText('Referrer bonus'), { target: { value: '60' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.saveReferral).toHaveBeenCalledTimes(1));
  await screen.findByText('Referral settings saved.');
  cleanup(); allowed = false; render(<Promotions />); await screen.findByText('Weekend');
  expect(screen.queryByRole('button', { name: 'Add promotion' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
});
it('renders list errors with retry and empty responses', async () => {
  vi.mocked(api.listRecords).mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce([]);
  render(<Promotions />); await screen.findByText('Unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('0 results');
});
