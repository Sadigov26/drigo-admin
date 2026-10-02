import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '../api/client';
import Operations from './Operations';
import Settings from './Settings';
import { ActionDialog } from './ActionDialog';
import { PermissionEditor } from './Admins';
import * as api from './operationsApi';
const grants = vi.hoisted(() => ({ edit: true }));
vi.mock('../permissions/PermissionsContext', () => ({ usePermissions: () => ({ can: () => grants.edit }) }));
vi.mock('./operationsApi', async original => ({ ...await original<typeof api>(), read: vi.fn(), snapshot: vi.fn(), execute: vi.fn(), permissionDetail: vi.fn(), savePermissions: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks(); grants.edit = true;
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  vi.mocked(api.read).mockResolvedValue({ amount: 4.99, currency: 'AED', isActive: true });
  vi.mocked(api.snapshot).mockResolvedValue([]);
  vi.mocked(api.execute).mockResolvedValue({ success: true });
});
afterEach(cleanup);
it('requires review then confirmation and prevents duplicate mutations', async () => {
  const saved = vi.fn();
  render(<ActionDialog action={{ title: 'Edit fee', path: 'trip-fee', method: 'PUT', fields: api.feeFields('trip-fee'), initial: { amount: 4.99, isActive: true } }} onClose={() => {}} onSaved={saved} />);
  fireEvent.click(screen.getByRole('button', { name: 'Review change' }));
  expect(api.execute).not.toHaveBeenCalled();
  const confirm = screen.getByRole('button', { name: 'Confirm change' }); fireEvent.click(confirm); fireEvent.click(confirm);
  await waitFor(() => expect(saved).toHaveBeenCalledOnce()); expect(api.execute).toHaveBeenCalledOnce();
});
it('shows 409 conflicts without discarding the form', async () => {
  vi.mocked(api.execute).mockRejectedValue(new ApiError('Setting is locked', 409));
  render(<ActionDialog action={{ title: 'Edit fee', path: 'trip-fee', method: 'PUT', fields: [], initial: {} }} onClose={() => {}} onSaved={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Review change' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm change' }));
  await screen.findByText('Setting is locked'); expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
});
it('blocks retries after an uncertain result', async () => {
  vi.mocked(api.execute).mockRejectedValue(new Error('Disconnected'));
  render(<ActionDialog action={{ title: 'Trigger', path: 'scraper/trigger/ENOC', method: 'GET', fields: [], initial: {} }} onClose={() => {}} onSaved={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Review change' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm change' }));
  await screen.findByText(/Result may be uncertain/);
  expect((screen.getByRole('button', { name: 'Confirm change' }) as HTMLButtonElement).disabled).toBe(true);
});
it('shows only cancellable cleanings and reloads list/statistics', async () => {
  vi.mocked(api.snapshot).mockResolvedValue([{ id: 1, plateNumber: 'A1', status: 'Scheduled' }, { id: 2, plateNumber: 'A2', status: 'Completed' }]);
  render(<MemoryRouter><Operations /></MemoryRouter>);
  const cancel = await screen.findAllByRole('button', { name: 'Cancel cleaning' }); expect(cancel).toHaveLength(1);
  fireEvent.click(cancel[0]); fireEvent.click(screen.getByRole('button', { name: 'Review change' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm change' }));
  await waitFor(() => expect(api.snapshot).toHaveBeenCalledTimes(2)); expect(api.read).toHaveBeenCalledTimes(2);
});
it('shows loading/error/empty and hides edit without a grant', async () => {
  grants.edit = false;
  vi.mocked(api.read).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({});
  render(<MemoryRouter><Settings /></MemoryRouter>);
  await screen.findByText('Offline'); fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('No results found.'); expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
});
it('previews permission grants and revocations before saving', async () => {
  vi.mocked(api.permissionDetail).mockResolvedValue({ adminId: 'operator', permissionCodes: ['cars.view'], isSuperAdmin: false });
  vi.mocked(api.snapshot).mockResolvedValue([{ id: 1, code: 'cars.view' }, { id: 2, code: 'support.view' }]);
  const saved = vi.fn();
  render(<PermissionEditor admin={{ id: 'operator', username: 'operator' }} onClose={() => {}} onSaved={saved} />);
  fireEvent.click(await screen.findByLabelText('cars.view')); fireEvent.click(screen.getByLabelText('support.view'));
  fireEvent.click(screen.getByRole('button', { name: 'Review permissions' }));
  expect(screen.getByText('Grant (1)')).toBeTruthy(); expect(screen.getByText('Revoke (1)')).toBeTruthy(); expect(api.savePermissions).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm permissions' }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce()); expect(api.savePermissions).toHaveBeenCalledWith('operator', ['support.view']);
});
