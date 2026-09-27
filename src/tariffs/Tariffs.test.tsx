import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Tariffs from './Tariffs';
import * as api from './tariffsApi';
import { ApiError } from '../api/client';
vi.mock('./tariffsApi', async original => ({ ...await original<typeof api>(), listTariffs: vi.fn(), saveTariff: vi.fn(), deleteTariff: vi.fn() }));
let allowed = true;
vi.mock('../permissions/PermissionsContext', () => ({ usePermissions: () => ({ can: () => allowed }) }));
afterEach(cleanup);
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  vi.resetAllMocks(); allowed = true; vi.mocked(api.listTariffs).mockResolvedValue([{ id: 1, unitCount: 1, timeUnit: 'Day', price: 199, currency: 'AED', isActive: true }]);
});
it('opens details by row, formats prices and filters locally', async () => {
  render(<Tariffs />); await screen.findByText('#1');
  fireEvent.click(screen.getByText(/199\.00/).closest('tr')!);
  expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Close/ }));
  fireEvent.change(screen.getByLabelText(/Search packages/i), { target: { value: 'missing' } });
  expect(screen.queryByText('#1')).toBeNull();
});
it('refreshes after a valid create', async () => {
  render(<Tariffs />); await screen.findByText('#1');
  fireEvent.click(screen.getByRole('button', { name: 'Add package' }));
  fireEvent.change(screen.getByLabelText('Price'), { target: { value: '99' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.saveTariff).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(api.listTariffs).toHaveBeenCalledTimes(2));
});
it('requires delete confirmation and shows conflict', async () => {
  vi.mocked(api.deleteTariff).mockRejectedValue(new ApiError('Linked record', 409));
  render(<Tariffs />); await screen.findByText('#1');
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(api.deleteTariff).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('alert').textContent).toContain('in use');
});
it('hides unsupported distance controls and respects read-only permissions', async () => {
  allowed = false; render(<Tariffs />); await screen.findByText('#1');
  expect(screen.queryByRole('button', { name: 'Add package' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Distance allowances' }));
  await screen.findByText('Read-only');
  expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
});
