import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { apiRequest } from '../api/client';
import Dashboard from '../dashboard/Dashboard';
import Cars from '../cars/CarsModule';
import Catalog from '../catalog/Catalog';
import Rentals from '../rentals/Rentals';
import Customers from '../customers/Customers';
import Debts from '../debts/Debts';
import Fines from '../fines/Fines';
import Delivery from '../delivery/Delivery';
import Support from '../support/Support';
import Tariffs from '../tariffs/Tariffs';
import Promotions from '../promotions/Promotions';
import Analytics from '../analytics/Analytics';
import Fleet from '../fleet/Fleet';
import Notifications from '../fleet/Notifications';
import Operations from './Operations';
import Settings from './Settings';
import Admins from './Admins';
import { Overview } from '../pages/Overview';

vi.mock('../api/client', async original => ({ ...await original<typeof import('../api/client')>(), apiRequest: vi.fn() }));
vi.mock('../permissions/PermissionsContext', () => ({ usePermissions: () => ({ can: () => true, retry: vi.fn(), state: { status: 'ready', data: { adminId: 'test', isSuperAdmin: true, permissionCodes: [] } } }) }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ session: { status: 'authenticated', admin: { id: 'test', username: 'admin', isSuperAdmin: true } } }) }));
beforeEach(() => { vi.clearAllMocks(); vi.mocked(apiRequest).mockRejectedValue(new Error('Backend offline (polish test)')); });
afterEach(cleanup);
const pages = [
  ['Overview', <Overview />], ['Dashboard', <Dashboard />], ['Cars', <Cars />], ['Brands', <Catalog />],
  ['Rentals', <Rentals />], ['Customers', <Customers />], ['Debts', <Debts />], ['Fines', <Fines />],
  ['Reservations', <Delivery mode="reservations" />], ['Delivery', <Delivery mode="delivery" />], ['Support', <Support />],
  ['Tariffs', <Tariffs />], ['Promotions', <Promotions />], ['Analytics', <Analytics />], ['Fleet', <Fleet />],
  ['Notifications', <Notifications />], ['Operations', <Operations />], ['Settings', <Settings />], ['Admins', <Admins />],
] as const;
it.each(pages)('%s shows an actionable error when the backend is offline', async (_name, component) => {
  render(<MemoryRouter>{component}</MemoryRouter>);
  expect((await screen.findAllByText('Backend offline (polish test)')).length).toBeGreaterThan(0);
  const retry = screen.queryAllByRole('button', { name: /Try again|Retry|Check connection/i })[0];
  expect(retry).toBeTruthy();
  const before = vi.mocked(apiRequest).mock.calls.length;
  fireEvent.click(retry);
  await waitFor(() => expect(vi.mocked(apiRequest).mock.calls.length).toBeGreaterThan(before));
});
