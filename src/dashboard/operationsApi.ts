import { apiRequest } from '../api/client';

export type Fleet = {
  total: number; available: number; rented: number; inactive: number; online: number; lowFuel: number;
  byCity: { city: string; count: number }[];
};
export type OnlineUser = { id: string; fullName: string; platform: string; lastLoginAt: string | null };
export type RecentRental = { id: number; customer: string; car: string; status: string; startDate: string | null; totalPrice: number | null };
export type RecentReservation = { id: number; customer: string; car: string; status: string; reservationDate: string | null; totalPrice: number | null };
export type SupportMessage = { id: number; supportId: number; message: string; createdBy: string; sender: string; createdAt: string | null };
export type RecentActivity = { rentals: RecentRental[]; reservations: RecentReservation[]; messages: SupportMessage[] };

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Unexpected dashboard response.');
  return value as Record<string, unknown>;
}
function rows(value: unknown) {
  if (!Array.isArray(value)) throw new Error('Expected a dashboard list.');
  return value.map(record);
}
function text(value: unknown) {
  if (value == null || value === '') return 'Not provided';
  if (typeof value !== 'string') throw new Error('Invalid dashboard text.');
  return value;
}
function count(value: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Invalid dashboard count.');
  return value;
}
function amount(value: unknown) {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Invalid dashboard amount.');
  return value;
}
function date(value: unknown) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('Invalid dashboard date.');
  return value;
}
function unique<T extends { id: number | string }>(values: T[]): T[] {
  if (new Set(values.map(value => value.id)).size !== values.length) throw new Error('Duplicate dashboard record IDs.');
  return values;
}

export function parseFleet(value: unknown): Fleet | null {
  if (value === null) return null;
  const data = record(value);
  if (Object.keys(data).length === 0) return null;
  return {
    total: count(data.total), available: count(data.available), rented: count(data.rented),
    inactive: count(data.inactive), online: count(data.online), lowFuel: count(data.lowFuel),
    byCity: rows(data.byCity).map(row => ({ city: text(row.city), count: count(row.count) })),
  };
}

export function parseOnlineUsers(value: unknown): OnlineUser[] {
  return unique(rows(value).map(row => {
    if (typeof row.userId !== 'string' || !row.userId) throw new Error('Invalid online user ID.');
    return { id: row.userId, fullName: text(row.fullName), platform: text(row.platform), lastLoginAt: date(row.lastLoginAt) };
  }));
}

export function parseRecentActivity(value: unknown): RecentActivity {
  const data = record(value);
  return {
    rentals: unique(rows(data.recentRentals).map(row => {
      const user = row.user == null ? {} : record(row.user);
      const car = row.car == null ? {} : record(row.car);
      return { id: count(row.id), customer: text(user.fullName), car: text(car.plateNumber),
        status: text(row.status), startDate: date(row.startDate), totalPrice: amount(row.totalPrice) };
    })),
    reservations: unique(rows(data.recentReservations).map(row => ({
      id: count(row.id), customer: text(row.customerName), car: text(row.plateNumber),
      status: text(row.status), reservationDate: date(row.reservationDate), totalPrice: amount(row.totalPrice),
    }))),
    messages: unique(rows(data.recentSupportMessages).map(row => {
      if (typeof row.isOperator !== 'boolean') throw new Error('Invalid support sender type.');
      return { id: count(row.id), supportId: count(row.supportId), message: text(row.message), createdBy: text(row.createdBy),
        sender: row.isOperator ? 'Operator' : 'Customer', createdAt: date(row.createdAt) };
    })),
  };
}

export async function getFleet(signal: AbortSignal) {
  return parseFleet(await apiRequest<unknown>('/api/admin/dashboard/fleet', { signal, cache: 'no-store' }));
}
export async function getOnlineUsers(signal: AbortSignal) {
  return parseOnlineUsers(await apiRequest<unknown>('/api/admin/dashboard/online-users', { signal, cache: 'no-store' }));
}
export async function getRecentActivity(signal: AbortSignal) {
  return parseRecentActivity(await apiRequest<unknown>('/api/admin/dashboard/recent-activity', { signal, cache: 'no-store' }));
}
