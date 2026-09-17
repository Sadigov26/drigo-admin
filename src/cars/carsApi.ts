import { apiRequest } from '../api/client';

export type Car = { id: number; plateNumber: string | null; brandName: string | null; modelName: string | null; isActive: boolean; activeRentalId: number | null; fuelLevel: number | null; city?: string | null };
export type CarDetail = Record<string, unknown> & { id: number };
export type Lookup = { id: number; name: string };
export type Query = { page: number; pageSize: number; search: string; sortBy: string; sortOrder: 'asc' | 'desc'; status: string };
export type Page = { data: Car[]; total: number; page: number; pageSize: number };
const root = '/api/admin';
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Unexpected car response.');
  return value as Record<string, unknown>;
}
function integer(value: unknown, min = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min) throw new Error('Invalid record count or ID.');
  return value;
}
function nullableText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') throw new Error('Invalid car text field.');
  return value;
}
export function parsePage(value: unknown): Page {
  const raw = record(value);
  if (!Array.isArray(raw.data)) throw new Error('Car list is missing.');
  const data = raw.data.map(value => {
    const row = record(value);
    if (typeof row.isActive !== 'boolean') throw new Error('Invalid car status.');
    if (row.fuelLevel != null && (typeof row.fuelLevel !== 'number' || !Number.isFinite(row.fuelLevel) || row.fuelLevel < 0 || row.fuelLevel > 100)) throw new Error('Invalid fuel level.');
    return { id: integer(row.id, 1), plateNumber: nullableText(row.plateNumber), brandName: nullableText(row.brandName), modelName: nullableText(row.modelName), isActive: row.isActive,
      activeRentalId: row.activeRentalId == null ? null : integer(row.activeRentalId, 1), fuelLevel: row.fuelLevel == null ? null : row.fuelLevel as number };
  });
  if (new Set(data.map(row => row.id)).size !== data.length) throw new Error('Duplicate car IDs.');
  return { data, total: integer(raw.total), page: integer(raw.page, 1), pageSize: integer(raw.pageSize, 1) };
}
export function carStatus(car: Car): string {
  return car.activeRentalId != null ? 'Rented' : car.isActive ? 'Active' : 'Inactive';
}
export async function getCar(id: number, signal?: AbortSignal): Promise<CarDetail> {
  const raw = record(await apiRequest(`${root}/cars/${id}`, { signal, cache: 'no-store' }));
  if (integer(raw.id, 1) !== id) throw new Error('Car ID does not match the requested record.');
  return raw as CarDetail;
}
async function requestPage(query: Query, signal: AbortSignal): Promise<Page> {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize), search: query.search, sortBy: query.sortBy, sortOrder: query.sortOrder });
  return parsePage(await apiRequest(`${root}/cars?${params}`, { signal, cache: 'no-store' }));
}
export async function getCars(query: Query, signal: AbortSignal): Promise<Page> {
  if (!query.status) return requestPage(query, signal);
  // The mock ignores ?status. Filter every matching page, not just the visible page.
  let rows: Car[] = [];
  for (let page = 1; ; page++) {
    const result = await requestPage({ ...query, page, pageSize: 200 }, signal);
    rows = rows.concat(result.data);
    if (rows.length >= result.total) break;
    if (!result.data.length || page >= 50) throw new Error('Unable to load the complete status filter. Narrow your search.');
  }
  rows = [...new Map(rows.map(row => [row.id, row])).values()].filter(row => carStatus(row) === query.status);
  return { data: rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: rows.length, page: query.page, pageSize: query.pageSize };
}
function lookup(value: unknown): Lookup {
  const row = record(value); const name = nullableText(row.name);
  if (!name) throw new Error('Lookup name is missing.');
  return { id: integer(row.id, 1), name };
}
export async function getLookups(path: string, signal: AbortSignal): Promise<Lookup[]> {
  const raw: unknown = await apiRequest(`${root}${path}`, { signal });
  if (!Array.isArray(raw)) throw new Error('Lookup list is missing.');
  return raw.map(lookup);
}
export async function getBrands(signal: AbortSignal): Promise<Lookup[]> {
  const rows: Lookup[] = [];
  for (let page = 1; page <= 50; page++) {
    const raw = record(await apiRequest(`${root}/brands?page=${page}&pageSize=200`, { signal }));
    if (!Array.isArray(raw.data)) throw new Error('Brand list is missing.');
    rows.push(...raw.data.map(lookup));
    if (rows.length >= integer(raw.total)) return rows;
    if (!raw.data.length) break;
  }
  throw new Error('Unable to load all brands.');
}
export async function saveCar(id: number | null, body: Record<string, string | number>): Promise<number> {
  const raw = record(await apiRequest(`${root}/cars${id == null ? '' : `/${id}`}`, { method: id == null ? 'POST' : 'PUT', body: JSON.stringify(body) }));
  return integer(raw.id, 1);
}
export async function deleteCar(id: number): Promise<void> {
  const raw = record(await apiRequest(`${root}/cars/${id}`, { method: 'DELETE' }));
  if (raw.success !== true) throw new Error('Deletion was not confirmed. Refresh before trying again.');
}
