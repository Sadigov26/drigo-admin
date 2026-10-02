import { apiRequest } from '../api/client';
import { object, read, snapshot, type Row } from '../fleet/fleetApi';
export { object, read, snapshot };
export type { Row };
export type Field = { key: string; label: string; type: 'text' | 'number' | 'boolean' | 'select' | 'textarea'; options?: string[]; required?: boolean; max?: number };
export type Action = {
  title: string; path: string; method: 'POST' | 'PUT' | 'DELETE' | 'GET'; fields: Field[]; initial: Row;
  note?: string; danger?: boolean; kind?: 'ip' | 'country' | 'sms' | 'fee' | 'cleaning' | 'scraper';
};
export function validIp(value: string): boolean {
  const [address, prefix, ...rest] = value.split('/');
  if (rest.length || prefix !== undefined && !/^\d{1,3}$/.test(prefix)) return false;
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(address)) return address.split('.').every(n => Number(n) <= 255 && String(Number(n)) === n) && (prefix === undefined || Number(prefix) <= 32);
  if (!address.includes(':') || !/^[0-9a-f:.]+$/i.test(address)) return false;
  try { new URL(`http://[${address}]/`); return prefix === undefined || Number(prefix) <= 128; } catch { return false; }
}
export function buildBody(action: Action, draft: Row): Row | undefined {
  if (action.method === 'DELETE' || action.method === 'GET') return undefined;
  const body: Row = {};
  for (const field of action.fields) {
    const raw = draft[field.key];
    if (field.type === 'boolean') { body[field.key] = raw === true; continue; }
    const value = String(raw ?? '').trim();
    if ((field.required || field.type === 'number') && !value) throw new Error(`${field.label} is required.`);
    if (field.type === 'number') {
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0 || number > (field.max ?? 1000000) || Math.abs(number * 100 - Math.round(number * 100)) > 0.00001) throw new Error(`${field.label} must be non-negative, with at most two decimals.`);
      body[field.key] = number;
    } else {
      if (value.length > 2000) throw new Error(`${field.label} is too long.`);
      if (field.options && !field.options.includes(value)) throw new Error(`Choose a valid ${field.label.toLowerCase()}.`);
      body[field.key] = value;
    }
  }
  if (action.kind === 'ip' && !validIp(String(body.entry))) throw new Error('Enter a valid IPv4/IPv6 address or CIDR range.');
  if (action.kind === 'country') {
    body.countryCode = String(body.countryCode).toUpperCase();
    if (!/^[A-Z]{2}$/.test(String(body.countryCode))) throw new Error('Use a two-letter country code.');
  }
  if (action.kind === 'sms') {
    const countries = String(body.countries ?? '').split(/[\s,]+/).filter(Boolean).map(value => value.toUpperCase());
    if (!countries.every(code => /^[A-Z]{2}$/.test(code))) throw new Error('Countries must be comma-separated two-letter codes.');
    body.countries = [...new Set(countries)];
  }
  if (body.isPercentage === true && Number(body.amount) > 100) throw new Error('Percentage cannot exceed 100.');
  return body;
}
export async function execute(action: Action, body?: Row) {
  if (action.kind === 'cleaning') {
    const current = object(await read(action.path.replace(/\/cancel$/, '')));
    if (!['Scheduled', 'InProgress'].includes(String(current.status))) throw new Error('Cleaning is no longer cancellable. Close and refresh.');
  }
  if (action.kind === 'ip' && body) {
    const blocked = await snapshot('security/blocked-ips');
    if (blocked.some(row => row.entry === body.entry)) throw new Error('This IP is already blocked.');
  }
  if (action.kind === 'country' && body) {
    const blocked = await snapshot('security/blocked-country-codes');
    if (blocked.some(row => row.countryCode === body.countryCode)) throw new Error('This country is already blocked.');
  }
  return apiRequest(`/api/admin/${action.path}`, { method: action.method, cache: 'no-store', body: body ? JSON.stringify(body) : undefined });
}
export const feeFields = (kind: string): Field[] => [
  ...(kind === 'service-fees' || kind === 'penalty-configs' ? [{ key: 'name', label: 'Name', type: 'text' as const, required: true }] : []),
  { key: kind === 'excess-km-charge' ? 'pricePerKm' : 'amount', label: kind === 'excess-km-charge' ? 'Price per km · AED' : kind === 'service-fees' ? 'Amount · AED (or % when selected)' : 'Amount · AED', type: 'number' },
  ...(kind === 'service-fees' ? [{ key: 'isPercentage', label: 'Percentage rather than fixed AED', type: 'boolean' as const }] : []),
  { key: 'isActive', label: 'Active', type: 'boolean' },
];

export async function permissionDetail(id: string, signal?: AbortSignal) {
  const data = object(await read(`permissions/admins/${encodeURIComponent(id)}`, signal));
  if (data.adminId !== id || typeof data.isSuperAdmin !== 'boolean' || !Array.isArray(data.permissionCodes) || !data.permissionCodes.every(code => typeof code === 'string')) throw new Error('Invalid admin permissions response.');
  return { ...data, adminId: id, isSuperAdmin: data.isSuperAdmin, permissionCodes: data.permissionCodes as string[] };
}
export async function savePermissions(id: string, codes: string[]) {
  const [catalogue, target] = await Promise.all([snapshot('permissions'), permissionDetail(id)]);
  if (target.isSuperAdmin) throw new Error('Super admins already have all permissions. Their role is not edited here.');
  const allowed = new Set(catalogue.map(row => String(row.code)));
  if (codes.some(code => !allowed.has(code))) throw new Error('The permission catalogue changed. Close and reload.');
  return apiRequest(`/api/admin/permissions/admins/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ permissionCodes: [...new Set(codes)] }) });
}
