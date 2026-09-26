import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { actOnTicket, messages, pages } from './supportApi';
vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));
const request = vi.mocked(apiRequest);
beforeEach(() => vi.resetAllMocks());
describe('support contracts', () => {
  it('reads all pages and rejects incomplete snapshots', async () => {
    request.mockResolvedValueOnce({ data: [{ id: 1 }], total: 2 }).mockResolvedValueOnce({ data: [{ id: 2 }], total: 2 });
    expect(await pages('/supports')).toHaveLength(2);
    expect(request.mock.calls[1][0]).toContain('page=2');
    request.mockResolvedValueOnce({ data: [{ id: 1 }], total: 2 }).mockResolvedValueOnce({ data: [], total: 2 });
    await expect(pages('/supports')).rejects.toThrow('full list');
  });
  it('rejects changed totals and duplicate rows', async () => {
    request.mockResolvedValueOnce({ data: [{ id: 1 }], total: 2 }).mockResolvedValueOnce({ data: [{ id: 1 }], total: 2 });
    await expect(pages('/supports')).rejects.toThrow('changed');
    request.mockResolvedValueOnce({ data: [{ id: 1 }], total: 2 }).mockResolvedValueOnce({ data: [{ id: 2 }], total: 3 });
    await expect(pages('/supports')).rejects.toThrow('changed');
  });
  it('orders messages chronologically rather than by response order', async () => {
    request.mockResolvedValueOnce({ data: [{ id: 2, supportId: 1, message: 'Later', createdAt: '2026-09-26T10:00:00Z' }, { id: 3, supportId: 1, message: 'Earlier', createdAt: '2026-09-26T09:00:00Z' }], total: 2 });
    expect((await messages(1)).map(row => row.id)).toEqual([3, 2]);
  });
  it('sends message, not text, and rejects empty or oversized replies', async () => {
    request.mockResolvedValueOnce({ id: 10 });
    await actOnTicket(1, { type: 'reply', message: ' Hello ' });
    expect(request).toHaveBeenCalledWith('/api/admin/supports/1/messages', { method: 'POST', body: '{"message":"Hello"}' });
    await expect(actOnTicket(1, { type: 'reply', message: ' ' })).rejects.toThrow('Enter a message');
    await expect(actOnTicket(1, { type: 'reply', message: 'x'.repeat(5001) })).rejects.toThrow('Enter a message');
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('checks operator IDs before assignment to avoid server fallback', async () => {
    request.mockResolvedValueOnce({ data: [{ id: 'op-1' }], total: 1 });
    await expect(actOnTicket(1, { type: 'assign', operatorId: 'missing' })).rejects.toThrow('no longer available');
    expect(request).toHaveBeenCalledTimes(1);
    request.mockResolvedValueOnce({ data: [{ id: 'op-1' }], total: 1 }).mockResolvedValueOnce({ success: true });
    await actOnTicket(1, { type: 'assign', operatorId: 'op-1' });
    expect(request).toHaveBeenLastCalledWith('/api/admin/supports/1/assign', { method: 'PUT', body: '{"operatorId":"op-1"}' });
  });
  it('validates status and sends explicit mute state', async () => {
    await expect(actOnTicket(1, { type: 'status', status: 'Invented' })).rejects.toThrow('valid status');
    request.mockResolvedValue({ success: true });
    await actOnTicket(1, { type: 'mute', isMuted: false });
    expect(request).toHaveBeenLastCalledWith('/api/admin/supports/1/mute', { method: 'PUT', body: '{"isMuted":false}' });
  });
});
