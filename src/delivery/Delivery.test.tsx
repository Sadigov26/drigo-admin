import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Delivery from './Delivery';
import * as api from './deliveryApi';
const pending = { id: 1, status: 'Pending', customerName: 'Test Customer', totalPrice: 100, driver: null };
vi.mock('../permissions/PermissionsContext', () => ({ usePermissions: () => ({ can: (code: string) => grants(code) }) }));
let grants = (_code: string) => true;
vi.mock('./deliveryApi', async importOriginal => ({ ...await importOriginal<typeof api>(), list: vi.fn(), detail: vi.fn(), reservationAction: vi.fn(), activeDeliveries: vi.fn() }));
beforeEach(() => {
  grants = () => true;
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  vi.mocked(api.list).mockResolvedValue([pending]);
  vi.mocked(api.detail).mockResolvedValue(pending);
  vi.mocked(api.reservationAction).mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('opens details from a row and confirms cancellation before posting', async () => {
  render(<Delivery mode="reservations" />);
  fireEvent.click(await screen.findByText('Test Customer'));
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel reservation' }));
  expect(api.reservationAction).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Reason (optional)'), { target: { value: 'Requested by customer' } });
  vi.mocked(api.detail).mockResolvedValue({ ...pending, status: 'Cancelled' });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm action' }));
  fireEvent.click(screen.getByRole('button', { name: 'Saving…' }));
  await waitFor(() => expect(api.reservationAction).toHaveBeenCalledTimes(1));
  expect(api.reservationAction).toHaveBeenCalledWith(pending, 'cancel', 'Requested by customer');
  await screen.findByText('Saved. The latest records have been loaded.');
  expect(screen.queryByRole('button', { name: 'Cancel reservation' })).toBeNull();
});
it('hides mutations from read-only accounts', async () => {
  grants = code => code.endsWith('.view');
  render(<Delivery mode="reservations" />);
  fireEvent.click(await screen.findByRole('button', { name: '#1' }));
  await screen.findByRole('button', { name: 'Refresh details' });
  expect(screen.queryByRole('button', { name: 'Assign driver' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Cancel reservation' })).toBeNull();
});
it('shows a retry after a failed list and then the empty state', async () => {
  vi.mocked(api.list).mockRejectedValueOnce(new Error('Connection failed')).mockResolvedValueOnce([]);
  render(<Delivery mode="delivery" />);
  await screen.findByText('Connection failed');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('No results found.');
});
