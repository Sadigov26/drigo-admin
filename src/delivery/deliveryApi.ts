import { apiRequest } from '../api/client';

export type Row = Record<string, unknown> & { id: number };
export type Resource = 'reservations' | 'deliveryDrivers' | 'deliveryZones';
export const statuses = ['Pending', 'Confirmed', 'DriverAssigned', 'PickingUp', 'InDelivery', 'Delivered', 'Completed', 'Cancelled', 'Expired'];
const base = '/api/admin/';
export function record(value: unknown): Row {
  if (!value || typeof value !== 'object' || !('id' in value) || !Number.isSafeInteger(value.id) || Number(value.id) < 1) throw new Error('Invalid record response.');
  return value as Row;
}
export function child(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
// The mock ignores search on these endpoints. Search runs over a complete, checked snapshot.
export async function list(resource: Resource, signal?: AbortSignal): Promise<Row[]> {
  const result: Row[] = [];
  let total = -1;
  for (let page = 1; page <= 50; page++) {
    const value = child(await apiRequest(`${base}${resource}?page=${page}&pageSize=200&sortBy=id&sortOrder=asc`, { signal }));
    if (!Array.isArray(value.data) || !Number.isSafeInteger(value.total) || Number(value.total) < 0) throw new Error('Invalid pagination response.');
    if (total !== -1 && total !== value.total) throw new Error('Records changed during loading. Refresh to try again.');
    total = Number(value.total);
    result.push(...value.data.map(record));
    if (result.length >= total) {
      if (result.length !== total || new Set(result.map(row => row.id)).size !== total) throw new Error('Incomplete list. Refresh to try again.');
      return result;
    }
    if (!value.data.length) break;
  }
  throw new Error('The full list could not be loaded. Search requires a complete snapshot.');
}
export async function detail(resource: Resource, id: number, signal?: AbortSignal) {
  if (resource !== 'deliveryZones') return record(await apiRequest(`${base}${resource}/${id}`, { signal }));
  const row = (await list(resource, signal)).find(item => item.id === id);
  if (!row) throw new Error('Zone no longer exists.');
  return row;
}
export async function activeDeliveries(signal?: AbortSignal): Promise<Row[]> {
  const value = await apiRequest<unknown>(base + 'reservations/active-deliveries', { signal });
  if (!Array.isArray(value)) throw new Error('Invalid deliveries response.');
  return value.map(record);
}
export const canCancel = (row: Row) => statuses.includes(String(row.status)) && !['Completed', 'Cancelled', 'Expired'].includes(String(row.status));
export const canAssign = (row: Row) => ['Pending', 'Confirmed'].includes(String(row.status)) && !child(row.driver).id && !row.driverName;
export const available = (row: Row) => row.isActive === true && row.status === 'Online' && row.activeDeliveries === 0;
async function success(path: string, method: string, body?: unknown) {
  const value = child(await apiRequest(base + path, { method, body: body === undefined ? undefined : JSON.stringify(body) }));
  if (value.success !== true) throw new Error('Unexpected action response. Refresh before retrying.');
}
export async function reservationAction(snapshot: Row, action: 'cancel' | 'assign-driver', value: string | number) {
  const current = await detail('reservations', snapshot.id);
  if (current.status !== snapshot.status || child(current.driver).id !== child(snapshot.driver).id) throw new Error('Reservation changed. Refresh its details.');
  if (action === 'cancel') {
    if (!canCancel(current)) throw new Error('Reservation can no longer be cancelled.');
    const reason = String(value).trim();
    if (reason.length > 500) throw new Error('Reason must be 500 characters or fewer.');
    await success(`reservations/${snapshot.id}/cancel`, 'POST', { reason });
  } else {
    if (!canAssign(current)) throw new Error('Only unassigned Pending or Confirmed reservations can be assigned.');
    if (!Number.isSafeInteger(value) || Number(value) < 1) throw new Error('Choose an available driver.');
    const driver = await detail('deliveryDrivers', Number(value));
    const deliveries = await activeDeliveries();
    if (!available(driver) || deliveries.some(row => row.driverId === driver.id)) throw new Error('Driver is no longer available. Refresh and choose another.');
    await success(`reservations/${snapshot.id}/assign-driver`, 'POST', { driverId: driver.id });
  }
}
export function validate(resource: Exclude<Resource, 'reservations'>, input: Record<string, unknown>) {
  const text = (key: string, required: boolean, max: number) => {
    const value = String(input[key] ?? '').trim();
    if ((required && !value) || value.length > max) throw new Error(`${key} is required and must be at most ${max} characters.`);
    return value;
  };
  if (resource === 'deliveryDrivers') {
    const fullName = text('fullName', true, 120), phoneNumber = text('phoneNumber', true, 30), email = text('email', false, 200);
    if (!/^[+\d][\d ()-]{4,29}$/.test(phoneNumber)) throw new Error('Enter a valid phone number.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
    if (!['Online', 'Offline', 'Busy'].includes(String(input.status))) throw new Error('Invalid driver status.');
    const zoneId = input.zoneId === '' || input.zoneId == null ? null : Number(input.zoneId);
    if (zoneId !== null && (!Number.isSafeInteger(zoneId) || zoneId < 1)) throw new Error('Choose a valid zone.');
    return { fullName, phoneNumber, email, zoneId, status: input.status, isActive: input.isActive === true };
  }
  const name = text('name', true, 120);
  const centerLat = Number(input.centerLat), centerLng = Number(input.centerLng), radiusKm = Number(input.radiusKm);
  if (input.centerLat === '' || input.centerLng === '' || !Number.isFinite(centerLat) || !Number.isFinite(centerLng) || Math.abs(centerLat) > 90 || Math.abs(centerLng) > 180) throw new Error('Enter valid latitude and longitude.');
  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 1000) throw new Error('Radius must be greater than 0 and at most 1,000 km.');
  return { name, centerLat, centerLng, radiusKm, isActive: input.isActive === true };
}
export async function save(resource: Exclude<Resource, 'reservations'>, input: Record<string, unknown>, snapshot?: Row) {
  const body = validate(resource, input);
  if (resource === 'deliveryDrivers' && 'zoneId' in body && body.zoneId !== null) await detail('deliveryZones', Number(body.zoneId));
  if (snapshot) {
    const current = await detail(resource, snapshot.id);
    for (const key of Object.keys(body)) if (current[key] !== snapshot[key]) throw new Error('Record changed. Refresh before editing.');
    if (resource === 'deliveryDrivers' && (Number(current.activeDeliveries) > 0 || (Array.isArray(current.activeReservations) && current.activeReservations.length > 0))) {
      if (body.status !== current.status || body.isActive !== current.isActive || body.zoneId !== current.zoneId) throw new Error('An assigned driver cannot change availability or zone.');
    }
  }
  // Create ignores status/isActive; it always creates an Offline, active driver.
  const payload = !snapshot && resource === 'deliveryDrivers' ? { fullName: body.fullName, phoneNumber: body.phoneNumber, email: body.email, zoneId: body.zoneId } : body;
  // Zero coordinates are valid, but the mock POST substitutes random coordinates for them.
  if (!snapshot && resource === 'deliveryZones' && (body.centerLat === 0 || body.centerLng === 0)) throw new Error('This mock cannot create a zone with a zero coordinate.');
  return record(await apiRequest(base + resource + (snapshot ? `/${snapshot.id}` : ''), { method: snapshot ? 'PUT' : 'POST', body: JSON.stringify(payload) }));
}
export async function remove(resource: Exclude<Resource, 'reservations'>, snapshot: Row) {
  const current = await detail(resource, snapshot.id);
  if (resource === 'deliveryDrivers') {
    if (Number(current.activeDeliveries) > 0 || (Array.isArray(current.activeReservations) && current.activeReservations.length)) throw new Error('Driver has active deliveries and cannot be deleted.');
    const zones = await list('deliveryZones');
    if (zones.some(zone => Array.isArray(zone.driverIds) && zone.driverIds.includes(current.id))) throw new Error('Remove the driver from its zone membership before deleting.');
  } else {
    const drivers = await list('deliveryDrivers');
    if ((Array.isArray(current.driverIds) && current.driverIds.length) || drivers.some(driver => driver.zoneId === current.id)) throw new Error('Zone still has assigned drivers and cannot be deleted.');
  }
  await success(`${resource}/${snapshot.id}`, 'DELETE');
}
