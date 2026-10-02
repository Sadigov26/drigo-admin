import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Operations from './Operations';
import Settings from './Settings';
import { Fields, label } from '../fleet/FleetShared';
import * as api from './operationsApi';
vi.mock('../permissions/PermissionsContext', () => ({ usePermissions: () => ({ can: () => true }) }));
vi.mock('./operationsApi', async original => ({ ...await original<typeof api>(), read: vi.fn(), snapshot: vi.fn(), execute: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  vi.mocked(api.snapshot).mockResolvedValue([]);
});
afterEach(cleanup);

it('labels units and flags the way an admin reads them', () => {
  expect(label('sizeMb')).toBe('Size (MB)');
  expect(label('isActive')).toBe('Active');
});
it('shows lists of plain values as chips, never as numbered "Item" cards', () => {
  render(<Fields row={{ countries: ['AE', 'AZ'] }} />);
  expect(screen.getByText('AE')).toBeTruthy();
  expect(screen.queryByText(/^Item \d/)).toBeNull();
});
it('shows the SMS mode with country names instead of one card per code', async () => {
  vi.mocked(api.read).mockResolvedValue({ mode: 'Whitelist', countries: ['AE', 'AZ', 'TR', 'SA'], updatedAt: '2026-08-31T17:22:43.000Z' });
  render(<MemoryRouter initialEntries={['/settings?view=SMS+mode']}><Settings /></MemoryRouter>);
  expect(await screen.findByText('Whitelist')).toBeTruthy();
  expect(screen.getByText('Allowed countries configuration.')).toBeTruthy();
  expect(screen.getByText('United Arab Emirates')).toBeTruthy();
  expect(screen.getByText('Azerbaijan')).toBeTruthy();
  expect(screen.queryByText(/^Item \d/)).toBeNull();
});
it('keeps long monitoring lists collapsed and readable as one table', async () => {
  vi.mocked(api.read).mockImplementation(async path => path === 'monitoring/database'
    ? { status: 'healthy', sizeMb: 428, connections: 12, tables: [{ name: 'countries', rows: 4 }, { name: 'cities', rows: 4 }] } : { status: 'healthy' });
  render(<MemoryRouter initialEntries={['/operations?view=Monitoring']}><Operations /></MemoryRouter>);
  expect(await screen.findByText('Size (MB)')).toBeTruthy();
  expect(screen.getByText('Tables · 2 records')).toBeTruthy();
  expect(screen.getAllByRole('columnheader', { name: 'Name' }).length).toBeGreaterThan(0);
  expect(screen.getByText('countries')).toBeTruthy();
});
it('lists problem reports and offers every supported status even when absent from the list', async () => {
  vi.mocked(api.snapshot).mockResolvedValue([{ id: 1, category: 'Flat tyre', status: 'Open', createdAt: '2026-09-01T10:00:00Z' }, { id: 2, category: 'Noise', status: 'Resolved', createdAt: '2026-09-02T10:00:00Z' }]);
  render(<MemoryRouter initialEntries={['/operations?view=Problem+reports']}><Operations /></MemoryRouter>);
  expect(await screen.findByText('Flat tyre')).toBeTruthy();
  fireEvent.click(screen.getAllByRole('button', { name: 'Change status' })[0]);
  const select = within(await screen.findByRole('dialog')).getByLabelText(/Status/);
  expect([...(select as HTMLSelectElement).options].map(option => option.value).filter(Boolean).sort()).toEqual(['Dismissed', 'InProgress', 'Open', 'Resolved']);
  await waitFor(() => expect(api.execute).not.toHaveBeenCalled());
});
