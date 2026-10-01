import { beforeEach, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { payload, polygon, preview, snapshot } from './fleetApi';
vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
it('loads complete pages and forwards cancellation', async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce({ data: [{ id: 1 }], total: 2, page: 1, pageSize: 1 }).mockResolvedValueOnce({ data: [{ id: 2 }], total: 2, page: 2, pageSize: 1 });
  const signal = new AbortController().signal;
  expect(await snapshot('notifications/history', signal)).toHaveLength(2);
  expect(apiRequest).toHaveBeenLastCalledWith('/api/admin/notifications/history?page=2&pageSize=1', { signal });
});
it('accepts array resources and rejects malformed snapshots', async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce([{ id: 1 }]);
  expect(await snapshot('geozones')).toEqual([{ id: 1 }]);
  for (const value of [{ data: [], total: -1, pageSize: 10 }, { data: [{ id: 1 }, { id: 1 }], total: 2, pageSize: 10 }, { data: [], total: 0, pageSize: 0 }]) {
    vi.mocked(apiRequest).mockResolvedValueOnce(value); await expect(snapshot('notifications/history')).rejects.toThrow();
  }
});
it('rejects changing totals and incomplete pages', async () => {
  for (const next of [{ data: [{ id: 2 }], total: 3, page: 2 }, { data: [], total: 2, page: 2 }]) {
    vi.mocked(apiRequest).mockResolvedValueOnce({ data: [{ id: 1 }], total: 2, page: 1, pageSize: 1 }).mockResolvedValueOnce(next);
    await expect(snapshot('notifications/history')).rejects.toThrow();
  }
});
const points = [{ lat: 25, lng: 55 }, { lat: 26, lng: 55 }, { lat: 26, lng: 56 }];
it('validates geometry and only sends editable zone fields', () => {
  const result = payload('geozones', { id: 8, name: ' Zone ', type: 'Operating', color: '#315d88', isActive: true, polygon: JSON.stringify(points), createdAt: 'never send' });
  expect(result).toEqual({ name: 'Zone', type: 'Operating', color: '#315d88', isActive: true, polygon: points });
  expect(payload('geozones', { ...result, type: 'NoParking' }).type).toBe('NoParking');
  for (const value of [[], [points[0], points[0], points[0]], [{ lat: 91, lng: 55 }, ...points], [{ lat: '25', lng: 55 }, ...points]]) expect(() => polygon(value)).toThrow();
});
it('validates messages, audience and scheduling; preserves UTC', () => {
  const draft = { title: 'Title', body: 'Body', targetAudience: 'All', status: 'Draft' };
  expect(payload('notifications/campaigns', { ...draft, recipientCount: 99 })).not.toHaveProperty('recipientCount');
  expect(() => payload('notifications/broadcast', { ...draft, body: ' ' })).toThrow();
  expect(() => payload('notifications/broadcast', { ...draft, targetAudience: 'Everyone' })).toThrow();
  expect(() => payload('notifications/scheduled', draft)).toThrow();
  expect(() => payload('notifications/scheduled', { ...draft, scheduledAt: '2000-01-01' })).toThrow();
  expect(payload('notifications/scheduled', { ...draft, scheduledAt: '2099-01-01T12:00:00+04:00' }).scheduledAt).toBe('2099-01-01T08:00:00.000Z');
});
it('validates preview response against requested audience', async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce({ audience: 'All', estimatedRecipients: 5 });
  expect(await preview('All')).toBe(5);
  vi.mocked(apiRequest).mockResolvedValueOnce({ audience: 'Other', estimatedRecipients: 5 });
  await expect(preview('All')).rejects.toThrow();
});
