import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FleetPanel, OnlineUsersPanel, RecentActivityPanel } from './OperationsPanels';
import { parseFleet, parseOnlineUsers, parseRecentActivity, getFleet, getOnlineUsers, getRecentActivity } from './operationsApi';
import { useDashboardResource } from './useDashboardResource';
import type { Resource } from './useDashboardResource';

const fleet = { total: 60, available: 40, rented: 15, inactive: 5, online: 35, lowFuel: 0,
  byCity: [{ city: 'Dubai', count: 12 }, { city: 'Abu Dhabi', count: 18 }, { city: 'Sharjah', count: 14 }, { city: 'Ajman', count: 16 }] };
const users = Array.from({ length: 11 }, (_, i) => ({ userId: `u${i}`, fullName: `Customer ${i}`, platform: i % 2 ? 'Android' : 'iOS', lastLoginAt: i ? '2026-09-14T12:00:00Z' : null }));
const activity = {
  recentRentals: Array.from({ length: 6 }, (_, i) => ({ id: 6 - i, user: { fullName: `Rental customer ${i}` }, car: { plateNumber: 'A123' }, status: 'Completed', startDate: '2026-09-14T12:00:00Z', totalPrice: 0 })),
  recentReservations: Array.from({ length: 6 }, (_, i) => ({ id: 6 - i, customerName: `Reservation customer ${i}`, plateNumber: 'B456', status: 'Pending', reservationDate: '2026-09-14T12:00:00Z', totalPrice: 120 })),
  recentSupportMessages: Array.from({ length: 6 }, (_, i) => ({ id: i + 1, supportId: 42, message: i ? `Message ${i}` : '<script>alert(1)</script>', createdBy: 'Alex', isOperator: true, createdAt: '2026-09-14T12:00:00Z' })),
};
const ready = <T,>(data: T): Resource<T> => ({ status: 'ready', data, loadedAt: new Date() });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Day 5 response contracts', () => {
  it('keeps fleet counts, zero low fuel and all backend cities', () => {
    expect(parseFleet(fleet)).toEqual(fleet);
    expect(parseFleet(null)).toBeNull();
    expect(parseFleet({})).toBeNull();
    expect(() => parseFleet({ ...fleet, available: -1 })).toThrow();
    expect(() => parseFleet({ ...fleet, byCity: [{ city: 'Dubai', count: '12' }] })).toThrow();
  });
  it('maps userId without using location or guessing online state from last login', () => {
    expect(parseOnlineUsers(users)[0]).toEqual({ id: 'u0', fullName: 'Customer 0', platform: 'iOS', lastLoginAt: null });
    expect(parseOnlineUsers([])).toEqual([]);
    expect(() => parseOnlineUsers({ users: [] })).toThrow();
    expect(() => parseOnlineUsers([users[0], users[0]])).toThrow('Duplicate');
    expect(() => parseOnlineUsers([{ ...users[0], lastLoginAt: 'bad-date' }])).toThrow();
  });
  it('maps nested rentals and flat reservations separately, preserving backend order', () => {
    const data = parseRecentActivity(activity);
    expect(data.rentals[0].customer).toBe('Rental customer 0');
    expect(data.reservations[0].customer).toBe('Reservation customer 0');
    expect(data.rentals.map(row => row.id)).toEqual([6, 5, 4, 3, 2, 1]);
    expect(data.messages[0].sender).toBe('Operator');
    expect(() => parseRecentActivity({ recentRentals: [] })).toThrow();
  });
  it('handles absent optional fields without manufacturing amounts or dates', () => {
    const data = parseRecentActivity({ ...activity, recentRentals: [{ id: 1, user: null, car: {}, status: 'Active' }] });
    expect(data.rentals[0]).toEqual({ id: 1, customer: 'Not provided', car: 'Not provided', status: 'Active', startDate: null, totalPrice: null });
  });
  it('uses exact endpoints through the cookie API client', async () => {
    const mock = vi.fn(async (url: string) => new Response(JSON.stringify(url.endsWith('/fleet') ? fleet : url.endsWith('/online-users') ? users : activity)));
    vi.stubGlobal('fetch', mock);
    const controller = new AbortController();
    await Promise.all([getFleet(controller.signal), getOnlineUsers(controller.signal), getRecentActivity(controller.signal)]);
    expect(mock.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:4000/api/admin/dashboard/fleet', 'http://localhost:4000/api/admin/dashboard/online-users', 'http://localhost:4000/api/admin/dashboard/recent-activity',
    ]);
    for (const [, options] of mock.mock.calls as unknown as [string, RequestInit][]) {
      expect(options.credentials).toBe('include'); expect(options.cache).toBe('no-store');
    }
  });
});

describe('Day 5 panels', () => {
  it('renders all fleet measures and cities', () => {
    render(<FleetPanel state={ready(fleet)} retry={() => {}} />);
    expect(screen.getByText('Low fuel')).toBeTruthy(); expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getByText('Sharjah')).toBeTruthy(); expect(screen.getByText('Ajman')).toBeTruthy();
  });
  it('filters and searches the online snapshot, with pagination and missing login time', async () => {
    render(<OnlineUsersPanel state={ready(parseOnlineUsers(users))} retry={() => {}} />);
    expect(screen.getByText('Not provided')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Customer 10')).toBeTruthy();
    await userEvent.selectOptions(screen.getByLabelText('Platform'), 'Android');
    expect(screen.getByText('Page 1 of 1')).toBeTruthy();
    expect(screen.queryByText('Customer 10')).toBeNull();
    await userEvent.type(screen.getByRole('searchbox'), 'no-match');
    expect(screen.getByText('No results found.')).toBeTruthy();
  });
  it('shows six real rows per recent section and renders message text safely', () => {
    const { container } = render(<RecentActivityPanel state={ready(parseRecentActivity(activity))} retry={() => {}} />);
    for (const name of ['Recent rentals', 'Recent reservations', 'Recent support messages']) {
      expect(within(screen.getByRole('table', { name })).getAllByRole('row')).toHaveLength(7);
    }
    expect(screen.getByText('<script>alert(1)</script>')).toBeTruthy();
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getAllByText('0.00 AED')).toHaveLength(6);
  });
  it('shows independent empty messages without padding lists to six rows', () => {
    render(<><FleetPanel state={ready(null)} retry={() => {}} /><OnlineUsersPanel state={ready([])} retry={() => {}} />
      <RecentActivityPanel state={ready({ rentals: [], reservations: [], messages: [] })} retry={() => {}} /></>);
    expect(screen.getByText('No fleet data available.')).toBeTruthy();
    expect(screen.getByText('No customers are currently online.')).toBeTruthy();
    expect(screen.getByText('No recent rentals.')).toBeTruthy();
    expect(screen.getByText('No recent reservations.')).toBeTruthy();
    expect(screen.getByText('No recent support messages.')).toBeTruthy();
  });
  it('loads each resource separately and retries a failed section without losing another', async () => {
    let fail = true;
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(url.endsWith('/fleet') ? (fail ? { message: 'Fleet unavailable' } : fleet) : users), { status: url.endsWith('/fleet') && fail ? 503 : 200 }));
    vi.stubGlobal('fetch', fetchMock);
    function Panels() {
      const fleetState = useDashboardResource(getFleet, 0);
      const online = useDashboardResource(getOnlineUsers, 0);
      return <><FleetPanel {...fleetState} /><OnlineUsersPanel {...online} /></>;
    }
    render(<Panels />);
    expect(screen.getByText('Loading fleet summary…')).toBeTruthy();
    expect(screen.getByText('Loading online users…')).toBeTruthy();
    expect(await screen.findByText('Fleet unavailable')).toBeTruthy();
    expect(screen.getByText('Customer 0')).toBeTruthy();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Low fuel')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it('shows recent-activity loading and server errors with retry', async () => {
    const retry = vi.fn();
    const { rerender } = render(<RecentActivityPanel state={{ status: 'loading' }} retry={retry} />);
    expect(screen.getByText('Loading recent activity…')).toBeTruthy();
    rerender(<RecentActivityPanel state={{ status: 'error', message: 'Activity unavailable' }} retry={retry} />);
    expect(screen.getByRole('alert').textContent).toBe('Activity unavailable');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' })); expect(retry).toHaveBeenCalledOnce();
  });
});
