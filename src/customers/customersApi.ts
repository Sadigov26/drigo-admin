import { apiRequest } from '../api/client';

export type Customer = Record<string, unknown> & {
  id: string; fullName: string | null; email: string | null; phoneNumber: string | null;
  createdAt: string | null; isApproved: boolean; isVerified: boolean; isBlocked: boolean; isDeleted: boolean;
};
export type Query = { page: number; pageSize: number; search: string; approvalStatus: string; sortBy: string; sortOrder: 'asc' | 'desc' };
export type CustomerPage = { data: Customer[]; total: number; page: number; pageSize: number };
export type Action = 'approve' | 'reject' | 'block' | 'unblock' | 'delete' | 'restore';
export const validId = (id: string) => /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id);
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid customer response.');
  return value as Record<string, unknown>;
}
export function parseCustomer(value: unknown): Customer {
  const row = object(value);
  if (typeof row.id !== 'string' || !validId(row.id)
    || ['isApproved', 'isVerified', 'isBlocked', 'isDeleted'].some(key => typeof row[key] !== 'boolean')
    || ['fullName', 'email', 'phoneNumber', 'createdAt'].some(key => row[key] != null && typeof row[key] !== 'string')) throw new Error('Invalid customer response.');
  return row as Customer;
}
export function customerStatus(customer: Customer) {
  return customer.isDeleted ? 'Deleted' : customer.isBlocked ? 'Blocked' : customer.isApproved ? 'Approved' : 'Pending';
}
export async function getCustomers(query: Query, signal?: AbortSignal): Promise<CustomerPage> {
  const params = new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]));
  const page = object(await apiRequest<unknown>(`/api/admin/users?${params}`, { signal }));
  if (!Array.isArray(page.data) || !Number.isSafeInteger(page.total) || Number(page.total) < 0
    || !Number.isSafeInteger(page.page) || Number(page.page) < 1 || !Number.isSafeInteger(page.pageSize) || Number(page.pageSize) < 1) throw new Error('Invalid customer list.');
  return { data: page.data.map(parseCustomer), total: Number(page.total), page: Number(page.page), pageSize: Number(page.pageSize) };
}
export async function getCustomer(id: string, signal?: AbortSignal) {
  if (!validId(id)) throw new Error('Enter a valid customer UUID.');
  const customer = parseCustomer(await apiRequest<unknown>(`/api/admin/users/${encodeURIComponent(id)}`, { signal }));
  if (customer.id !== id) throw new Error('The server returned a different customer.');
  return customer;
}
export function allowedActions(customer: Customer): Action[] {
  if (customer.isDeleted) return ['restore'];
  return [...(!customer.isApproved && !customer.isBlocked ? ['approve', 'reject'] as Action[] : []), customer.isBlocked ? 'unblock' : 'block', 'delete'];
}
export async function performCustomerAction(id: string, action: Action, reason: string) {
  // Re-check after confirmation: another admin may have changed the record.
  const current = await getCustomer(id);
  if (!allowedActions(current).includes(action)) throw new Error('Customer state changed. Refresh the details before continuing.');
  let suffix = '', method = 'DELETE', body: string | undefined;
  if (action === 'approve' || action === 'reject') {
    suffix = '/verify'; method = 'PUT'; body = JSON.stringify({ approve: action === 'approve', ...(action === 'reject' && reason.trim() ? { rejectionReason: reason.trim() } : {}) });
  } else if (action === 'block' || action === 'unblock') {
    suffix = '/block'; method = 'PATCH'; body = JSON.stringify({ blocked: action === 'block', reason: reason.trim() });
  } else if (action === 'restore') { suffix = '/restore'; method = 'POST'; }
  const result = object(await apiRequest<unknown>(`/api/admin/users/${encodeURIComponent(id)}${suffix}`, { method, body }));
  if (result.success !== true) throw new Error('The server did not confirm the action. Refresh before trying again.');
}
