import { apiRequest } from '../api/client';
import { getCar, getCars } from '../cars/carsApi';
import { getStatus } from '../cars/telematicsApi';
import { getRental, object, parseRental, statuses } from './rentalsApi';

export type KmPackage = { id: number; km: number; price: number; currency: string };
export type RentalAction = { type: 'end' } | { type: 'switch'; carId: number }
  | { type: 'status'; status: string } | { type: 'comp'; km: number; reason: string }
  | { type: 'package'; package: KmPackage };
const positive = (value: number) => Number.isFinite(value) && value > 0;
export async function getPackages(id: number, signal?: AbortSignal): Promise<KmPackage[]> {
  const rows = await apiRequest<unknown>(`/api/admin/rentals/${id}/km-package-options`, { signal });
  if (!Array.isArray(rows)) throw new Error('Invalid kilometre packages.');
  return rows.map(value => {
    const row = object(value);
    if (!Number.isSafeInteger(row.id) || !positive(Number(row.id)) || typeof row.km !== 'number' || !positive(row.km)
      || typeof row.price !== 'number' || !positive(row.price) || typeof row.currency !== 'string') throw new Error('Invalid kilometre package.');
    return row as KmPackage;
  });
}
export async function getAvailableCars(signal: AbortSignal) {
  return (await getCars({ page: 1, pageSize: 10000, search: '', sortBy: 'plateNumber', sortOrder: 'asc', status: 'Active' }, signal)).data;
}
async function checkAvailable(carId: number, rentalId?: number) {
  const [car, status] = await Promise.all([getCar(carId), getStatus(carId, new AbortController().signal)]);
  if (car.isActive !== true || (status.activeRentalId != null && status.activeRentalId !== rentalId)) {
    throw new Error('This car is no longer available. Refresh and choose another car.');
  }
}
export async function performRentalAction(id: number, action: RentalAction) {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid rental ID.');
  if (action.type === 'comp' && !positive(action.km)) throw new Error('Enter a positive number of kilometres.');
  if (action.type === 'switch' && (!Number.isSafeInteger(action.carId) || action.carId < 1)) throw new Error('Choose an available car.');
  if (action.type === 'status' && !statuses.includes(action.status as typeof statuses[number])) throw new Error('Choose a valid status.');
  // The simulator may have changed this rental while the confirmation was open.
  const current = await getRental(id);
  if (action.type !== 'status' && !['Active', 'Started'].includes(current.status)) throw new Error('Rental is no longer active. Refresh its details.');
  let suffix = '', method = 'GET', body: string | undefined;
  if (action.type === 'end') suffix = 'end';
  if (action.type === 'switch') {
    if (action.carId === current.car?.id) throw new Error('Choose a different car.');
    await checkAvailable(action.carId);
    suffix = `switch-car?carId=${action.carId}`;
  }
  if (action.type === 'status') {
    if (action.status === current.status) throw new Error('Rental already has this status.');
    if (['Active', 'Started'].includes(action.status)) {
      if (typeof current.car?.id !== 'number') throw new Error('Rental has no valid car.');
      await checkAvailable(current.car.id, id);
    }
    suffix = `status?status=${encodeURIComponent(action.status)}`;
  }
  if (action.type === 'comp') { suffix = 'comp-km'; method = 'POST'; body = JSON.stringify({ km: action.km, reason: action.reason.trim() }); }
  if (action.type === 'package') {
    const option = (await getPackages(id)).find(item => item.id === action.package.id);
    if (!option || option.km !== action.package.km || option.price !== action.package.price || option.currency !== action.package.currency) throw new Error('Package changed. Refresh the options before buying.');
    suffix = 'add-km-package'; method = 'POST'; body = JSON.stringify({ km: option.km, price: option.price });
  }
  // Legacy GET mutations must never be prefetched, cached, or automatically retried.
  const result = await apiRequest<unknown>(`/api/admin/rentals/${id}/${suffix}`, { method, body, cache: 'no-store' });
  if (action.type === 'end') {
    if (parseRental(result).id !== id) throw new Error('Unexpected action response. Refresh before trying again.');
  } else if (object(result).success !== true) throw new Error('Action was not confirmed. Refresh before trying again.');
}
