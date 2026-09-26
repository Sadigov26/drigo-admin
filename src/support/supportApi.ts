import { apiRequest } from '../api/client';

export type RecordData = Record<string, unknown>;
export type Ticket = RecordData & { id: number; memberName: string; status: string; unreadCount?: number; isMuted: boolean; operatorId: string | null };
export type Message = RecordData & { id: number; supportId: number; message: string; createdAt: string; isOperator: boolean; isBot: boolean; operatorName: string | null; createdBy: string; mediaUrl: string | null };
export type Operator = { id: string; fullName: string | null; username: string };
export type Template = { id: number; title: string; body: string; category: string };
export type Suggestion = { id: number; text: string; confidence: number };
export const statuses = ['Open', 'Pending', 'Resolved', 'Closed'] as const;
const base = '/api/admin';
const object = (value: unknown): value is RecordData => !!value && typeof value === 'object' && !Array.isArray(value);

// Search is not supported by this mock. Never search an incomplete first page.
export async function pages<T extends { id: string | number }>(path: string, signal?: AbortSignal): Promise<T[]> {
  const rows: T[] = [];
  let total: number | undefined;
  for (let page = 1; page <= 50; page++) {
    const result = await apiRequest<{ data: T[]; total: number }>(`${base}${path}${path.includes('?') ? '&' : '?'}page=${page}&pageSize=200`, { signal, cache: 'no-store' });
    if (!result || !Array.isArray(result.data) || !Number.isInteger(result.total) || result.total < 0 || result.total > 10000 || (total !== undefined && total !== result.total)) throw new Error('The list changed or is incomplete. Refresh and try again.');
    total = result.total;
    if (result.data.some(row => !object(row) || !['string', 'number'].includes(typeof row.id))) throw new Error('Invalid list response.');
    rows.push(...result.data);
    if (new Set(rows.map(row => row.id)).size !== rows.length || rows.length > total) throw new Error('The list changed. Refresh and try again.');
    if (rows.length === total) return rows;
    if (!result.data.length) break;
  }
  throw new Error('The full list could not be loaded. Refresh and try again.');
}
export const tickets = (signal?: AbortSignal) => pages<Ticket>('/supports?sortBy=id&sortOrder=asc', signal);
export const operators = (signal?: AbortSignal) => pages<Operator>('/auth', signal);
export async function ticket(id: number, signal?: AbortSignal) {
  const row = await apiRequest<Ticket>(`${base}/supports/${id}`, { signal, cache: 'no-store' });
  if (!object(row) || row.id !== id || typeof row.status !== 'string') throw new Error('Invalid ticket response.');
  return row;
}
export async function messages(id: number, signal?: AbortSignal) {
  const rows = await pages<Message>(`/supports/${id}/messages`, signal);
  if (rows.some(row => row.supportId !== id || typeof row.message !== 'string' || !Number.isFinite(Date.parse(row.createdAt)))) throw new Error('Invalid message response.');
  return rows.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id);
}
export async function context(id: number, signal?: AbortSignal) {
  const row = await apiRequest<RecordData>(`${base}/supports/${id}/context`, { signal, cache: 'no-store' });
  if (!object(row)) throw new Error('Invalid context response.');
  return row;
}
async function array<T>(path: string, field: string, signal?: AbortSignal): Promise<T[]> {
  const rows = await apiRequest<unknown>(`${base}${path}`, { signal, cache: 'no-store' });
  if (!Array.isArray(rows) || rows.some(row => !object(row) || typeof row[field] !== 'string')) throw new Error('Invalid response.');
  return rows as T[];
}
export const templates = (signal?: AbortSignal) => array<Template>('/support-templates', 'body', signal);
export const suggestions = (id: number, signal?: AbortSignal) => array<Suggestion>(`/supports/${id}/ai-suggestions`, 'text', signal);
export type Action = { type: 'reply'; message: string } | { type: 'status'; status: string } | { type: 'assign'; operatorId: string } | { type: 'mute'; isMuted: boolean };
export async function actOnTicket(id: number, action: Action) {
  let body: RecordData;
  if (action.type === 'reply') {
    const message = action.message.trim();
    if (!message || message.length > 5000) throw new Error('Enter a message between 1 and 5,000 characters.');
    body = { message };
  } else if (action.type === 'status') {
    if (!statuses.some(status => status === action.status)) throw new Error('Choose a valid status.');
    body = { status: action.status };
  } else if (action.type === 'assign') {
    // Unknown IDs silently fall back to the current admin in this mock.
    if (!(await operators()).some(operator => operator.id === action.operatorId)) throw new Error('This operator is no longer available. Refresh the list.');
    body = { operatorId: action.operatorId };
  } else body = { isMuted: action.isMuted };
  const response = await apiRequest<RecordData>(`${base}/supports/${id}/${action.type === 'reply' ? 'messages' : action.type}`, { method: action.type === 'reply' ? 'POST' : 'PUT', body: JSON.stringify(body) });
  if (!object(response) || (action.type === 'reply' ? typeof response.id !== 'number' : response.success !== true)) throw new Error('The server did not confirm the change. Refresh before trying again.');
}
