import { apiRequest } from '../api/client';
import { object, validId } from '../customers/customersApi';
import { getCustomerTab, payAllDebts, type TabData } from '../customers/customerTabsApi';

export type Debt = Record<string, unknown> & { id: number; userId: string; userName: string; amount: number; currency: string; isPaid: boolean; type: string; description: string; createdAt: string };
export type Debtor = Record<string, unknown> & { id: string; fullName: string; email: string | null; phoneNumber: string; totalDebt: number; unpaidCount: number };
function parseDebt(value: unknown): Debt {
  const row = object(value);
  if (!Number.isSafeInteger(row.id) || Number(row.id) < 1 || !validId(String(row.userId)) || typeof row.amount !== 'number' || !Number.isFinite(row.amount) || typeof row.currency !== 'string' || typeof row.isPaid !== 'boolean') throw new Error('Invalid debt response.');
  return row as Debt;
}
// The mock has no search on either list. Load all pages before local searching,
// sorting and counting, never just the currently visible page.
async function snapshot(path: string, signal?: AbortSignal): Promise<Record<string, unknown>[]> {
  const result: Record<string, unknown>[] = [];
  let expected = -1;
  for (let page = 1; page <= 50; page++) {
    const payload = object(await apiRequest<unknown>(`${path}?page=${page}&pageSize=200&sortBy=id&sortOrder=asc`, { signal }));
    if (!Array.isArray(payload.data) || !Number.isSafeInteger(payload.total) || Number(payload.total) < 0 || payload.page !== page || payload.pageSize !== 200) throw new Error('Invalid debt list pagination.');
    if (expected !== -1 && expected !== payload.total) throw new Error('Records changed while loading. Refresh the list.');
    expected = Number(payload.total);
    result.push(...payload.data.map(object));
    if (result.length >= expected) {
      if (result.length !== expected || new Set(result.map(row => row.id)).size !== result.length) throw new Error('Incomplete debt snapshot. Refresh the list.');
      return result;
    }
    if (!payload.data.length) throw new Error('Incomplete debt snapshot. Refresh the list.');
  }
  throw new Error('The list exceeds the supported snapshot size (10,000). Server-side search is required.');
}
export async function getDebtLists(signal?: AbortSignal) {
  const [rawDebtors, rawDebts] = await Promise.all([snapshot('/api/admin/users/with-debt', signal), snapshot('/api/admin/debts', signal)]);
  const debts = rawDebts.map(parseDebt);
  const counts = new Map<string, number>();
  debts.filter(row => !row.isPaid).forEach(row => counts.set(row.userId, (counts.get(row.userId) ?? 0) + 1));
  const debtors = rawDebtors.map(row => {
    if (!validId(String(row.id)) || typeof row.fullName !== 'string' || typeof row.totalDebt !== 'number' || !Number.isFinite(row.totalDebt)) throw new Error('Invalid debtor response.');
    return { ...row, unpaidCount: counts.get(String(row.id)) ?? 0 } as Debtor;
  });
  return { debtors, debts };
}
export type DebtAction = { type: 'all' } | { type: 'selected'; ids: number[] } | { type: 'pay' | 'delete'; id: number } | { type: 'split'; id: number; parts: number } | { type: 'add'; amount: number; debtType: string; description: string };
export function splitAmounts(amount: number, parts: number) {
  const cents = Math.round(amount * 100);
  if (!Number.isSafeInteger(parts) || parts < 2 || parts > 12 || cents < parts) throw new Error('Choose 2–12 parts, at least 0.01 AED each.');
  // Backend rounds every part equally and does not distribute the remainder.
  if (cents % parts !== 0) throw new Error('This amount cannot be split equally into those parts without changing the total. Choose another part count.');
  return amount / parts;
}
export async function actOnDebt(userId: string, action: DebtAction, expected: TabData) {
  if (!validId(userId)) throw new Error('Invalid customer UUID.');
  const base = `/api/admin/users/${encodeURIComponent(userId)}/debt`;
  if (action.type === 'all') { await payAllDebts(userId, expected); return; }
  let path = base;
  let method = 'POST';
  let body: unknown;
  if (action.type === 'add') {
    if (!Number.isFinite(action.amount) || action.amount <= 0 || action.amount > 1_000_000 || Math.abs(action.amount * 100 - Math.round(action.amount * 100)) > 0.000001) throw new Error('Enter an amount between 0.01 and 1,000,000 with at most two decimals.');
    if (!action.debtType.trim() || action.debtType.length > 80 || !action.description.trim() || action.description.length > 500) throw new Error('Enter a type and description within the allowed length.');
    body = { amount: action.amount, type: action.debtType.trim(), description: action.description.trim() };
  } else {
    const fresh = await getCustomerTab(userId, 'Debt');
    const ids = action.type === 'selected' ? action.ids : [action.id];
    if (!ids.length || new Set(ids).size !== ids.length || ids.some(id => !Number.isSafeInteger(id) || id < 1)) throw new Error('Select valid debt records.');
    for (const id of ids) {
      const before = expected.rows.find(row => row.id === id);
      const now = fresh.rows.find(row => row.id === id);
      if (!before || !now || now.amount !== before.amount || now.isPaid !== before.isPaid || now.currency !== before.currency || now.description !== before.description) throw new Error('Debt changed. Refresh and review it again.');
      if (action.type !== 'delete' && now.isPaid) throw new Error('This debt is already paid.');
    }
    if (action.type === 'selected') { path += '/pay-selected'; body = { debtIds: ids }; }
    else if (action.type === 'delete') { path += `/${action.id}`; method = 'DELETE'; }
    else if (action.type === 'pay') path += `/${action.id}/pay`;
    else if (action.type === 'split') { splitAmounts(Number(fresh.rows.find(row => row.id === action.id)!.amount), action.parts); path += `/${action.id}/split`; body = { parts: action.parts }; }
  }
  const response = object(await apiRequest<unknown>(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) }));
  if (action.type === 'add') {
    if (response.userId !== userId || response.amount !== action.amount || !Number.isSafeInteger(response.id)) throw new Error('Unexpected add result. Refresh before retrying.');
  } else if (response.success !== true) throw new Error('Unexpected action result. Refresh before retrying.');
}
export function excelCompatibleCsv(csv: string): string {
  // Excel's regional list separator may differ from the backend's comma delimiter.
  // Keep the report values intact; CSV cannot store widths, colours or fonts.
  const content = csv.replace(/^\uFEFF/, '').replace(/^sep=,\r?\n/i, '');
  return '\uFEFFsep=,\r\n' + content.replace(/\r?\n/g, '\r\n');
}

export async function downloadDebtors(signal?: AbortSignal) {
  const blob = await apiRequest('/api/admin/users/with-debt/report', { signal }, 'blob');
  if (!blob.type.toLowerCase().startsWith('text/csv')) throw new Error('The server did not return a CSV report.');
  const text = await blob.text();
  if (signal?.aborted) throw new DOMException('Download cancelled', 'AbortError');
  const url = URL.createObjectURL(new Blob([excelCompatibleCsv(text)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'debtor-report.csv'; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
