import { apiRequest } from '../api/client';

export const kpiKeys = [
  'totalMembers', 'totalCars', 'activeRentals', 'activeReservations', 'openSupportTickets',
  'totalDeliveryDrivers', 'onlineDrivers', 'todayRevenue', 'monthlyRevenue', 'totalRevenue',
  'totalDebt', 'stripeMonthlyRevenue', 'stripeTotalRevenue', 'averageVerificationTimeHours',
  'pendingVerificationCount', 'iosUsers', 'androidUsers', 'approvedMembers',
] as const;
export type KpiKey = typeof kpiKeys[number];
export type Kpis = Record<KpiKey, number> & { totalDebtBreakdown: { customer: number; company: number } };
export type TrendPoint = { date: string; value: number };
export type Trends = { revenue: TrendPoint[]; rentals: TrendPoint[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function parseKpis(value: unknown): Kpis | null {
  if (value === null || (isRecord(value) && Object.keys(value).length === 0)) return null;
  if (!isRecord(value) || !kpiKeys.every(key => isNumber(value[key]))) {
    throw new Error('The server returned invalid KPI data.');
  }
  const debt = value.totalDebtBreakdown;
  if (!isRecord(debt) || !isNumber(debt.customer) || !isNumber(debt.company)) {
    throw new Error('The server returned an invalid debt breakdown.');
  }
  return value as Kpis;
}

function parsePoints(value: unknown, field: 'revenue' | 'count'): TrendPoint[] {
  if (!Array.isArray(value)) throw new Error('The server returned invalid trend data.');
  const dates = new Set<string>();
  return value.map(point => {
    if (!isRecord(point) || typeof point.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(point.date)
      || !isNumber(point[field]) || (field === 'count' && !Number.isInteger(point[field]))) {
      throw new Error('The server returned invalid trend data.');
    }
    const date = new Date(point.date + 'T00:00:00Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== point.date || dates.has(point.date)) {
      throw new Error('The server returned invalid trend dates.');
    }
    dates.add(point.date);
    return { date: point.date, value: point[field] as number };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

export function parseTrends(value: unknown): Trends {
  if (value === null || (isRecord(value) && Object.keys(value).length === 0)) return { revenue: [], rentals: [] };
  if (!isRecord(value)) throw new Error('The server returned invalid trend data.');
  // These are the two series used on this page; the endpoint also provides registrations and reservations.
  return { revenue: parsePoints(value.revenueTrends, 'revenue'), rentals: parsePoints(value.rentalTrends, 'count') };
}

export async function getKpis(signal: AbortSignal) {
  return parseKpis(await apiRequest<unknown>('/api/admin/dashboard/kpis', { signal, cache: 'no-store' }));
}

export async function getTrends(signal: AbortSignal) {
  return parseTrends(await apiRequest<unknown>('/api/admin/dashboard/trends', { signal, cache: 'no-store' }));
}
