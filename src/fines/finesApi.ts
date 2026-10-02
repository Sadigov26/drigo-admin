import { apiRequest } from '../api/client';
import { object, validId } from '../customers/customersApi';

export type RecordRow = Record<string, unknown> & { id: number; status?: string };
export const fineStatuses = ['Pending', 'Review', 'Billed', 'Dismissed'];
export const accidentStatuses = ['Reported', 'UnderReview', 'Resolved', 'Closed'];
export type View = 'Manual fines' | 'Review' | 'Scraper' | 'Car fines' | 'Accidents';
const paths: Record<View, string> = { 'Manual fines': '/manual-fines', Review: '/manual-fines/review', Scraper: '/manual-fines/scraper', 'Car fines': '/car-fines', Accidents: '/accidents' };
export const views = Object.keys(paths) as View[];
const base = '/api/admin';
function rows(value: unknown, car = false): RecordRow[] {
  if (!Array.isArray(value)) throw new Error('Invalid list response.');
  return value.map(item => {
    const row = object(item), id = car ? row.carId : row.id;
    if (!Number.isSafeInteger(id) || Number(id) < 1) throw new Error('Invalid record identifier.');
    return { ...row, id } as RecordRow;
  });
}
// Search is local over all pages: these endpoints do not support server search.
export async function loadRecords(view: View, signal?: AbortSignal): Promise<RecordRow[]> {
  const path = paths[view];
  if (view === 'Review') return rows(await apiRequest(base + path, { signal }));
  const result: RecordRow[] = []; let total = -1;
  for (let page = 1; page <= 50; page++) {
    const data = object(await apiRequest(`${base}${path}?page=${page}&pageSize=200&sortBy=id&sortOrder=asc`, { signal }));
    if (!Number.isSafeInteger(data.total) || Number(data.total) < 0) throw new Error('Invalid pagination.');
    if (total !== -1 && total !== data.total) throw new Error('List changed while loading. Refresh to try again.');
    total = Number(data.total);
    const next = rows(data.data, view === 'Car fines'); result.push(...next);
    if (result.length >= total) {
      if (result.length !== total || new Set(result.map(row => row.id)).size !== total) throw new Error('Incomplete list. Refresh to try again.');
      return result;
    }
    if (!next.length) break;
  }
  throw new Error('This list is too large or incomplete to search here. Use the status filter to narrow it down.');
}
export const syncStatus = (signal?: AbortSignal) => apiRequest<Record<string, unknown>>(base + '/manual-fines/sync-status', { signal });
export async function carDetails(id: number, signal?: AbortSignal) {
  const data = object(await apiRequest(`${base}/car-fines/${id}`, { signal }));
  return { ...data, fines: rows(data.fines) };
}
export type FineAction = 'bill-customer' | 'bill-company' | 'dismiss';
export async function applyFine(expected: RecordRow, action: FineAction) {
  const current = (await loadRecords('Manual fines')).find(row => row.id === expected.id);
  if (!current || !['Pending', 'Review'].includes(String(current.status))) throw new Error('Fine is no longer awaiting review. Refresh its details.');
  for (const key of ['status', 'amount', 'userId', 'rentalId', 'billedTo', 'referenceNumber']) {
    if (current[key] !== expected[key]) throw new Error('Fine changed. Refresh and review it again.');
  }
  if (action === 'bill-customer') {
    if (typeof current.userId !== 'string' || !validId(current.userId)) throw new Error('A linked customer is required before billing.');
    await apiRequest(`${base}/users/${current.userId}`);
    if (typeof current.amount !== 'number' || !Number.isFinite(current.amount) || current.amount <= 0) throw new Error('A positive fine amount is required.');
  }
  const response = object(await apiRequest(`${base}/manual-fines/${expected.id}/${action}`, { method: 'POST' }));
  if (response.success !== true) throw new Error('Unexpected result. Refresh before retrying.');
}
export type AccidentInput = { carId: number | null; rentalId: number | null; userId: string | null; status: string; faultParty: string; description: string; estimatedCost: number; location: string; accidentDate: string };
export function validateAccident(input: AccidentInput) {
  for (const id of [input.carId, input.rentalId]) if (id !== null && (!Number.isSafeInteger(id) || id <= 0)) throw new Error('Enter valid positive vehicle/rental IDs.');
  if (input.userId && !validId(input.userId)) throw new Error('Enter a valid customer UUID.');
  if (!accidentStatuses.includes(input.status) || !input.faultParty.trim()) throw new Error('Select a status and fault party.');
  if (!input.description.trim() || input.description.length > 2000 || !input.location.trim() || input.location.length > 300) throw new Error('Enter a description and location within the allowed length.');
  if (!Number.isFinite(input.estimatedCost) || input.estimatedCost < 0 || input.estimatedCost > 1_000_000 || Math.abs(input.estimatedCost * 100 - Math.round(input.estimatedCost * 100)) > 0.000001) throw new Error('Enter a cost between 0 and 1,000,000 AED with at most two decimals.');
  if (!Number.isFinite(Date.parse(input.accidentDate))) throw new Error('Enter a valid accident date.');
}
export async function saveAccident(input: AccidentInput, expected?: RecordRow) {
  validateAccident(input);
  if (expected) await checkAccident(expected);
  if (input.carId) await apiRequest(`${base}/cars/${input.carId}`);
  if (input.userId) await apiRequest(`${base}/users/${input.userId}`);
  if (input.rentalId) {
    const rental = object(await apiRequest(`${base}/rentals/${input.rentalId}`));
    if ((input.carId && object(rental.car).id !== input.carId) || (input.userId && object(rental.user).id !== input.userId)) throw new Error('Rental does not match the selected vehicle or customer.');
  }
  return object(await apiRequest(`${base}/accidents${expected ? '/' + expected.id : ''}`, { method: expected ? 'PUT' : 'POST', body: JSON.stringify(input) }));
}
async function checkAccident(expected: RecordRow) {
  const current = (await loadRecords('Accidents')).find(row => row.id === expected.id);
  if (!current || Object.keys(expected).some(key => JSON.stringify(current[key]) !== JSON.stringify(expected[key]))) throw new Error('Accident changed. Refresh and review it again.');
}
export async function deleteAccident(expected: RecordRow) {
  await checkAccident(expected);
  const result = object(await apiRequest(`${base}/accidents/${expected.id}`, { method: 'DELETE' }));
  if (result.success !== true) throw new Error('Unexpected delete result. Refresh before retrying.');
}
