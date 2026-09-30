import { apiRequest } from '../api/client';
export type Row = Record<string, unknown>;
export const object = (value: unknown): Row => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid report response.');
  return value as Row;
};
export function array(value: unknown): Row[] {
  if (!Array.isArray(value)) throw new Error('Invalid report list.');
  return value.map(object);
}
export function at(row: Row, path: string): unknown { return path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Row)[key] : undefined, row); }
export const getReport = async (path: string, signal?: AbortSignal) => object(await apiRequest('/api/admin/' + path, { signal }));
export type Series = { key: string; label: string };
export function points(value: unknown, label: string, series: Series[]) {
  const result = array(value);
  for (const row of result) {
    if (typeof row[label] !== 'string' || series.some(s => typeof at(row, s.key) !== 'number' || !Number.isFinite(at(row, s.key)))) throw new Error('Invalid chart values.');
  }
  return result;
}
export const monthlySeries = [{ key: 'revenue.total', label: 'Revenue' }, { key: 'operatingCost', label: 'Operating cost' }, { key: 'netRevenue', label: 'Net revenue' }];
const validMonth = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
function validateMonths(value: unknown) {
  const rows = points(value, 'month', monthlySeries);
  const seen = new Set<string>();
  for (const row of rows) {
    if (!validMonth(row.month) || seen.has(row.month)) throw new Error('Invalid or duplicate report month. Refresh to try again.');
    seen.add(row.month);
  }
  return rows;
}
export async function monthly(months: number, signal?: AbortSignal) {
  if (!Number.isInteger(months) || months < 1 || months > 24) throw new Error('Choose a period between 1 and 24 months.');
  const response = await getReport(`reports/monthly?months=${months}`, signal);
  validateMonths(response.months);
  const totals = object(response.totals);
  for (const value of Object.values(totals)) {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Invalid report total.');
  }
  return response;
}
export async function monthDetail(month: string, signal?: AbortSignal) {
  if (!validMonth(month)) throw new Error('Invalid month.');
  const response = await getReport(`reports/monthly/${month}`, signal);
  if (response.month !== month) throw new Error('The response does not match the selected month. Refresh to try again.');
  validateMonths([response]);
  return response;
}
export async function transactions(kind: 'salik' | 'enoc', signal?: AbortSignal) {
  const result: Row[] = []; const ids = new Set<unknown>(); let total: number | undefined;
  for (let page = 1; page <= 1000; page++) {
    const data = await getReport(`${kind}/${kind === 'salik' ? 'trips' : 'transactions'}?page=${page}&pageSize=200`, signal);
    if (!Number.isSafeInteger(data.total) || Number(data.total) < 0 || (total !== undefined && total !== data.total)) throw new Error('Transaction list changed. Refresh to try again.');
    total = Number(data.total);
    const batch = array(data.data);
    for (const row of batch) {
      if (!Number.isSafeInteger(row.id) || ids.has(row.id) || typeof row.amount !== 'number' || !Number.isFinite(row.amount)) throw new Error('Invalid or duplicate transaction.');
      if (kind === 'enoc' && (typeof row.liters !== 'number' || !Number.isFinite(row.liters))) throw new Error('Invalid fuel volume.');
      ids.add(row.id); result.push(row);
    }
    if (result.length === total) return result;
    if (!batch.length || result.length > total) break;
  }
  throw new Error('Incomplete transaction snapshot. Refresh to try again.');
}
export function grouped(rows: Row[], key: string) {
  const groups = new Map<string, Row>();
  for (const row of rows) {
    const name = String(row[key] ?? 'Unknown');
    const group = groups.get(name) ?? { name, amount: 0, liters: 0, count: 0 };
    group.amount = Number(group.amount) + Number(row.amount); group.liters = Number(group.liters) + Number(row.liters ?? 0); group.count = Number(group.count) + 1;
    groups.set(name, group);
  }
  return [...groups.values()].map(row => ({ ...row, amount: Math.round(Number(row.amount) * 100) / 100, liters: Math.round(Number(row.liters) * 100) / 100 }));
}
