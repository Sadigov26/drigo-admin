import { apiRequest } from '../api/client';

export const resources = {
  'tariff-packages': 'Packages', 'tariff-plans': 'Plans', 'tariff-templates': 'Templates',
  'tariff-distances': 'Distance allowances', insurances: 'Insurance',
  'subscription-plans': 'Subscription plans', 'subscription-bookings': 'Subscription bookings',
} as const;
export type Resource = keyof typeof resources;
export type TariffRow = Record<string, unknown> & { id: number };
export const editable = (resource: Resource) => ['tariff-packages', 'tariff-plans', 'tariff-templates'].includes(resource);

function rows(value: unknown): TariffRow[] {
  if (!Array.isArray(value) || value.some(row => !row || typeof row !== 'object' || !Number.isSafeInteger(row.id))) throw new Error('Invalid tariff response. Refresh and try again.');
  if (new Set(value.map(row => row.id)).size !== value.length) throw new Error('The list changed while loading. Refresh and try again.');
  return value;
}

// Most endpoints return arrays and ignore query parameters. Bookings alone are paginated.
export async function listTariffs(resource: Resource, signal?: AbortSignal): Promise<TariffRow[]> {
  if (resource !== 'subscription-bookings') return rows(await apiRequest<unknown>(`/api/admin/${resource}`, { signal }));
  const result: TariffRow[] = [];
  let expected: number | undefined;
  for (let page = 1; page <= 1000; page++) {
    const response = await apiRequest<{ data: unknown; total: number }>(`/api/admin/${resource}?page=${page}&pageSize=200`, { signal });
    if (!response || !Number.isSafeInteger(response.total) || response.total < 0) throw new Error('Invalid bookings response.');
    if (expected !== undefined && expected !== response.total) throw new Error('The list changed while loading. Refresh and try again.');
    expected = response.total;
    const batch = rows(response.data);
    result.push(...batch);
    rows(result);
    if (result.length === expected) return result;
    if (!batch.length || result.length > expected) break;
  }
  throw new Error('Unable to load the full bookings list. Refresh and try again.');
}

export type TariffDraft = { name: string; description: string; unitCount: string; timeUnit: string; price: string; currency: string; isActive: boolean };
export function payload(resource: Resource, draft: TariffDraft) {
  if (!editable(resource)) throw new Error('This section is read-only.');
  if (resource === 'tariff-packages') {
    const count = Number(draft.unitCount), price = Number(draft.price);
    if (!draft.unitCount.trim() || !Number.isSafeInteger(count) || count < 1) throw new Error('Enter a positive whole-number duration.');
    if (!['Hour', 'Day', 'Month'].includes(draft.timeUnit)) throw new Error('Choose a valid time unit.');
    if (!draft.price.trim() || !Number.isFinite(price) || price < 0 || Math.abs(price * 100 - Math.round(price * 100)) > 0.00001) throw new Error('Enter a non-negative price with at most two decimal places.');
    if (!/^[A-Z]{3}$/.test(draft.currency)) throw new Error('Enter a three-letter currency code.');
    return { unitCount: count, timeUnit: draft.timeUnit, price, currency: draft.currency, isActive: draft.isActive };
  }
  if (!draft.name.trim() || draft.name.trim().length > 120 || draft.description.length > 2000) throw new Error('Enter a name (up to 120 characters) and description (up to 2,000 characters).');
  return { name: draft.name.trim(), description: draft.description.trim(), isActive: draft.isActive };
}

export async function saveTariff(resource: Resource, draft: TariffDraft, id?: number) {
  const body = payload(resource, draft);
  const path = id === undefined && resource === 'tariff-packages' ? 'tariff-package' : resource;
  return apiRequest(`/api/admin/${path}${id === undefined ? '' : `/${id}`}`, { method: id === undefined ? 'POST' : 'PUT', body: JSON.stringify(body) });
}
export async function deleteTariff(resource: Resource, id: number) {
  if (!editable(resource)) throw new Error('This section is read-only.');
  return apiRequest(`/api/admin/${resource}/${id}`, { method: 'DELETE' });
}
