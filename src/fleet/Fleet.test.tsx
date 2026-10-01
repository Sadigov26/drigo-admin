import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '../api/client';
import { Broadcast } from './Notifications';
import { ResourceList } from './ResourceList';
import { Records, valueView } from './FleetShared';
import * as api from './fleetApi';
const grants = vi.hoisted(() => ({ edit: true }));
vi.mock('../permissions/PermissionsContext', () => ({ usePermissions: () => ({ can: () => grants.edit }) }));
vi.mock('./fleetApi', async original => ({ ...await original<typeof api>(), preview: vi.fn(), write: vi.fn(), snapshot: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks(); grants.edit = true;
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  vi.mocked(api.preview).mockResolvedValue(5);
  vi.mocked(api.write).mockResolvedValue({ success: true, recipientCount: 5 });
  vi.mocked(api.snapshot).mockResolvedValue([]);
});
afterEach(cleanup);
function fillBroadcast() {
  render(<MemoryRouter><Broadcast /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Hello' } });
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Message body' } });
  fireEvent.click(screen.getByRole('button', { name: 'Preview recipients' }));
}
it('requires preview and confirmation and blocks double send', async () => {
  fillBroadcast();
  fireEvent.click(await screen.findByRole('button', { name: 'Review & send' }));
  expect(api.write).not.toHaveBeenCalled();
  const send = screen.getByRole('button', { name: 'Confirm send' }); fireEvent.click(send); fireEvent.click(send);
  await screen.findByText('Broadcast recorded');
  expect(api.write).toHaveBeenCalledTimes(1);
  expect(api.write).toHaveBeenCalledWith('notifications/broadcast', 'POST', { title: 'Hello', body: 'Message body', targetAudience: 'All' });
});
it('invalidates preview whenever the draft changes', async () => {
  fillBroadcast(); await screen.findByRole('button', { name: 'Review & send' });
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Different' } });
  expect(screen.queryByRole('button', { name: 'Review & send' })).toBeNull();
});
it('requires renewed confirmation when audience changes', async () => {
  vi.mocked(api.preview).mockResolvedValueOnce(5).mockResolvedValueOnce(6);
  fillBroadcast(); fireEvent.click(await screen.findByRole('button', { name: 'Review & send' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm send' }));
  await screen.findByText(/The audience changed/); expect(api.write).not.toHaveBeenCalled();
});
it('keeps draft and prevents unsafe retry on uncertain send', async () => {
  vi.mocked(api.write).mockRejectedValue(new Error('Connection interrupted'));
  fillBroadcast(); fireEvent.click(await screen.findByRole('button', { name: 'Review & send' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm send' }));
  await screen.findByText(/Send result is uncertain/);
  expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('Message body');
  expect((screen.getByRole('button', { name: 'Preview recipients' }).closest('fieldset') as HTMLFieldSetElement).disabled).toBe(true);
});
it('renders all fields, search and pagination without dropping nulls', async () => {
  const data = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, title: `Item ${i + 1}`, hiddenField: null }));
  render(<Records title="History" data={data} keys={['title']} loading={false} error={null} refresh={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByRole('button', { name: 'Item 11' }));
  expect(screen.getByText('Hidden Field')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
  fireEvent.change(screen.getByLabelText('Search history'), { target: { value: 'Item 12' } });
  expect(screen.getByText('1 results')).toBeTruthy();
  expect(valueView(19.960000000004, 'fuelLevel')).toBe('20%');
  expect(valueView(25.123456, 'latitude')).toBe('25.123456');
});
it('shows conflict on delete and refreshes after success', async () => {
  vi.mocked(api.snapshot).mockResolvedValue([{ id: 1, name: 'Zone' }]);
  vi.mocked(api.write).mockRejectedValueOnce(new ApiError('Zone is in use', 409)).mockResolvedValueOnce({ success: true });
  render(<ResourceList title="Zones" path="geozones" keys={['name']} editable />);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
  await screen.findByText('Zone is in use');
  fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
  await waitFor(() => expect(api.snapshot).toHaveBeenCalledTimes(2));
});
it('shows retry and empty states and hides mutations without grants', async () => {
  grants.edit = false;
  vi.mocked(api.snapshot).mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce([]);
  render(<ResourceList title="Zones" path="geozones" keys={['name']} editable />);
  await screen.findByText('Unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(api.snapshot).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole('button', { name: 'Add zone' })).toBeNull();
});
