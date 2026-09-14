import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';

function setup(codes: string[], path = '/', superAdmin = false, failPermissions = false) {
  const admin = { id: 'user-1', username: 'operator', fullName: 'Operator', email: null, isSuperAdmin: superAdmin };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/auth/me')) return json(admin);
    if (url.endsWith('/api/health')) return json({ status: 'ok' });
    if (url.endsWith('/permissions/my-permissions')) {
      if (failPermissions) return json({ message: 'Permissions unavailable' }, 503);
      return json({ adminId: admin.id, isSuperAdmin: superAdmin, permissionCodes: codes });
    }
    throw new Error('Unexpected URL: ' + url);
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
  return { fetchMock, recover: () => { failPermissions = false; } };
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('permission navigation', () => {
  it('shows the operator menu from exact backend codes', async () => {
    setup(['dashboard.view', 'support.view', 'support.edit', 'customers.view', 'rentals.view']);
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    expect(await within(nav).findByRole('link', { name: 'Support' })).toBeTruthy();
    expect(within(nav).getByRole('link', { name: 'Customers' })).toBeTruthy();
    expect(within(nav).queryByRole('link', { name: 'Cars' })).toBeNull();
    expect(within(nav).queryByRole('link', { name: 'Settings' })).toBeNull();
  });

  it('shows the fleet menu without customer or support access', async () => {
    setup(['dashboard.view', 'cars.view', 'cars.edit', 'rentals.view', 'fleet.view', 'analytics.view']);
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    expect(await within(nav).findByRole('link', { name: 'Cars' })).toBeTruthy();
    expect(within(nav).getByRole('link', { name: 'Fleet' })).toBeTruthy();
    expect(within(nav).queryByRole('link', { name: 'Customers' })).toBeNull();
  });

  it('allows super admin to see all configured modules', async () => {
    setup([], '/', true);
    expect(await screen.findByRole('link', { name: 'Settings' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Delivery' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Cars' })).toBeTruthy();
  });

  it('blocks direct URL access even if the menu link is hidden', async () => {
    setup(['support.view'], '/cars');
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeTruthy();
    expect(screen.queryByText('This module has not been implemented yet.')).toBeNull();
  });

  it('does not grant view access from an edit permission', async () => {
    setup(['cars.edit'], '/cars');
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeTruthy();
  });

  it('fails closed when permissions fail, then retries', async () => {
    const { recover } = setup(['cars.view'], '/cars', false, true);
    expect(await screen.findByText('Permissions unavailable')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Cars' })).toBeNull();
    recover();
    await userEvent.click(within(screen.getByRole('main')).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('This module has not been implemented yet.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Cars' })).toBeTruthy();
  });

  it('discards permissions belonging to a different account', async () => {
    const { fetchMock } = setup(['cars.view']);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/permissions/my-permissions')) {
        return new Response(JSON.stringify({ adminId: 'another-user', isSuperAdmin: true, permissionCodes: ['cars.view'] }));
      }
      return new Response(JSON.stringify({ status: 'ok' }));
    });
    expect(await screen.findByText('Permissions do not match the signed-in account.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Cars' })).toBeNull();
  });
});
