import { cloneElement } from 'react';
import type { ReactElement } from 'react';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Dashboard from './Dashboard';
import { App } from '../App';
import { kpiKeys, parseKpis, parseTrends } from './dashboardApi';
import type { Kpis } from './dashboardApi';

// jsdom has no layout. Keep actual Recharts rendering, but provide a measured container size.
vi.mock('recharts', async importOriginal => ({
  ...await importOriginal<typeof import('recharts')>(),
  ResponsiveContainer: ({ children }: { children: ReactElement<{ width: number; height: number }> }) =>
    cloneElement(children, { width: 600, height: 240 }),
}));

const kpis = {
  ...Object.fromEntries(kpiKeys.map(key => [key, 0])),
  activeRentals: 12, monthlyRevenue: 1234.56, averageVerificationTimeHours: 6.4,
  totalDebtBreakdown: { customer: 125.5, company: 250 },
} as Kpis;
const trends = {
  revenueTrends: [{ date: '2026-09-13', revenue: 0 }, { date: '2026-09-12', revenue: 120.25 }],
  rentalTrends: [{ date: '2026-09-12', count: 2 }, { date: '2026-09-13', count: 0 }],
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const emptyActivity = { recentRentals: [], recentReservations: [], recentSupportMessages: [] };
function extraResponse(url: string) {
  if (url.endsWith('/fleet')) return json(null);
  if (url.endsWith('/online-users')) return json([]);
  if (url.endsWith('/recent-activity')) return json(emptyActivity);
  return null;
}

function mockDashboard(options: { kpiBody?: unknown; trendBody?: unknown; kpiStatus?: number; trendStatus?: number } = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const extra = extraResponse(url);
    if (extra) return extra;
    if (url.endsWith('/dashboard/kpis')) return json(options.kpiBody === undefined ? kpis : options.kpiBody, options.kpiStatus ?? 200);
    if (url.endsWith('/dashboard/trends')) return json(options.trendBody === undefined ? trends : options.trendBody, options.trendStatus ?? 200);
    throw new Error('Unexpected URL: ' + url);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('dashboard contracts', () => {
  it('keeps zero values and debt breakdown rather than manufacturing missing numbers', () => {
    expect(parseKpis(kpis)).toEqual(kpis);
    expect(parseKpis({})).toBeNull();
    expect(parseKpis(null)).toBeNull();
    expect(() => parseKpis({ ...kpis, activeRentals: '12' })).toThrow('invalid KPI');
    expect(() => parseKpis({ ...kpis, activeRentals: 1.5 })).toThrow('invalid KPI counts');
    expect(() => parseKpis({ ...kpis, todayRevenue: Infinity })).toThrow('invalid KPI');
    expect(() => parseKpis({ ...kpis, totalDebtBreakdown: {} })).toThrow('debt breakdown');
  });

  it('maps the actual trend fields and sorts dates without mutating the response', () => {
    expect(parseTrends(trends).revenue).toEqual([{ date: '2026-09-12', value: 120.25 }, { date: '2026-09-13', value: 0 }]);
    expect(trends.revenueTrends[0].date).toBe('2026-09-13');
    expect(parseTrends({})).toEqual({ revenue: [], rentals: [] });
  });

  it('rejects missing fields, impossible or duplicate dates and invalid counts', () => {
    expect(() => parseTrends({ revenueTrends: [] })).toThrow();
    for (const date of ['not-a-date', '2026-02-30']) {
      expect(() => parseTrends({ ...trends, rentalTrends: [{ date, count: 1 }] })).toThrow();
    }
    expect(() => parseTrends({ ...trends, rentalTrends: [trends.rentalTrends[0], trends.rentalTrends[0]] })).toThrow();
    expect(() => parseTrends({ ...trends, rentalTrends: [{ date: '2026-09-13', count: 1.5 }] })).toThrow();
  });
});

describe('live dashboard', () => {
  it('renders all 20 numeric metrics, currency and hours, and two real SVG line charts', async () => {
    const fetchMock = mockDashboard();
    const { container } = render(<Dashboard />);
    expect(await screen.findByText('1,234.56 AED')).toBeTruthy();
    expect(screen.getByText('6.4 hours')).toBeTruthy();
    expect(screen.getByText('125.50 AED')).toBeTruthy();
    expect(container.querySelectorAll('.kpi-card')).toHaveLength(20);
    expect(container.querySelectorAll('.recharts-line-curve')).toHaveLength(2);
    for (const [, options] of fetchMock.mock.calls as unknown as [string, RequestInit][]) {
      expect(options.credentials).toBe('include');
      expect(options.cache).toBe('no-store');
    }
    await userEvent.click(screen.getByText('View revenue data'));
    expect(screen.getByRole('table', { name: 'Revenue source values' })).toBeTruthy();
  });

  it('shows separate loading states while requests are pending', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<Dashboard />);
    expect(screen.getByText('Loading key figures…')).toBeTruthy();
    expect(screen.getByText('Loading trends…')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Refreshing…' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('fetches all five endpoints again on refresh and replaces old numbers', async () => {
    const fetchMock = mockDashboard();
    const { container } = render(<Dashboard />);
    await screen.findByText('1,234.56 AED');
    fetchMock.mockImplementation(async input => extraResponse(String(input)) ?? (String(input).endsWith('/kpis')
      ? json({ ...kpis, activeRentals: 14 })
      : json({ ...trends, rentalTrends: [{ date: '2026-09-13', count: 9 }] })));
    await userEvent.click(screen.getByRole('button', { name: 'Refresh dashboard' }));
    expect(await screen.findByText('14')).toBeTruthy();
    expect(container.querySelector('.kpi-card dd')?.textContent).toBe('14');
    await userEvent.click(screen.getByText('View new rentals data'));
    expect(within(screen.getByRole('table', { name: 'New rentals source values' })).getByText('9')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it('keeps the trend section available if KPIs fail, and retries only KPIs', async () => {
    const fetchMock = mockDashboard({ kpiStatus: 503, kpiBody: { message: 'KPIs unavailable' } });
    render(<Dashboard />);
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'KPIs unavailable');
    expect(screen.getByRole('heading', { name: 'Revenue' })).toBeTruthy();
    fetchMock.mockImplementation(async () => json(kpis));
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('1,234.56 AED')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('keeps KPIs available if trends fail', async () => {
    mockDashboard({ trendStatus: 503, trendBody: { message: 'Trends unavailable' } });
    render(<Dashboard />);
    expect(await screen.findByText('Trends unavailable')).toBeTruthy();
    expect(screen.getByText('1,234.56 AED')).toBeTruthy();
  });

  it('shows empty states for empty payloads but plots valid zero series', async () => {
    mockDashboard({ kpiBody: {}, trendBody: { revenueTrends: [], rentalTrends: [{ date: '2026-09-13', count: 0 }] } });
    const { container } = render(<Dashboard />);
    expect(await screen.findByText('No KPI data available.')).toBeTruthy();
    expect(screen.getByText('No trend data available.')).toBeTruthy();
    expect(container.querySelectorAll('.recharts-line')).toHaveLength(1);
  });

  it('reports malformed data instead of rendering NaN or fake zeros', async () => {
    mockDashboard({ kpiBody: { activeRentals: 1 }, trendBody: { revenueTrends: 'invalid' } });
    const { container } = render(<Dashboard />);
    expect(await screen.findAllByRole('alert')).toHaveLength(2);
    expect(container.querySelectorAll('.kpi-card')).toHaveLength(0);
  });

  it('aborts all requests when leaving the page and ignores late responses', async () => {
    const requests: { options: RequestInit; resolve: (value: Response) => void }[] = [];
    vi.stubGlobal('fetch', vi.fn((_input, options) => new Promise<Response>(resolve => requests.push({ options, resolve }))));
    const { unmount } = render(<Dashboard />);
    unmount();
    expect(requests).toHaveLength(5);
    expect(requests.every(request => request.options.signal?.aborted)).toBe(true);
    await act(async () => { requests[0].resolve(json(kpis)); requests[1].resolve(json(trends)); });
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).toBeNull();
  });
});

describe('dashboard route security', () => {
  function setup(codes: string[], expire = false) {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const extra = extraResponse(url);
      if (extra) return extra;
      if (url.endsWith('/auth/me')) return json({ id: 'admin-1', username: 'operator', fullName: 'Operator', email: null, isSuperAdmin: false });
      if (url.endsWith('/permissions/my-permissions')) return json({ adminId: 'admin-1', isSuperAdmin: false, permissionCodes: codes });
      if (url.endsWith('/dashboard/kpis')) return expire ? json({ message: 'Session expired' }, 401) : json(kpis);
      if (url.endsWith('/dashboard/trends')) return json(trends);
      throw new Error('Unexpected URL: ' + url);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<MemoryRouter initialEntries={['/dashboard']}><App /></MemoryRouter>);
    return fetchMock;
  }

  it('does not mount or request dashboard data without dashboard.view', async () => {
    const fetchMock = setup(['dashboard.edit']);
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/dashboard/'))).toBe(false);
  });

  it('allows an authorized direct URL', async () => {
    setup(['dashboard.view']);
    expect(await screen.findByText('1,234.56 AED')).toBeTruthy();
  });

  it('redirects to login if a dashboard request returns 401', async () => {
    setup(['dashboard.view'], true);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign in' })).toBeTruthy());
    expect(screen.queryByText('1,234.56 AED')).toBeNull();
  });
});
