import { apiRequest } from '../api/client';
import { object, validId } from './customersApi';

export const customerTabs = ['Payments', 'Debt', 'Bonus', 'Devices', 'Login history', 'Revenue', 'Reservations'] as const;
export type CustomerTab = typeof customerTabs[number];
export type Row = Record<string, unknown>;
export type TabData = { rows: Row[]; total: number; summary: Row };
const endpoints: Record<CustomerTab, string> = { Payments: 'payments', Debt: 'debt', Bonus: 'bonus', Devices: 'devices', 'Login history': 'login-history', Revenue: 'revenue', Reservations: 'reservations' };
export const serverPaged = (tab: CustomerTab) => ['Payments', 'Login history', 'Reservations'].includes(tab);
function path(id: string) {
  if (!validId(id)) throw new Error('Invalid customer UUID.');
  return `/api/admin/users/${encodeURIComponent(id)}`;
}
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
function rows(value: unknown): Row[] {
  if (!Array.isArray(value)) throw new Error('Invalid customer tab response.');
  return value.map(object);
}
export async function getCustomerTab(id: string, tab: CustomerTab, page = 1, signal?: AbortSignal): Promise<TabData> {
  const raw = await apiRequest<unknown>(`${path(id)}/${endpoints[tab]}${serverPaged(tab) ? `?page=${page}&pageSize=10` : ''}`, { signal });
  if (tab === 'Devices') return { rows: rows(raw), total: rows(raw).length, summary: {} };
  const data = object(raw);
  if (serverPaged(tab)) {
    if (!Number.isSafeInteger(data.total) || Number(data.total) < 0 || data.page !== page || data.pageSize !== 10) throw new Error('Invalid pagination response.');
    return { rows: rows(data.data), total: Number(data.total), summary: {} };
  }
  if (data.userId !== id || typeof data.currency !== 'string') throw new Error('Customer data does not match this account.');
  if (tab === 'Debt') {
    const debts = rows(data.debts);
    if (!finite(data.totalDebt) || debts.some(row => !Number.isSafeInteger(row.id) || !finite(row.amount) || typeof row.isPaid !== 'boolean' || typeof row.currency !== 'string')) throw new Error('Invalid debt response.');
    return { rows: debts, total: debts.length, summary: { totalDebt: data.totalDebt, currency: data.currency } };
  }
  if (tab === 'Bonus') {
    if (!finite(data.balance)) throw new Error('Invalid bonus balance.');
    return { rows: rows(data.history), total: rows(data.history).length, summary: { balance: data.balance, currency: data.currency } };
  }
  if (![data.totalRevenue, data.totalRentals, data.averageRentalValue].every(finite)) throw new Error('Invalid revenue response.');
  return { rows: [], total: 0, summary: data };
}
export function debtSnapshot(data: TabData) {
  return JSON.stringify(data.rows.filter(row => !row.isPaid).map(row => [row.id, row.amount, row.currency]).sort((a, b) => Number(a[0]) - Number(b[0])));
}
export async function payAllDebts(id: string, expected: TabData) {
  const fresh = await getCustomerTab(id, 'Debt');
  if (!fresh.rows.some(row => !row.isPaid)) throw new Error('No unpaid debts remain. Refresh this tab.');
  if (debtSnapshot(fresh) !== debtSnapshot(expected)) throw new Error('Debts changed. Refresh and review the new amount.');
  const result = object(await apiRequest<unknown>(`${path(id)}/debt/pay`, { method: 'POST' }));
  if (result.success !== true || !Number.isSafeInteger(result.paidCount) || Number(result.paidCount) < 0) throw new Error('Payment result is uncertain. Refresh debts before trying again.');
  return Number(result.paidCount);
}
