import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Analytics from './Analytics';
import * as api from './analyticsApi';
vi.mock('./analyticsApi', async original => ({ ...await original<typeof api>(), getReport: vi.fn(), monthly: vi.fn(), monthDetail: vi.fn(), transactions: vi.fn() }));
vi.mock('recharts', () => ({ ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, LineChart: () => <div>Line chart</div>, BarChart: () => <div>Bar chart</div>, Line: () => null, Bar: () => null, CartesianGrid: () => null, Legend: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null }));
const month = { month: '2026-08', revenue: { total: 100, rental: 90, extraKm: 10 }, operatingCost: 20, netRevenue: 80, rentals: { total: 2 } };
beforeEach(() => {
  vi.resetAllMocks();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  vi.mocked(api.getReport).mockImplementation(async path => path.includes('demographics') ? { platform: [], age: [], gender: [] } : path.includes('customer-funnel') ? { steps: [] } : path.includes('fleet-health') ? { conditions: [] } : path.includes('monthly-financials') ? { months: [] } : { points: [] });
  vi.mocked(api.monthly).mockResolvedValue({ months: [month], totals: { revenue: 100, netRevenue: 80 } });
  vi.mocked(api.monthDetail).mockResolvedValue(month);
  vi.mocked(api.transactions).mockResolvedValue([]);
});
afterEach(cleanup);
it('renders independently loaded charts and their empty states', async () => {
  render(<Analytics />);
  await waitFor(() => expect(screen.getAllByText('No chart data available.').length).toBe(8));
  fireEvent.change(screen.getByLabelText('Daily period'), { target: { value: '7' } });
  await waitFor(() => expect(api.getReport).toHaveBeenCalledWith('analytics/revenue-daily?days=7', expect.any(AbortSignal)));
});
it('opens month drill-down and reloads a changed period', async () => {
  render(<Analytics />); fireEvent.click(screen.getByRole('button', { name: 'Monthly report' }));
  fireEvent.click(await screen.findByRole('button', { name: '2026-08' }));
  await waitFor(() => expect(api.monthDetail).toHaveBeenCalledWith('2026-08', expect.any(AbortSignal)));
  expect(await screen.findByRole('dialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Close/ }));
  fireEvent.change(screen.getByLabelText('Period'), { target: { value: '12' } });
  await waitFor(() => expect(api.monthly).toHaveBeenCalledWith(12, expect.any(AbortSignal)));
});
it('shows a retryable monthly error without hiding statistics', async () => {
  vi.mocked(api.monthly).mockRejectedValueOnce(new Error('Report unavailable')).mockResolvedValueOnce({ months: [], totals: {} });
  render(<Analytics />); fireEvent.click(screen.getByRole('button', { name: 'Monthly report' }));
  await screen.findByText('Report unavailable');
  expect(screen.getByText('All-time statistics')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(api.monthly).toHaveBeenCalledTimes(2));
});
it('paginates transaction snapshots and opens all record fields', async () => {
  vi.mocked(api.transactions).mockResolvedValue(Array.from({ length: 12 }, (_, i) => ({ id: i + 1, amount: 4, gate: 'Gate A', tripDate: '2026-08-01T00:00:00Z', billed: false, rentalId: null })));
  render(<Analytics />); fireEvent.click(screen.getByRole('button', { name: 'Salik' }));
  await screen.findByText('12 results');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByRole('button', { name: '#11' }));
  expect(screen.getByText('Rental Id')).toBeTruthy();
});
