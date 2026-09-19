import { apiRequest } from '../api/client';

export const statuses = ['Active', 'Started', 'Completed', 'PaymentPending', 'Cancelled', 'Accident'] as const;
export type Rental = { id: number; user: Record<string, unknown> | null; car: Record<string, unknown> | null; status: string; startDate: string | null; endDate?: string | null; totalPrice: number | null };
export type Detail = Rental & Record<string, unknown>;
export type Query = { page: number; pageSize: number; search: string; status: string; sortBy: string; sortOrder: 'asc' | 'desc'; startFrom?: string; startTo?: string; minHours?: string; maxHours?: string };
export type Page = { data: Rental[]; total: number; page: number; pageSize: number };
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid rental response.');
  return value as Record<string, unknown>;
}
function id(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new Error('Invalid rental ID.');
  return value;
}
function number(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Invalid rental number.');
  return value;
}
export function parseRental(value: unknown): Detail {
  const row = object(value);
  if (typeof row.status !== 'string' || !row.status) throw new Error('Missing rental status.');
  if (row.startDate != null && (typeof row.startDate !== 'string' || !Number.isFinite(Date.parse(row.startDate)))) throw new Error('Invalid start date.');
  if (row.endDate != null && (typeof row.endDate !== 'string' || !Number.isFinite(Date.parse(row.endDate)))) throw new Error('Invalid end date.');
  return { ...row, id: id(row.id), user: row.user == null ? null : object(row.user), car: row.car == null ? null : object(row.car), status: row.status, startDate: row.startDate == null ? null : row.startDate as string, endDate: row.endDate == null ? null : row.endDate as string, totalPrice: number(row.totalPrice) };
}
export function parsePage(value: unknown): Page {
  const row = object(value);
  if (!Array.isArray(row.data) || typeof row.total !== 'number' || !Number.isSafeInteger(row.total) || row.total < 0) throw new Error('Invalid rental page.');
  const data = row.data.map(parseRental);
  if (new Set(data.map(item => item.id)).size !== data.length) throw new Error('Duplicate rentals. Refresh the list.');
  return { data, total: row.total, page: id(row.page), pageSize: id(row.pageSize) };
}
async function fetchPage(query: Query, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize), sortBy: query.sortBy, sortOrder: query.sortOrder });
  if (query.status) params.set('status', query.status);
  return parsePage(await apiRequest<unknown>(`/api/admin/rentals?${params}`, { signal }));
}
export function durationHours(row: Rental, now = Date.now()): number | null {
  if (!row.startDate) return null;
  const end = row.endDate ? Date.parse(row.endDate) : ['Active', 'Started'].includes(row.status) ? now : NaN;
  const hours = (end - Date.parse(row.startDate)) / 3600000;
  return Number.isFinite(hours) && hours >= 0 ? hours : null;
}
function hourBound(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error('Duration must be a non-negative number of hours.');
  return parsed;
}
function dayBound(value: string | undefined): number | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Enter a valid date.');
  const parsed = Date.parse(`${value}T00:00:00+04:00`);
  if (!Number.isFinite(parsed) || new Date(parsed + 4 * 3600000).toISOString().slice(0, 10) !== value) throw new Error('Enter a valid date.');
  return parsed;
}
export async function getRentals(query: Query, signal?: AbortSignal): Promise<Page> {
  const min = hourBound(query.minHours), max = hourBound(query.maxHours);
  const from = dayBound(query.startFrom), to = dayBound(query.startTo);
  if (min != null && max != null && min > max) throw new Error('Minimum duration cannot exceed maximum duration.');
  if (from != null && to != null && from > to) throw new Error('Start date range is reversed.');
  if (!query.search.trim() && min == null && max == null && from == null && to == null) return fetchPage(query, signal);
  const snapshotTime = Date.now();
  const all: Rental[] = [];
  const seen = new Set<number>();
  for (let page = 1; page <= 100; page++) {
    const batch = await fetchPage({ ...query, page, pageSize: 200 }, signal);
    for (const row of batch.data) {
      if (seen.has(row.id)) throw new Error('Rentals changed during search. Please retry.');
      seen.add(row.id); all.push(row);
    }
    if (all.length >= batch.total) {
      const needle = query.search.trim().toLocaleLowerCase();
      const found = all.filter(row => {
        if (![row.id, row.user?.fullName, row.user?.email, row.user?.phoneNumber, row.car?.plateNumber].some(value => String(value ?? '').toLocaleLowerCase().includes(needle))) return false;
        const start = row.startDate ? Date.parse(row.startDate) : NaN;
        if (from != null && !(start >= from)) return false;
        if (to != null && !(start < to + 86400000)) return false;
        const hours = durationHours(row, snapshotTime);
        return (min == null || (hours != null && hours >= min)) && (max == null || (hours != null && hours <= max));
      });
      return { data: found.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: found.length, page: query.page, pageSize: query.pageSize };
    }
    if (!batch.data.length) throw new Error('Incomplete rental search. Please retry.');
  }
  throw new Error('Too many rentals for local search. Narrow the status filter.');
}
export async function getRental(rentalId: number, signal?: AbortSignal) {
  const result = parseRental(await apiRequest<unknown>(`/api/admin/rentals/${rentalId}`, { signal }));
  if (result.id !== rentalId) throw new Error('Rental response does not match the selection.');
  return result;
}
export async function getPayments(rentalId: number, signal?: AbortSignal): Promise<Record<string, unknown>[]> {
  const result = await apiRequest<unknown>(`/api/admin/rentals/${rentalId}/payments`, { signal });
  if (!Array.isArray(result)) throw new Error('Invalid payment list.');
  return result.map(value => { const row = object(value); id(row.id); number(row.amount); return row; });
}
export async function getRoute(rentalId: number, signal?: AbortSignal) {
  const row = object(await apiRequest<unknown>(`/api/admin/rentals/${rentalId}/route`, { signal }));
  if (row.rentalId !== rentalId || !Array.isArray(row.coordinates)) throw new Error('Invalid rental route.');
  const points = row.coordinates.map(value => {
    const point = object(value);
    const latitude = number(point.latitude), longitude = number(point.longitude);
    if (latitude == null || longitude == null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || typeof point.at !== 'string' || !Number.isFinite(Date.parse(point.at))) throw new Error('Invalid route coordinates.');
    return { latitude, longitude, at: point.at };
  }).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return { points, distance: number(row.distance) };
}
