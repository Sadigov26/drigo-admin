import { apiRequest } from '../api/client';
import { parsePage } from './carsApi';
import type { Car } from './carsApi';

export type Point = { latitude: number; longitude: number; speed: number; at: string };
export type TrackedCar = { id: number; plateNumber: string; brandName: string; modelName: string; latitude: number; longitude: number; speed: number; fuelLevel: number; status: string; online: boolean };
export type VehicleStatus = { carId: number; engineOn: boolean; doorsLocked: boolean; online: boolean; speed: number; fuelLevel: number; activeRentalId: number | null };
export type Activity = { carId: number; lastActivityAt: string | null; event: string };
export type Command = { code: string; name: string };
export type ProblemCar = Car & { issues: string[]; issueText: string };
const root = '/api/admin/cars';
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Unexpected vehicle data.');
  return value as Record<string, unknown>;
}
function list(value: unknown): unknown[] { if (!Array.isArray(value)) throw new Error('Vehicle list is missing.'); return value; }
function text(value: unknown): string { if (value == null) return '—'; if (typeof value !== 'string') throw new Error('Invalid vehicle label.'); return value; }
function numeric(value: unknown, min: number, max = Infinity): number { if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error('Invalid vehicle measurement.'); return value; }
function id(value: unknown): number { const result = numeric(value, 1); if (!Number.isSafeInteger(result)) throw new Error('Invalid vehicle ID.'); return result; }
function bool(value: unknown): boolean { if (typeof value !== 'boolean') throw new Error('Invalid vehicle state.'); return value; }
function time(value: unknown): string { if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('Invalid vehicle timestamp.'); return value; }
export function parseTracking(value: unknown): TrackedCar[] {
  const rows = list(value).map(item => { const row = object(item); return { id: id(row.id), plateNumber: text(row.plateNumber), brandName: text(row.brandName), modelName: text(row.modelName), latitude: numeric(row.latitude, -90, 90), longitude: numeric(row.longitude, -180, 180), speed: numeric(row.speed, 0), fuelLevel: numeric(row.fuelLevel, 0, 100), status: text(row.status), online: bool(row.online) }; });
  if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Duplicate tracking IDs.');
  return rows;
}
export function parsePoints(value: unknown): Point[] {
  return list(value).map(item => { const row = object(item); return { latitude: numeric(row.latitude, -90, 90), longitude: numeric(row.longitude, -180, 180), speed: numeric(row.speed, 0), at: time(row.at) }; }).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}
export const getTracking = async (signal: AbortSignal) => parseTracking(await apiRequest(root + '/tracking', { signal, cache: 'no-store' }));
export const getPoints = async (carId: number, signal: AbortSignal) => parsePoints(await apiRequest(`${root}/${carId}/gps-points`, { signal, cache: 'no-store' }));
export async function getStatus(carId: number, signal: AbortSignal): Promise<VehicleStatus> {
  const row = object(await apiRequest(`${root}/${carId}/status`, { signal, cache: 'no-store' }));
  if (id(row.carId) !== carId) throw new Error('Vehicle status ID mismatch.');
  return { carId, engineOn: bool(row.engineOn), doorsLocked: bool(row.doorsLocked), online: bool(row.online), speed: numeric(row.speed, 0), fuelLevel: numeric(row.fuelLevel, 0, 100), activeRentalId: row.activeRentalId == null ? null : id(row.activeRentalId) };
}
export async function getActivity(carId: number, signal: AbortSignal): Promise<Activity> {
  const row = object(await apiRequest(`${root}/${carId}/last-activity`, { signal, cache: 'no-store' }));
  if (id(row.carId) !== carId) throw new Error('Activity ID mismatch.');
  return { carId, event: text(row.event), lastActivityAt: row.lastActivityAt == null ? null : time(row.lastActivityAt) };
}
export async function getCommands(signal: AbortSignal): Promise<Command[]> {
  return list(await apiRequest(root + '/commands', { signal })).map(item => { const row = object(item); return { code: text(row.code), name: text(row.name) }; });
}
export async function getProblems(signal: AbortSignal): Promise<ProblemCar[]> {
  const raw = list(await apiRequest(root + '/problematic', { signal, cache: 'no-store' }));
  const cars = parsePage({ data: raw, total: raw.length, page: 1, pageSize: Math.max(1, raw.length) }).data;
  return cars.map((car, index) => { const issues = list(object(raw[index]).issues).map(text); return { ...car, issues, issueText: issues.join(', ') }; });
}
export async function sendCommand(carId: number, command: string): Promise<void> {
  const row = object(await apiRequest(`${root}/${carId}/send-command`, { method: 'POST', body: JSON.stringify({ command }) }));
  if (row.success !== true || row.command !== command) throw new Error('Command was not confirmed. Refresh status before retrying.');
}
export async function toggleActive(carId: number): Promise<void> {
  const row = object(await apiRequest(`${root}/${carId}/toggle-active`, { method: 'GET', cache: 'no-store' }));
  if (row.success !== true) throw new Error('Status change was not confirmed. Refresh before retrying.');
}
