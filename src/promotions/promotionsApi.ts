import { apiRequest } from '../api/client';

export const sections = { promotions: 'Promotions', discounts: 'Discounts', 'promo-codes': 'Promo codes', stories: 'Stories' } as const;
export type Section = keyof typeof sections;
export type RecordRow = Record<string, unknown> & { id: number };
export type Values = Record<string, unknown>;
export const campaignStatuses = ['Active', 'Scheduled', 'Expired', 'Paused'];
export const storyStatuses = ['Active', 'Draft', 'Archived'];
const base = '/api/admin/';
export const record = (value: unknown): Values => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid response. Refresh and try again.');
  return value as Values;
};
function rows(value: unknown): RecordRow[] {
  if (!Array.isArray(value) || value.some(row => !row || !Number.isSafeInteger(row.id))) throw new Error('Invalid list response.');
  if (new Set(value.map(row => row.id)).size !== value.length) throw new Error('The list changed while loading. Refresh and try again.');
  return value;
}
export async function listRecords(section: Section, signal?: AbortSignal) {
  if (section === 'stories') return rows(await apiRequest(base + section, { signal }));
  const result: RecordRow[] = [];
  let total: number | undefined;
  for (let page = 1; page <= 1000; page++) {
    const response = record(await apiRequest(`${base}${section}?page=${page}&pageSize=200`, { signal }));
    if (!Number.isSafeInteger(response.total) || Number(response.total) < 0) throw new Error('Invalid list total.');
    if (total !== undefined && total !== response.total) throw new Error('The list changed while loading. Refresh and try again.');
    total = Number(response.total);
    const batch = rows(response.data); result.push(...batch); rows(result);
    if (result.length === total) return result;
    if (!batch.length || result.length > total) break;
  }
  throw new Error('Unable to load the complete list. Refresh and try again.');
}
export async function getRecord(section: Section, id: number, signal?: AbortSignal) {
  const result = record(await apiRequest(`${base}${section}/${id}`, { signal }));
  if (result.id !== id) throw new Error('Unexpected record response.');
  return result as RecordRow;
}
export const getReferral = async (signal?: AbortSignal) => record(await apiRequest(base + 'referrals/settings', { signal }));
export const getAnalytics = async (section: 'discounts' | 'stories', id: number, signal?: AbortSignal) => record(await apiRequest(`${base}${section}/${id}/analytics`, { signal }));

export function displayStatus(section: Section, row: Values, now = Date.now()) {
  if (section === 'discounts' || section === 'stories') return String(row.status ?? '—');
  if (row.isActive === false) return 'Paused';
  const end = row.endDate ?? row.expiresAt;
  if (end && Date.parse(String(end)) <= now) return 'Expired';
  if (row.startDate && Date.parse(String(row.startDate)) > now) return 'Scheduled';
  return row.isActive === true ? 'Active' : '—';
}
export function safeUrl(value: unknown) {
  try { const url = new URL(String(value)); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
const text = (value: unknown, label: string, required = false, max = 2000) => {
  const result = String(value ?? '').trim();
  if ((required && !result) || result.length > max) throw new Error(`${label}: enter ${required ? 'a value' : 'text'} up to ${max} characters.`);
  return result;
};
const number = (value: unknown, label: string, min = 0, integer = false) => {
  const result = Number(value);
  if (value === null || value === undefined || String(value).trim() === '' || !Number.isFinite(result) || result < min || (integer && !Number.isSafeInteger(result))) throw new Error(`${label}: enter a valid ${integer ? 'whole ' : ''}number of at least ${min}.`);
  if (!integer && Math.abs(result * 100 - Math.round(result * 100)) > 0.00001) throw new Error(`${label}: use at most two decimal places.`);
  return result;
};
const choice = (value: unknown, allowed: string[], label: string) => { if (!allowed.includes(String(value))) throw new Error(`Choose a valid ${label}.`); return String(value); };
const timestamp = (value: unknown, required = false) => {
  if (!value) { if (required) throw new Error('Enter a start date.'); return null; }
  const parsed = Date.parse(String(value)); if (!Number.isFinite(parsed)) throw new Error('Enter a valid date.'); return new Date(parsed).toISOString();
};
export function buildPayload(section: Section | 'referrals', values: Values) {
  if (section === 'referrals') return {
    referrerBonus: number(values.referrerBonus, 'Referrer bonus'), refereeBonus: number(values.refereeBonus, 'New customer bonus'),
    minRentalsToQualify: number(values.minRentalsToQualify, 'Minimum rentals', 0, true), isActive: values.isActive === true,
    currency: choice(values.currency, ['AED'], 'currency'),
  };
  if (section === 'stories') {
    if (!Array.isArray(values.items)) throw new Error('Add a valid media list.');
    const ids = new Set<number>();
    const items = values.items.map((raw, index) => {
      const item = record(raw), id = Number(item.id);
      if (!Number.isSafeInteger(id) || id < 1 || ids.has(id)) throw new Error('Story item IDs must be unique positive numbers.');
      ids.add(id);
      if (!safeUrl(item.mediaUrl)) throw new Error(`Item ${index + 1}: enter an HTTP or HTTPS media URL.`);
      return { ...item, id, mediaType: choice(item.mediaType, ['Image', 'Video'], 'media type'), mediaUrl: String(item.mediaUrl).trim(), durationSec: number(item.durationSec, 'Duration', 1, true) };
    });
    const status = choice(values.status, storyStatuses, 'status');
    if (status === 'Active' && !items.length) throw new Error('An active story needs at least one media item.');
    return { title: text(values.title, 'Title', true, 120), targetAudience: choice(values.targetAudience, ['All', 'Verified'], 'audience'), status, items };
  }
  const result: Values = {};
  if (section !== 'promo-codes') {
    result.startDate = timestamp(values.startDate, true); result.endDate = timestamp(values.endDate);
    if (result.endDate && Date.parse(String(result.endDate)) <= Date.parse(String(result.startDate))) throw new Error('End date must be after the start date.');
  }
  if (section === 'promotions') {
    if (!safeUrl(values.imageUrl)) throw new Error('Enter an HTTP or HTTPS image URL.');
    return { ...result, title: text(values.title, 'Title', true, 120), description: text(values.description, 'Description'), imageUrl: String(values.imageUrl).trim(),
      actionType: choice(values.actionType, ['None', 'OpenCar', 'OpenTariff', 'OpenUrl'], 'action'), frequency: choice(values.frequency, ['Once', 'Daily', 'Always'], 'frequency'), isActive: values.isActive === true };
  }
  const type = choice(section === 'discounts' ? values.type : values.discountType, section === 'discounts' ? ['Percentage', 'FixedAmount', 'FixedPrice'] : ['Percentage', 'FixedAmount'], 'discount type');
  const value = number(values.value, 'Discount value', 0.01);
  if (type === 'Percentage' && value > 100) throw new Error('Percentage must not exceed 100.');
  const limitKey = section === 'discounts' ? 'usageLimit' : 'maxRedemptions';
  result[limitKey] = values[limitKey] === '' || values[limitKey] == null ? null : number(values[limitKey], 'Usage limit', 1, true);
  if (section === 'discounts') return { ...result, name: text(values.name, 'Name', true, 120), type, value,
    status: choice(values.status, campaignStatuses, 'status'), targetAudience: choice(values.targetAudience, ['All', 'NewUsers', 'Specific', 'WithDebt'], 'audience'), scope: choice(values.scope, ['Global', 'Brand', 'Car', 'TariffPackage'], 'scope') };
  return { ...result, code: text(values.code, 'Code', true, 80), discountType: type, value, isActive: values.isActive === true, expiresAt: timestamp(values.expiresAt) };
}
export async function saveRecord(section: Section, values: Values, id?: number) {
  return apiRequest(`${base}${section}${id === undefined ? '' : `/${id}`}`, { method: id === undefined ? 'POST' : 'PUT', body: JSON.stringify(buildPayload(section, values)) });
}
export const saveReferral = (values: Values) => apiRequest(base + 'referrals/settings', { method: 'PUT', body: JSON.stringify(buildPayload('referrals', values)) });
export const removeRecord = (section: Section, id: number) => apiRequest(`${base}${section}/${id}`, { method: 'DELETE' });
export async function changeStatus(section: Section, row: RecordRow) {
  const current = await getRecord(section, row.id);
  if (current.isActive !== row.isActive || current.status !== row.status) throw new Error('Status changed. Refresh before trying again.');
  // Explicit state avoids accidentally reversing a change if a request is repeated.
  if (section === 'promo-codes') return apiRequest(`${base}${section}/${row.id}`, { method: 'PUT', body: JSON.stringify({ isActive: !current.isActive }) });
  const body = section === 'promotions' ? { isActive: !current.isActive } : { status: current.status === 'Active' ? section === 'stories' ? 'Draft' : 'Paused' : 'Active' };
  if (section === 'stories' && body.status === 'Active' && (!Array.isArray(current.items) || !current.items.length)) throw new Error('Add media before activating this story.');
  return apiRequest(`${base}${section}/${row.id}/status`, { method: 'PATCH', body: JSON.stringify(body) });
}
