import { apiRequest } from '../api/client';
export type Row = Record<string, unknown>;
export const audiences = ['All', 'Verified', 'Unverified', 'WithDebt', 'Inactive'];
export const campaignStatuses = ['Draft', 'Scheduled', 'Sending', 'Sent', 'Cancelled'];
export const zoneTypes = ['Operating', 'Restricted', 'NoParking', 'Premium'];
export function object(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid record returned by the server.');
  return value as Row;
}
export function rows(value: unknown): Row[] {
  if (!Array.isArray(value)) throw new Error('Invalid list returned by the server.');
  return value.map(object);
}
export async function read(path: string, signal?: AbortSignal): Promise<unknown> { return apiRequest(`/api/admin/${path}`, { signal }); }
// Array endpoints and paginated endpoints share a complete snapshot for local search/sort.
export async function snapshot(path: string, signal?: AbortSignal): Promise<Row[]> {
  const result = await read(`${path}?page=1&pageSize=100`, signal);
  if (Array.isArray(result)) return rows(result);
  const first = object(result), total = first.total, size = Number(first.pageSize);
  if (!Number.isSafeInteger(total) || Number(total) < 0 || Number(total) > 100000 || !Number.isSafeInteger(size) || size < 1) throw new Error('Invalid pagination returned by the server.');
  const collected = rows(first.data);
  for (let page = 2; collected.length < Number(total); page++) {
    const next = object(await read(`${path}?page=${page}&pageSize=${size}`, signal)), batch = rows(next.data);
    if (next.total !== total || next.page !== page || !batch.length) throw new Error('The list changed during loading. Refresh it.');
    collected.push(...batch);
  }
  const identities = collected.map(row => row.id ?? row.carId);
  if (collected.length !== total || identities.some(id => id == null) || new Set(identities).size !== collected.length) throw new Error('Incomplete or duplicate list. Refresh it.');
  return collected;
}
export function polygon(value: unknown): { lat: number; lng: number }[] {
  const points = rows(value).map(row => {
    if (typeof row.lat !== 'number' || !Number.isFinite(row.lat) || Math.abs(row.lat) > 90 || typeof row.lng !== 'number' || !Number.isFinite(row.lng) || Math.abs(row.lng) > 180) throw new Error('Each polygon point needs valid numeric lat and lng coordinates.');
    return { lat: row.lat, lng: row.lng };
  });
  if (new Set(points.map(p => `${p.lat},${p.lng}`)).size < 3) throw new Error('A polygon needs at least three distinct points.');
  return points;
}
export function payload(kind: string, draft: Row): Row {
  const required = (key: string) => { const value = String(draft[key] ?? '').trim(); if (!value) throw new Error(`${key === 'body' ? 'Message' : key} is required.`); return value; };
  if (kind === 'geozones') {
    const type = required('type'), color = required('color');
    if (!zoneTypes.includes(type) || !/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Choose a valid zone type and six-digit hex color.');
    let points: unknown;
    try { points = typeof draft.polygon === 'string' ? JSON.parse(draft.polygon) : draft.polygon; } catch { throw new Error('Polygon must be JSON: [{"lat":25.2,"lng":55.3}, …].'); }
    return { name: required('name'), type, color, isActive: draft.isActive === true, polygon: polygon(points) };
  }
  const targetAudience = required('targetAudience');
  if (!audiences.includes(targetAudience)) throw new Error('Select a supported audience.');
  const result: Row = { title: required('title'), body: required('body'), targetAudience };
  if (kind === 'notifications/campaigns') {
    const status = required('status'); if (!campaignStatuses.includes(status)) throw new Error('Select a supported status.'); result.status = status;
  }
  if (kind !== 'notifications/broadcast') {
    const date = String(draft.scheduledAt ?? '');
    if ((kind === 'notifications/scheduled' || result.status === 'Scheduled') && !date) throw new Error('Schedule time is required.');
    if (date && !Number.isFinite(Date.parse(date))) throw new Error('Enter a valid schedule time.');
    if (date && (kind === 'notifications/scheduled' || result.status === 'Scheduled') && Date.parse(date) <= Date.now()) throw new Error('Schedule time must be in the future.');
    result.scheduledAt = date ? new Date(date).toISOString() : null;
  }
  return result;
}
export async function write(path: string, method: string, body?: Row): Promise<unknown> { return apiRequest(`/api/admin/${path}`, { method, body: body ? JSON.stringify(body) : undefined }); }
export async function preview(targetAudience: string): Promise<number> {
  const result = object(await write('notifications/preview-target', 'POST', { targetAudience }));
  if (result.audience !== targetAudience || !Number.isSafeInteger(result.estimatedRecipients) || Number(result.estimatedRecipients) < 0) throw new Error('Invalid audience preview.');
  return Number(result.estimatedRecipients);
}
