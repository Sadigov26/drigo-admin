import { beforeEach, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { grouped, monthDetail, monthly, points, transactions } from './analyticsApi';
vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
it('validates chart numbers without converting missing data to zero', () => {
  const series = [{ key: 'revenue.total', label: 'Revenue' }];
  expect(points([{ month: '2026-08', revenue: { total: 0 } }], 'month', series)).toHaveLength(1);
  expect(() => points([{ month: '2026-08', revenue: {} }], 'month', series)).toThrow();
  expect(() => points([{ month: '2026-08', revenue: { total: Infinity } }], 'month', series)).toThrow();
  expect(points([], 'month', series)).toEqual([]);
});
it('keeps monthly server totals and uses selected month count', async () => {
  const response = { months: [{ month: '2026-08', revenue: { total: 100 }, operatingCost: 20, netRevenue: 80 }], totals: { netRevenue: 80 } };
  vi.mocked(apiRequest).mockResolvedValue(response);
  expect(await monthly(6)).toEqual(response);
  expect(apiRequest).toHaveBeenCalledWith('/api/admin/reports/monthly?months=6', expect.anything());
});
it('guards drill-down month before making a request', async () => {
  await expect(monthDetail('2026-13')).rejects.toThrow();
  expect(apiRequest).not.toHaveBeenCalled();
  vi.mocked(apiRequest).mockResolvedValue({ month: '2026-08', revenue: { total: 100 }, operatingCost: 120, netRevenue: -20 });
  await monthDetail('2026-08');
  expect(apiRequest).toHaveBeenCalledWith('/api/admin/reports/monthly/2026-08', expect.anything());
});
it('rejects wrong-month and malformed drill-down responses', async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce({ month: '2026-07', revenue: { total: 100 }, operatingCost: 20, netRevenue: 80 });
  await expect(monthDetail('2026-08')).rejects.toThrow('selected month');
  vi.mocked(apiRequest).mockResolvedValueOnce({ month: '2026-08', revenue: { total: 100 }, operatingCost: 20 });
  await expect(monthDetail('2026-08')).rejects.toThrow('chart values');
});
it('rejects duplicate or invalid report months before rendering', async () => {
  const row = { month: '2026-08', revenue: { total: 100 }, operatingCost: 120, netRevenue: -20 };
  for (const months of [[row, row], [{ ...row, month: '2026-13' }]]) {
    vi.mocked(apiRequest).mockResolvedValueOnce({ months, totals: {} });
    await expect(monthly(6)).rejects.toThrow('report month');
  }
});
it('does not request invalid report periods', async () => {
  for (const period of [0, 25, 1.5, NaN]) await expect(monthly(period)).rejects.toThrow('period');
  expect(apiRequest).not.toHaveBeenCalled();
});
it('preserves negative net revenue and zero totals', async () => {
  const response = { months: [{ month: '2026-08', revenue: { total: 0 }, operatingCost: 20, netRevenue: -20 }], totals: { revenue: 0, netRevenue: -20 } };
  vi.mocked(apiRequest).mockResolvedValue(response);
  expect(await monthly(6)).toEqual(response);
});
it('loads every transaction page with abort signal', async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce({ data: [{ id: 1, amount: 4 }], total: 2 }).mockResolvedValueOnce({ data: [{ id: 2, amount: 8 }], total: 2 });
  const signal = new AbortController().signal;
  expect(await transactions('salik', signal)).toHaveLength(2);
  expect(apiRequest).toHaveBeenLastCalledWith('/api/admin/salik/trips?page=2&pageSize=200', { signal });
});
it('rejects duplicate, changed and incomplete snapshots', async () => {
  for (const next of [{ data: [{ id: 1, amount: 4 }], total: 2 }, { data: [], total: 2 }, { data: [], total: 3 }]) {
    vi.mocked(apiRequest).mockResolvedValueOnce({ data: [{ id: 1, amount: 4 }], total: 2 }).mockResolvedValueOnce(next);
    await expect(transactions('salik')).rejects.toThrow();
  }
});
it('aggregates all stations precisely and preserves unknown station labels', () => {
  expect(grouped([{ station: 'A', amount: 0.1, liters: 1 }, { station: 'A', amount: 0.2, liters: 2 }, { amount: 4, liters: 1 }], 'station')).toEqual([{ name: 'A', amount: 0.3, liters: 3, count: 2 }, { name: 'Unknown', amount: 4, liters: 1, count: 1 }]);
});
